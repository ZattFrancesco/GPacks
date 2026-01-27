// commands/admin/setup-pointeuse.js
const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const pointeuseDb = require("../../services/pointeuse.db");
const { buildDashboard } = require("../../src/utils/pointeuseSetupView");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-pointeuse")
    .setDescription("Configurer le système de pointeuse")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: "❌ Admin uniquement.", ephemeral: true });
    }

    await pointeuseDb.ensureSettingsRow(interaction.guildId);
    const settings = await pointeuseDb.getSettings(interaction.guildId);
    const payload = buildDashboard(settings);
    return interaction.reply({ ...payload, ephemeral: true });
  },
};
