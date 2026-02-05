// commands/admin/config-logs.js
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require("discord.js");
const logsDb = require("../../services/logs.db");
const { buildLogsConfigEmbed, buildLogsConfigComponents } = require("../../src/utils/logsUtils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("config-logs")
    .setDescription("Dashboard de configuration des logs (modules + salon)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: "❌ Admin uniquement.", flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    await logsDb.ensureTables();
    const cfg = await logsDb.getConfig(interaction.guildId);

    const embed = await buildLogsConfigEmbed(interaction.guildId);
    return interaction.editReply({
      embeds: [embed],
      components: buildLogsConfigComponents(cfg),
    });
  },
};
