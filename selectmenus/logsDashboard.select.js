
const logsDb = require('../services/logs.db');
const configLogsCommand = require('../commands/admin/config-logs');

module.exports = {
  idPrefix: 'logs-dashboard:',
  async execute(interaction) {
    if (!interaction.guildId) return interaction.deferUpdate().catch(() => {});

    const [, action, currentGroup] = interaction.customId.split(':');
    let selectedGroup = currentGroup || logsDb.getLogTypeGroups()[0]?.key;
    const cfg = await logsDb.getConfig(interaction.guildId);
    const groups = logsDb.getLogTypeGroups();

    if (action === 'category') {
      selectedGroup = interaction.values?.[0] || selectedGroup;
      const freshCfg = await logsDb.getConfig(interaction.guildId);
      return interaction.update(configLogsCommand.buildDashboardPayload(interaction.guild, freshCfg, selectedGroup));
    }

    if (action === 'toggle') {
      const group = groups.find((g) => g.key === selectedGroup) || groups[0];
      const previous = new Set(cfg?.enabledTypes || logsDb.ALL_LOG_TYPES);
      for (const type of group.types) previous.delete(type.key);
      for (const value of interaction.values || []) previous.add(value);
      await logsDb.setEnabledTypes(interaction.guildId, [...previous]);
      const freshCfg = await logsDb.getConfig(interaction.guildId);
      return interaction.update(configLogsCommand.buildDashboardPayload(interaction.guild, freshCfg, selectedGroup));
    }
  },
};
