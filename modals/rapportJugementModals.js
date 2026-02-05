// modals/rapportJugementModals.js

const {
  ActionRowBuilder,
  UserSelectMenuBuilder,
} = require("discord.js");

const { updateDraft, getDraft, clearDraft } = require("../src/utils/rjDrafts");
const { panel } = require("../buttons/rapportJugementButtons");
const { parseJudgementDate, buildRapportJugementEmbed } = require("../src/utils/rapportJugementFormat");
const { ensureTables, insertReport } = require("../services/rapportJugement.db");
const { auditLog } = require("../src/utils/auditLog");

function safeVal(interaction, id) {
  try {
    return interaction.fields.getTextInputValue(id);
  } catch {
    return null;
  }
}

module.exports = {
  idPrefix: "rj:",

  async execute(interaction) {
    const [, step, userId] = interaction.customId.split(":");

    if (interaction.user.id !== userId) {
      return interaction.reply({ content: "❌ Pas ton formulaire.", flags: 64 });
    }

    await ensureTables();

    // STEP 1: identité + date, puis affichage des sélecteurs
    if (step === "step1") {
      updateDraft(interaction.guildId, userId, {
        nom: safeVal(interaction, "nom"),
        prenom: safeVal(interaction, "prenom"),
        dateJugementRaw: safeVal(interaction, "dateJugement"),
        // init arrays
        jugeIds: [],
        procIds: [],
        avocatIds: [],
      });

      // ✅ User selects multi
      const rowJuge = new ActionRowBuilder().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId(`rjsel:jugeIds:${userId}`)
          .setPlaceholder("Choisir le(s) juge(s)")
          .setMinValues(1)      // obligatoire
          .setMaxValues(5)      // plusieurs juges
      );

      const rowProc = new ActionRowBuilder().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId(`rjsel:procIds:${userId}`)
          .setPlaceholder("Choisir le(s) procureur(s)")
          .setMinValues(1)      // obligatoire
          .setMaxValues(5)
      );

      const rowAvocat = new ActionRowBuilder().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId(`rjsel:avocatIds:${userId}`)
          .setPlaceholder("Choisir le(s) avocat(s) (facultatif)")
          .setMinValues(0)      // ✅ avocat NON obligatoire
          .setMaxValues(5)
      );

      return interaction.reply({
        content: "✅ Étape 1 enregistrée.\nSélectionne les rôles (multi possible), puis clique **Continuer**.",
        flags: 64,
        components: [rowJuge, rowProc, rowAvocat, ...panel(userId)],
      });
    }

    // STEP 3 FINAL: sanctions
    if (step === "step3") {
      const draft = getDraft(interaction.guildId, userId);
      if (!draft) {
        return interaction.reply({
          content: "⏱️ Rapport expiré. Relance /rapport-jugement.",
          flags: 64,
        });
      }

      const tigRaw = safeVal(interaction, "tig") || "";
      const tigBool = ["oui", "o", "yes", "y"].includes(tigRaw.toLowerCase().trim());

      // ✅ on transforme les listes en mentions (stockées et affichées)
      const jugeMentions = (draft.jugeIds || []).map(id => `<@${id}>`).join(", ");
      const procMentions = (draft.procIds || []).map(id => `<@${id}>`).join(", ");
      const avocatMentions = (draft.avocatIds || []).map(id => `<@${id}>`).join(", ");

      const payload = {
        guildId: interaction.guildId,
        reporterUserId: interaction.user.id,

        nom: draft.nom,
        prenom: draft.prenom,
        dateJugement: parseJudgementDate(draft.dateJugementRaw),

        // On stocke comme texte (mentions), même si plusieurs
        juge: jugeMentions || "/",
        procureur: procMentions || "/",
        avocat: avocatMentions || "/",

        peine: safeVal(interaction, "peine"),
        amende: safeVal(interaction, "amende"),
        tig: tigBool ? 1 : 0,
        tigEntreprise: safeVal(interaction, "tigEntreprise") || "/",
        observation: safeVal(interaction, "observation"),
      };

      const embed = buildRapportJugementEmbed(payload);

      await interaction.reply({
        content: `🆕 **Nouveau Rapport par <@${interaction.user.id}>**`,
        embeds: [embed],
      });

      const reportId = await insertReport(payload);

      await auditLog(interaction.client, interaction.guildId, {
        module: "RAPPORTS",
        action: "CREATE",
        level: "INFO",
        userId: interaction.user.id,
        sourceChannelId: interaction.channelId,
        message: `Rapport de jugement créé (#${reportId}).`,
        meta: { reportId, nom: payload.nom, prenom: payload.prenom, juge: payload.juge },
      });

      clearDraft(interaction.guildId, userId);
    }
  },
};