// buttons/dojButtons.js
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const db = require("../services/jugement.db");
const { getDraft, updateDraft, clearDraft } = require("../src/utils/dojDrafts");
const { buildJugementEmbed } = require("../src/utils/jugementEmbed");

/**
 * Construit les boutons du wizard.
 * - Le bouton "Photos manuelles" affiche ON/OFF selon draft.manualPhotosReminder
 */
function wizardComponents(userId, draft = {}) {
  const manualOn = !!draft.manualPhotosReminder;

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`doj:toggleManualPhotos:${userId}`)
      .setLabel(manualOn ? "📌 Photos manuelles : ON" : "📌 Photos manuelles : OFF")
      .setStyle(manualOn ? ButtonStyle.Success : ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId(`doj:nbCasiers:${userId}`)
      .setLabel("✏️ Nombre de casiers")
      .setStyle(ButtonStyle.Primary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`doj:send:${userId}`)
      .setLabel("✅ Valider et envoyer")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId(`doj:cancel:${userId}`)
      .setLabel("❌ Annuler")
      .setStyle(ButtonStyle.Danger),
  );

  return [row1, row2];
}

module.exports = {
  idPrefix: "doj:",

  async execute(interaction) {
    const [prefix, action, ownerId] = interaction.customId.split(":");
    if (prefix !== "doj") return;

    if (ownerId && interaction.user.id !== ownerId) {
      return interaction.reply({ content: "❌ Ce panneau ne t'appartient pas.", flags: 64 });
    }

    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const channel = interaction.channel;

    if (!channel) {
      return interaction.reply({ content: "❌ Salon introuvable.", flags: 64 });
    }

    if (action === "cancel") {
      clearDraft(guildId, userId);
      return interaction.update({ content: "✅ Demande annulée.", embeds: [], components: [] });
    }

    const draft = getDraft(guildId, userId);
    if (!draft) {
      return interaction.reply({
        content: "⏱️ Ton dossier a expiré (15 min). Relance `/demande-jugement`.",
        flags: 64,
      });
    }

    // Toggle rappel photos manuel
    if (action === "toggleManualPhotos") {
      const next = updateDraft(guildId, userId, {
        manualPhotosReminder: !draft.manualPhotosReminder,
      });

      return interaction.update({
        content:
          next.manualPhotosReminder
            ? "📌 Rappel photos manuel **activé** : le bot postera un message pour demander les photos sous le dossier."
            : "📌 Rappel photos manuel **désactivé**.",
        embeds: [buildJugementEmbed(next)],
        components: wizardComponents(userId, next),
      });
    }

    // Modal "nb casiers"
    if (action === "nbCasiers") {
      const modal = new ModalBuilder()
        .setCustomId(`doj:nbcasiers:${userId}`)
        .setTitle("Nombre de casiers");

      const nb = new TextInputBuilder()
        .setCustomId("nbCasiers")
        .setLabel("Nombre de casier judiciaire")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(10)
        .setValue(String(draft.nbCasiers ?? "").slice(0, 10));

      modal.addComponents(new ActionRowBuilder().addComponents(nb));
      return interaction.showModal(modal);
    }

    // Envoi final
    if (action === "send") {
      const pingRoleIds = await db.getPingRoleIds(guildId);
      const pingLine = pingRoleIds.length
        ? `|| ${pingRoleIds.map((id) => `<@&${id}>`).join(" ")} ||`
        : null;

      // 1) Dossier
      const dossierMsg = await channel.send({
        content: pingLine || undefined,
        embeds: [buildJugementEmbed(draft)],
      });

      // 2) Rappel photos manuel (si ON)
      if (draft.manualPhotosReminder) {
        await channel.send({
          content:
            "📎 **Photos à ajouter (manuel)**\n" +
            "➡️ Merci d’envoyer **les photos du casier judiciaire** + **photo de l’individu** **en réponse au dossier** (juste au-dessus).\n",
          reply: { messageReference: dossierMsg.id },
          allowedMentions: { repliedUser: false },
        });
      }

      clearDraft(guildId, userId);

      return interaction.update({
        content: "✅ Dossier envoyé.",
        embeds: [],
        components: [],
      });
    }

    return interaction.reply({ content: "❌ Action inconnue.", flags: 64 });
  },

  wizardComponents,
};