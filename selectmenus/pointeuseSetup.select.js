// selectmenus/pointeuseSetup.select.js
const { PermissionFlagsBits } = require("discord.js");
const pointeuseDb = require("../services/pointeuse.db");
const { buildDashboard } = require("../src/utils/pointeuseSetupView");

async function refresh(interaction) {
  const settings = await pointeuseDb.getSettings(interaction.guildId);
  const payload = buildDashboard(settings);
  return interaction.update({ ...payload });
}

function adminOnly(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

module.exports = [
  {
    id: "pointeuse:setup:panel_ch",
    async execute(interaction) {
      if (!adminOnly(interaction)) {
        return interaction.reply({ content: "❌ Admin uniquement.", ephemeral: true });
      }
      const channelId = interaction.values?.[0] || null;
      await pointeuseDb.setPanelChannel(interaction.guildId, channelId);
      return refresh(interaction);
    },
  },
  {
    id: "pointeuse:setup:recap_ch",
    async execute(interaction) {
      if (!adminOnly(interaction)) {
        return interaction.reply({ content: "❌ Admin uniquement.", ephemeral: true });
      }
      const channelId = interaction.values?.[0] || null;
      await pointeuseDb.setRecapChannel(interaction.guildId, channelId);
      return refresh(interaction);
    },
  },
  {
    id: "pointeuse:setup:logs_ch",
    async execute(interaction) {
      if (!adminOnly(interaction)) {
        return interaction.reply({ content: "❌ Admin uniquement.", ephemeral: true });
      }
      const channelId = interaction.values?.[0] || null;
      await pointeuseDb.setLogsChannel(interaction.guildId, channelId);
      return refresh(interaction);
    },
  },
  {
    id: "pointeuse:setup:staff_roles",
    async execute(interaction) {
      if (!adminOnly(interaction)) {
        return interaction.reply({ content: "❌ Admin uniquement.", ephemeral: true });
      }
      const roleIds = Array.isArray(interaction.values) ? interaction.values : [];
      await pointeuseDb.setStaffRoles(interaction.guildId, roleIds);
      return refresh(interaction);
    },
  },
];
