const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const db = require("../services/jugement.db");
const { getDraft, clearDraft } = require("../src/utils/dojDrafts");
const { buildJugementEmbed } = require("../src/utils/jugementEmbed");

function wizardComponents(userId) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`doj:addPieces:${userId}`)
      .setLabel("Ajouter pièces / photos")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`doj:send:${userId}`)
      .setLabel("Valider et envoyer")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`doj:cancel:${userId}`)
      .setLabel("Annuler")
      .setStyle(ButtonStyle.Danger)
  );
  return [row];
}

function normalizeUrlMaybe(url) {
  if (!url) return null;
  const s = String(url).trim();
  if (!s) return null;
  // On ne tente pas de "réparer" : si ce n'est pas une URL http(s) brute, Discord ne preview pas.
  if (!/^https?:\/\/\S+$/i.test(s)) return s; // on laisse quand même le texte, au pire
  return s;
}

module.exports = {
  idPrefix: "doj:",

  async execute(interaction) {
    const [prefix, action, ownerId] = interaction.customId.split(":");
    if (prefix !== "doj") return;

    if (ownerId && interaction.user.id !== ownerId) {
      return interaction.reply({ content: "❌ Ce panneau ne t'appartient pas.", ephemeral: true });
    }

    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    if (action === "cancel") {
      clearDraft(guildId, userId);
      return interaction.update({ content: "✅ Demande annulée.", embeds: [], components: [] });
    }

    const draft = getDraft(guildId, userId);
    if (!draft) {
      return interaction.reply({
        content: "⏱️ Ton dossier a expiré (15 min). Relance `/demande-jugement`.",
        ephemeral: true,
      });
    }

    if (action === "addPieces") {
      const modal = new ModalBuilder()
        .setCustomId(`doj:pieces:${userId}`)
        .setTitle("Demande de jugement (2/2)");

      const photoCasier = new TextInputBuilder()
        .setCustomId("photoCasier")
        .setLabel("Photo casier judiciaire (lien direct)")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(300)
        .setValue(draft.photoCasier ? String(draft.photoCasier).slice(0, 300) : "");

      const nbCasiers = new TextInputBuilder()
        .setCustomId("nbCasiers")
        .setLabel("Nombre de casier judiciaire")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(10)
        .setValue(
          draft.nbCasiers !== undefined && draft.nbCasiers !== null
            ? String(draft.nbCasiers).slice(0, 10)
            : ""
        );

      const photoIndividu = new TextInputBuilder()
        .setCustomId("photoIndividu")
        .setLabel("Photo individu (lien direct)")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(300)
        .setValue(draft.photoIndividu ? String(draft.photoIndividu).slice(0, 300) : "");

      modal.addComponents(
        new ActionRowBuilder().addComponents(photoCasier),
        new ActionRowBuilder().addComponents(nbCasiers),
        new ActionRowBuilder().addComponents(photoIndividu)
      );

      return interaction.showModal(modal);
    }

    if (action === "send") {
      const pingRoleIds = await db.getPingRoleIds(guildId);
      const pingLine = pingRoleIds.length
        ? `|| ${pingRoleIds.map((id) => `<@&${id}>`).join(" ")} ||`
        : null;

      const embed = buildJugementEmbed(draft);

      // ✅ On prépare les URL "pures" (seules sur une ligne) pour forcer les previews Discord
      const urlCasier = normalizeUrlMaybe(draft.photoCasier);
      const urlIndividu = normalizeUrlMaybe(draft.photoIndividu);

      const pureUrls = [urlCasier, urlIndividu]
        .filter(Boolean)
        // URL seule sur sa ligne = preview fiable
        .join("\n");

      const channel = interaction.channel;
      if (!channel) {
        return interaction.reply({ content: "❌ Salon introuvable.", ephemeral: true });
      }

      // 1) Message principal : pings + embed
      await channel.send({
        content: pingLine || undefined,
        embeds: [embed],
      });

      // 2) Message pièces : URL brutes seules (si existantes) => previews
      if (pureUrls) {
        await channel.send({
          content: pureUrls,
        });
      }

      clearDraft(guildId, userId);
      return interaction.update({ content: "✅ Dossier envoyé.", embeds: [], components: [] });
    }
  },
};

module.exports.wizardComponents = wizardComponents;