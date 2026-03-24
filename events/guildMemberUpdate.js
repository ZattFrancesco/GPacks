const {
  sendLog,
  DEFAULT_COLORS,
  userLabel,
  lines,
  roleLabel,
  timestampLabel,
  resolveAuditEntry,
  AuditLogEvent,
} = require('../src/utils/discordLogs');

module.exports = {
  name: 'guildMemberUpdate',
  once: false,
  async execute(client, oldMember, newMember) {
    if (!newMember?.guild?.id || newMember.user?.bot) return;

    const changes = [];
    const fields = [];

    if (oldMember.nickname !== newMember.nickname) {
      changes.push(`**Pseudo** : ${oldMember.nickname || 'Aucun'} → ${newMember.nickname || 'Aucun'}`);
    }

    if (oldMember.pending !== newMember.pending) {
      changes.push(`**Vérification membre** : ${oldMember.pending ? 'En attente' : 'Validé'} → ${newMember.pending ? 'En attente' : 'Validé'}`);
    }

    if (oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp) {
      changes.push(
        `**Timeout** : ${timestampLabel(oldMember.communicationDisabledUntilTimestamp)} → ${timestampLabel(newMember.communicationDisabledUntilTimestamp)}`
      );
    }

    if (oldMember.premiumSinceTimestamp !== newMember.premiumSinceTimestamp) {
      changes.push(
        `**Boost** : ${oldMember.premiumSinceTimestamp ? 'Actif' : 'Inactif'} → ${newMember.premiumSinceTimestamp ? 'Actif' : 'Inactif'}`
      );
    }

    const oldRoles = new Set(oldMember.roles.cache.keys());
    const newRoles = new Set(newMember.roles.cache.keys());
    const addedRoles = [...newRoles].filter((id) => !oldRoles.has(id)).map((id) => newMember.guild.roles.cache.get(id)).filter(Boolean);
    const removedRoles = [...oldRoles].filter((id) => !newRoles.has(id)).map((id) => newMember.guild.roles.cache.get(id)).filter(Boolean);

    if (addedRoles.length) fields.push({ name: 'Rôles ajoutés', value: addedRoles.map(roleLabel).join('\n').slice(0, 1024) });
    if (removedRoles.length) fields.push({ name: 'Rôles retirés', value: removedRoles.map(roleLabel).join('\n').slice(0, 1024) });

    if (!changes.length && !fields.length) return;

    const roleEntry = addedRoles.length || removedRoles.length
      ? await resolveAuditEntry(newMember.guild, AuditLogEvent.MemberRoleUpdate, newMember.id)
      : null;
    const timeoutEntry = oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp
      ? await resolveAuditEntry(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id)
      : null;

    await sendLog(client, newMember.guild.id, {
      type: 'guild_member_update',
      color: DEFAULT_COLORS.warning,
      title: '👤 Membre mis à jour',
      description: lines([
        `**Membre** : ${userLabel(newMember.user)}`,
        roleEntry?.executor ? `**Modérateur rôles** : ${userLabel(roleEntry.executor)}` : null,
        timeoutEntry?.executor ? `**Modérateur timeout** : ${userLabel(timeoutEntry.executor)}` : null,
        ...changes,
      ]),
      fields,
      thumbnail: newMember.user.displayAvatarURL?.(),
    });
  },
};
