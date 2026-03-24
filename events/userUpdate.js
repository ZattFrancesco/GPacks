const { sendUserUpdateToMutualGuilds, DEFAULT_COLORS, lines, userLabel } = require('../src/utils/discordLogs');

module.exports = {
  name: 'userUpdate',
  once: false,
  async execute(client, oldUser, newUser) {
    const changes = [];
    if (oldUser.username !== newUser.username) changes.push(`**Username** : ${oldUser.username} → ${newUser.username}`);
    if (oldUser.globalName !== newUser.globalName) changes.push(`**Nom global** : ${oldUser.globalName || 'Aucun'} → ${newUser.globalName || 'Aucun'}`);
    if (oldUser.avatar !== newUser.avatar) changes.push('**Avatar** : mis à jour');
    if (!changes.length) return;

    await sendUserUpdateToMutualGuilds(client, newUser, {
      color: DEFAULT_COLORS.info,
      title: '🌐 Profil utilisateur mis à jour',
      description: lines([
        `**Utilisateur** : ${userLabel(newUser)}`,
        ...changes,
      ]),
      thumbnail: newUser.displayAvatarURL?.(),
    });
  },
};
