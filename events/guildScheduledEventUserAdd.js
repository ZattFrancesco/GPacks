const { sendLog, DEFAULT_COLORS, lines, userLabel } = require('../src/utils/discordLogs');

module.exports = {
  name: 'guildScheduledEventUserAdd',
  once: false,
  async execute(client, event, user) {
    if (!event?.guildId || !user) return;
    await sendLog(client, event.guildId, {
      color: DEFAULT_COLORS.success,
      title: '✅ Inscription à un événement',
      description: lines([
        `**Événement** : ${event.name}`,
        `**Utilisateur** : ${userLabel(user)}`,
      ]),
    });
  },
};
