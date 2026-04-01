const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { listPanels, listTypes } = require("../../services/tickets.db");
const { buildHomeView } = require("../../src/utils/ticketsAdminDashboard");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("tickets")
    .setDescription("Dashboard central du module tickets")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const [types, panels] = await Promise.all([
      listTypes(interaction.guildId),
      listPanels(interaction.guildId),
    ]);

    return interaction.reply({
      ...buildHomeView(interaction.guild, {
        typeCount: types.length,
        panelCount: panels.length,
      }),
      flags: 64,
    });
  },
};
