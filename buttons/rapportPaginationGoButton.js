// buttons/rapportPaginationGoButton.js
// Bouton "Aller à la page" pour la pagination des rapports

const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");

module.exports = {
  idPrefix: "rjrepgo:",

  async execute(interaction) {
    // rjrepgo:<mode>:<ownerId>:<session>:<pages>:<limit>
    const parts = String(interaction.customId || "").split(":");
    const mode = parts[1];
    const ownerId = parts[2];
    const session = parts[3];
    const pages = Number(parts[4]);
    const limit = Number(parts[5]);

    if (!ownerId || interaction.user.id !== ownerId) {
      return interaction.reply({ content: "❌ Ce panneau ne t'appartient pas.", ephemeral: true });
    }
    if (!Number.isFinite(pages) || pages <= 1) {
      return interaction.reply({ content: "ℹ️ Il n'y a qu'une seule page.", ephemeral: true });
    }
    if (mode !== "week" && mode !== "all") {
      return interaction.reply({ content: "❌ Pagination inconnue.", ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId(`rjrepgoModal:${mode}:${ownerId}:${session}:${pages}:${limit}`)
      .setTitle("Aller à une page");

    const input = new TextInputBuilder()
      .setCustomId("page")
      .setLabel(`Numéro de page (1 à ${pages})`)
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("Ex: 3");

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  },
};
