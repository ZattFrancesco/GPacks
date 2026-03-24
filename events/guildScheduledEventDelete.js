const { sendLog, DEFAULT_COLORS, lines } = require('../src/utils/discordLogs');

module.exports = {
  name: 'guildScheduledEventDelete',
  once: false,
  async execute(client, event) {
    if (!event?.guildId) return;
    await sendLog(client, event.guildId, {
      color: DEFAULT_COLORS.danger,
      title: '🗑️ Événement planifié supprimé',
      description: lines([
        `**Nom** : ${event.name}`,
        `**ID** : \`${event.id}\``,
      ]),
    });
  },
};
