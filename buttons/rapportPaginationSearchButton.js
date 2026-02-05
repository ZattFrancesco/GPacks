// buttons/rapportPaginationSearchButton.js
// Bouton "Recherche par nom" pour la pagination des rapports

const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");

module.exports = {
  idPrefix: "rjrepsearch:",

  async execute(interaction) {
    // rjrepsearch:<mode>:<ownerId>:<session>:<limit>
    const parts = String(interaction.customId || "").split(":");
    const mode = parts[1];
    const ownerId = parts[2];
    const session = parts[3];
    const limit = Number(parts[4]);

    if (!ownerId || interaction.user.id !== ownerId) {
      return interaction.reply({ content: "❌ Ce panneau ne t'appartient pas.", flags: 64 });
    }
    if (mode !== "week" && mode !== "all") {
      return interaction.reply({ content: "❌ Pagination inconnue.", flags: 64 });
    }

    const modal = new ModalBuilder()
      .setCustomId(`rjrepsearchModal:${mode}:${ownerId}:${session}:${limit}`)
      .setTitle("Rechercher un suspect");

    const input = new TextInputBuilder()
      .setCustomId("query")
      .setLabel("Nom ou prénom (ex: Vazimov)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("Tape un nom ou un prénom");

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  },
};
