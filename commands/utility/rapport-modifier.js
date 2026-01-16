// commands/utility/rapport-modifier.js
// Recherche + sélection + modification d'un rapport de jugement

const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");

const { createSession } = require("../../src/utils/rjReportSessions");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rapport-modifier")
    .setDescription("Rechercher un rapport et le modifier (select + modals)"),

  async execute(interaction) {
    const ownerId = interaction.user.id;
    const session = createSession(interaction.guildId, ownerId, { search: null });

    const modal = new ModalBuilder()
      .setCustomId(`rjeditsearchModal:${ownerId}:${session}:200`)
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
