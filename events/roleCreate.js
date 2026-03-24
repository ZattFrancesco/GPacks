const { sendLog, DEFAULT_COLORS, lines, resolveAuditEntry, AuditLogEvent, permissionsToNames } = require('../src/utils/discordLogs');

module.exports = {
  name: 'roleCreate',
  once: false,
  async execute(client, role) {
    const entry = await resolveAuditEntry(role.guild, AuditLogEvent.RoleCreate, role.id);
    await sendLog(client, role.guild.id, {
      color: DEFAULT_COLORS.success,
      title: '🆕 Rôle créé',
      description: lines([
        `**Rôle** : ${role}`,
        `**ID** : \`${role.id}\``,
        entry?.executor ? `**Par** : ${entry.executor.tag} (\`${entry.executor.id}\`)` : null,
      ]),
      fields: [
        { name: 'Couleur', value: role.hexColor || '#000000', inline: true },
        { name: 'Mentionnable', value: role.mentionable ? 'Oui' : 'Non', inline: true },
        { name: 'Permissions', value: permissionsToNames(role.permissions).join(', ') || 'Aucune' },
      ],
    });
  },
};
