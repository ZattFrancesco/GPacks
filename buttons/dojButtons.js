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
        .setLabel("Photo casier judiciaire (lien)")
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
        .setLabel("Photo individu (lien)")
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
      const ping = pingRoleIds.length
        ? `|| ${pingRoleIds.map((id) => `<@&${id}>`).join(" ")} ||`
        : null;

      const embed = buildJugementEmbed(draft);

      // ⚠️ Les liens doivent être en TEXTE PUR (content) pour déclencher les previews Discord.
      const imageLines = [
        draft.photoCasier ? `Photo casier judiciaire: ${draft.photoCasier}` : null,
        draft.photoIndividu ? `Photo individu: ${draft.photoIndividu}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const content = [ping, imageLines].filter(Boolean).join("\n\n");

      // Envoi dans le salon où l'agent est en train d'utiliser la commande
      const channel = interaction.channel;
      if (!channel) {
        return interaction.reply({ content: "❌ Salon introuvable.", ephemeral: true });
      }

      await channel.send({ content: content || undefined, embeds: [embed] });
      clearDraft(guildId, userId);

      return interaction.update({ content: "✅ Dossier envoyé.", embeds: [], components: [] });
    }
  },
};

// Export aussi le builder pour le réutiliser depuis les modals
module.exports.wizardComponents = wizardComponents;