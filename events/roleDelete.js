const { sendLog, DEFAULT_COLORS, lines } = require('../src/utils/discordLogs');

module.exports = {
  name: 'roleDelete',
  once: false,
  async execute(client, role) {
    await sendLog(client, role.guild.id, {
      color: DEFAULT_COLORS.danger,
      title: '🗑️ Rôle supprimé',
      description: lines([
        `**Nom** : ${role.name}`,
        `**ID** : \`${role.id}\``,
      ]),
    });
  },
};
