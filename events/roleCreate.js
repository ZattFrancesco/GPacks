const { sendLog, DEFAULT_COLORS, lines } = require('../src/utils/discordLogs');

module.exports = {
  name: 'roleCreate',
  once: false,
  async execute(client, role) {
    await sendLog(client, role.guild.id, {
      color: DEFAULT_COLORS.success,
      title: '🆕 Rôle créé',
      description: lines([
        `**Rôle** : ${role}`,
        `**Nom** : ${role.name}`,
        `**ID** : \`${role.id}\``,
      ]),
    });
  },
};
