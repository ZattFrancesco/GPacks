const { sendLog, DEFAULT_COLORS, lines, timestampLabel } = require('../src/utils/discordLogs');

module.exports = {
  name: 'guildScheduledEventCreate',
  once: false,
  async execute(client, event) {
    if (!event?.guildId) return;
    await sendLog(client, event.guildId, {
      color: DEFAULT_COLORS.success,
      title: '📅 Événement planifié créé',
      description: lines([
        `**Nom** : ${event.name}`,
        `**ID** : \`${event.id}\``,
        `**Début** : ${timestampLabel(event.scheduledStartTimestamp)}`,
        `**Fin** : ${timestampLabel(event.scheduledEndTimestamp)}`,
        `**Salon** : ${event.channel || 'Externe / Aucun'}`,
      ]),
    });
  },
};
