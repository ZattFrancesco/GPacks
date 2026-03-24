
const logsDb = require('../services/logs.db');
const configLogsCommand = require('../commands/admin/config-logs');

module.exports = {
  idPrefix: 'logs-dashboard:',
  async execute(interaction) {
    if (!interaction.guildId) return interaction.deferUpdate().catch(() => {});
    const [, action, currentGroup] = interaction.customId.split(':');
    const groups = logsDb.getLogTypeGroups();
    const selectedGroup = currentGroup || groups[0]?.key;
    const group = groups.find((g) => g.key === selectedGroup) || groups[0];
    const cfg = await logsDb.getConfig(interaction.guildId);
    const enabled = new Set(cfg?.enabledTypes || logsDb.ALL_LOG_TYPES);

    if (action === 'enableall') {
      for (const type of group.types) enabled.add(type.key);
      await logsDb.setEnabledTypes(interaction.guildId, [...enabled]);
    } else if (action === 'disableall') {
      for (const type of group.types) enabled.delete(type.key);
      await logsDb.setEnabledTypes(interaction.guildId, [...enabled]);
    } else if (action === 'reset') {
      await logsDb.setEnabledTypes(interaction.guildId, null);
    } else {
      return interaction.deferUpdate().catch(() => {});
    }

    const freshCfg = await logsDb.getConfig(interaction.guildId);
    return interaction.update(configLogsCommand.buildDashboardPayload(interaction.guild, freshCfg, selectedGroup));
  },
};
