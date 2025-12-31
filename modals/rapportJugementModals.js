// modals/rapportJugementModals.js
const {
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const { setDraft, getDraft, updateDraft, clearDraft } = require("../src/utils/rjDrafts");
const { insertReport } = require("../services/rapportJugement.db");
const {
  parseUnixTimestamp,
  parseOuiNon,
  extractMentionUserId,
  normalizeJudgeKey,
  buildRapportText,
} = require("../src/utils/rapportJugementFormat");

function safeVal(interaction, customId) {
  try {
    const v = interaction.fields.getTextInputValue(customId);
    return (v ?? "").trim();
  } catch {
    return "";
  }
}

function makeModalStep2(userId) {
  const modal = new ModalBuilder().setCustomId(`rj:step2:${userId}`).setTitle("Rapport jugement (2/3)");

  const juge = new TextInputBuilder()
    .setCustomId("juge")
    .setLabel("Juge (mention ou nom)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(128);

  const procureur = new TextInputBuilder()
    .setCustomId("procureur")
    .setLabel("Procureur")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(128);

  const avocat = new TextInputBuilder()
    .setCustomId("avocat")
    .setLabel("Avocat")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(128);

  modal.addComponents(
    new ActionRowBuilder().addComponents(juge),
    new ActionRowBuilder().addComponents(procureur),
    new ActionRowBuilder().addComponents(avocat)
  );
  return modal;
}

function makeModalStep3(userId) {
  const modal = new ModalBuilder().setCustomId(`rj:step3:${userId}`).setTitle("Rapport jugement (3/3)");

  const peine = new TextInputBuilder()
    .setCustomId("peine")
    .setLabel("Peine")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(900);

  const amende = new TextInputBuilder()
    .setCustomId("amende")
    .setLabel("Amende")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(100);

  const tig = new TextInputBuilder()
    .setCustomId("tig")
    .setLabel("T.I.G. (Oui/Non)")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(8);

  const tigEntreprise = new TextInputBuilder()
    .setCustomId("tigEntreprise")
    .setLabel("Entreprise T.I.G. (si Oui, sinon /)")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(160);

  const observation = new TextInputBuilder()
    .setCustomId("observation")
    .setLabel("Observation")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(900);

  modal.addComponents(
    new ActionRowBuilder().addComponents(peine),
    new ActionRowBuilder().addComponents(amende),
    new ActionRowBuilder().addComponents(tig),
    new ActionRowBuilder().addComponents(tigEntreprise),
    new ActionRowBuilder().addComponents(observation)
  );
  return modal;
}

module.exports = {
  idPrefix: "rj:",

  async execute(interaction) {
    const parts = interaction.customId.split(":");
    const prefix = parts[0];
    const action = parts[1];
    const ownerId = parts[2];

    if (prefix !== "rj") return;

    if (ownerId && interaction.user.id !== ownerId) {
      return interaction.reply({ content: "❌ Ce formulaire ne t'appartient pas.", ephemeral: true });
    }

    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    if (!guildId) return interaction.reply({ content: "❌ Commande utilisable uniquement en serveur.", ephemeral: true });

    // STEP 1
    if (action === "step1") {
      const nom = safeVal(interaction, "nom");
      const prenom = safeVal(interaction, "prenom");
      const dateJugement = safeVal(interaction, "dateJugement");

      const date_jugement_unix = parseUnixTimestamp(dateJugement);

      setDraft(guildId, userId, {
        openedAt: new Date().toISOString(),
        nom,
        prenom,
        date_jugement_unix,
      });

      return interaction.showModal(makeModalStep2(userId));
    }

    // STEP 2
    if (action === "step2") {
      const existing = getDraft(guildId, userId);
      if (!existing) {
        return interaction.reply({
          content: "⏱️ Ton rapport a expiré (15 min). Relance `/rapport-jugement`.",
          ephemeral: true,
        });
      }

      const juge = safeVal(interaction, "juge");
      const procureur = safeVal(interaction, "procureur");
      const avocat = safeVal(interaction, "avocat");

      const judge_user_id = extractMentionUserId(juge);
      const judge_name = judge_user_id ? `<@${judge_user_id}>` : juge;
      const judge_key = normalizeJudgeKey(judge_user_id, judge_name);

      updateDraft(guildId, userId, {
        judge_user_id,
        judge_name,
        judge_key,
        procureur,
        avocat,
      });

      return interaction.showModal(makeModalStep3(userId));
    }

    // STEP 3 (final)
    if (action === "step3") {
      const existing = getDraft(guildId, userId);
      if (!existing) {
        return interaction.reply({
          content: "⏱️ Ton rapport a expiré (15 min). Relance `/rapport-jugement`.",
          ephemeral: true,
        });
      }

      const peine = safeVal(interaction, "peine");
      const amende = safeVal(interaction, "amende");
      const tigRaw = safeVal(interaction, "tig");
      const tigEntreprise = safeVal(interaction, "tigEntreprise");
      const observation = safeVal(interaction, "observation");

      const tig = parseOuiNon(tigRaw);

      const finalData = {
        ...existing,
        peine,
        amende,
        tig,
        tig_entreprise: tig ? (tigEntreprise?.trim() || "/") : "/",
        observation,
      };

      // Persist
      await insertReport({
        guild_id: guildId,
        reporter_user_id: userId,
        date_jugement_unix: finalData.date_jugement_unix,
        nom: finalData.nom,
        prenom: finalData.prenom,
        judge_user_id: finalData.judge_user_id ?? null,
        judge_name: finalData.judge_name,
        judge_key: finalData.judge_key,
        procureur: finalData.procureur,
        avocat: finalData.avocat,
        peine: finalData.peine,
        amende: finalData.amende,
        tig: finalData.tig,
        tig_entreprise: finalData.tig_entreprise,
        observation: finalData.observation,
      });

      // Post in channel
      const text = buildRapportText(finalData);
      try {
        await interaction.channel?.send({ content: text });
      } catch {
        // ignore
      }

      clearDraft(guildId, userId);
      return interaction.reply({ content: "✅ Rapport enregistré et posté.", ephemeral: true });
    }

    return interaction.reply({ content: "❌ Modal inconnu.", ephemeral: true });
  },
};
