const { sendLog, DEFAULT_COLORS, lines, diffPermissionNames, resolveAuditEntry, AuditLogEvent } = require('../src/utils/discordLogs');

module.exports = {
  name: 'roleUpdate',
  once: false,
  async execute(client, oldRole, newRole) {
    const changes = [];
    const fields = [];

    if (oldRole.name !== newRole.name) changes.push(`**Nom** : ${oldRole.name} → ${newRole.name}`);
    if (oldRole.hexColor !== newRole.hexColor) changes.push(`**Couleur** : ${oldRole.hexColor} → ${newRole.hexColor}`);
    if (oldRole.hoist !== newRole.hoist) changes.push(`**Affiché séparément** : ${oldRole.hoist ? 'Oui' : 'Non'} → ${newRole.hoist ? 'Oui' : 'Non'}`);
    if (oldRole.mentionable !== newRole.mentionable) changes.push(`**Mentionnable** : ${oldRole.mentionable ? 'Oui' : 'Non'} → ${newRole.mentionable ? 'Oui' : 'Non'}`);

    const permDiff = diffPermissionNames(oldRole.permissions, newRole.permissions);
    if (permDiff.added.length) fields.push({ name: 'Permissions ajoutées', value: permDiff.added.join('\n').slice(0, 1024) });
    if (permDiff.removed.length) fields.push({ name: 'Permissions retirées', value: permDiff.removed.join('\n').slice(0, 1024) });

    if (!changes.length && !fields.length) return;
    const entry = await resolveAuditEntry(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);

    await sendLog(client, newRole.guild.id, {
      type: 'role_update',
      color: DEFAULT_COLORS.warning,
      title: '🛠️ Rôle mis à jour',
      description: lines([
        `**Rôle** : ${newRole}`,
        entry?.executor ? `**Par** : ${entry.executor.tag} (\`${entry.executor.id}\`)` : null,
        ...changes,
      ]),
      fields,
    });
  },
};
