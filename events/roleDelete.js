const { sendLog, DEFAULT_COLORS, lines, resolveAuditEntry, AuditLogEvent } = require('../src/utils/discordLogs');

module.exports = {
  name: 'roleDelete',
  once: false,
  async execute(client, role) {
    const entry = await resolveAuditEntry(role.guild, AuditLogEvent.RoleDelete, role.id);
    await sendLog(client, role.guild.id, {
      type: 'role_delete',
      color: DEFAULT_COLORS.danger,
      title: '🗑️ Rôle supprimé',
      description: lines([
        `**Nom** : ${role.name}`,
        `**ID** : \`${role.id}\``,
        entry?.executor ? `**Par** : ${entry.executor.tag} (\`${entry.executor.id}\`)` : null,
      ]),
    });
  },
};
