const { sendLog, DEFAULT_COLORS, userLabel, lines, roleLabel } = require('../src/utils/discordLogs');

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

    const oldRoles = new Set(oldMember.roles.cache.keys());
    const newRoles = new Set(newMember.roles.cache.keys());
    const addedRoles = [...newRoles].filter((id) => !oldRoles.has(id)).map((id) => newMember.guild.roles.cache.get(id)).filter(Boolean);
    const removedRoles = [...oldRoles].filter((id) => !newRoles.has(id)).map((id) => newMember.guild.roles.cache.get(id)).filter(Boolean);

    if (addedRoles.length) fields.push({ name: 'Rôles ajoutés', value: addedRoles.map(roleLabel).join('\n').slice(0, 1024) });
    if (removedRoles.length) fields.push({ name: 'Rôles retirés', value: removedRoles.map(roleLabel).join('\n').slice(0, 1024) });

    if (!changes.length && !fields.length) return;

    await sendLog(client, newMember.guild.id, {
      color: DEFAULT_COLORS.warning,
      title: '👤 Membre mis à jour',
      description: lines([
        `**Membre** : ${userLabel(newMember.user)}`,
        ...changes,
      ]),
      fields,
      thumbnail: newMember.user.displayAvatarURL?.(),
    });
  },
};
