// buttons/rjEditNewSearchButton.js
// Ouvre un nouveau modal de recherche dans le panneau d'édition

const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");

const { getSession } = require("../src/utils/rjReportSessions");

module.exports = {
  idPrefix: "rjeditnewsearch:",

  async execute(interaction) {
    // rjeditnewsearch:<ownerId>:<session>:<limit>
    const parts = String(interaction.customId || "").split(":");
    const ownerId = parts[1];
    const session = parts[2];
    const limit = parts[3] || "200";

    if (!ownerId || interaction.user.id !== ownerId) {
      return interaction.reply({ content: "❌ Ce panneau ne t'appartient pas.", flags: 64 });
    }

    const sess = getSession(interaction.guildId, ownerId, session);
    if (!sess) {
      return interaction.reply({ content: "⏱️ Session expirée. Relance /rapport-modifier.", flags: 64 });
    }

    const modal = new ModalBuilder()
      .setCustomId(`rjeditsearchModal:${ownerId}:${session}:${limit}`)
      .setTitle("🔎 Rechercher un rapport");

    const query = new TextInputBuilder()
      .setCustomId("query")
      .setLabel("Nom / Prénom")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("ex: vazimov ou ibrahim vazimov")
      .setRequired(true)
      .setMaxLength(80);

    modal.addComponents(new ActionRowBuilder().addComponents(query));
    return interaction.showModal(modal);
  },
};
