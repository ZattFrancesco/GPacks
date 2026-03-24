const { sendLog, DEFAULT_COLORS, lines, timestampLabel } = require('../src/utils/discordLogs');

module.exports = {
  name: 'guildScheduledEventUpdate',
  once: false,
  async execute(client, oldEvent, newEvent) {
    if (!newEvent?.guildId) return;
    const changes = [];
    if (oldEvent.name !== newEvent.name) changes.push(`**Nom** : ${oldEvent.name} → ${newEvent.name}`);
    if (oldEvent.description !== newEvent.description) changes.push(`**Description** : ${oldEvent.description || 'Aucune'} → ${newEvent.description || 'Aucune'}`);
    if (oldEvent.status !== newEvent.status) changes.push(`**Statut** : ${oldEvent.status} → ${newEvent.status}`);
    if (oldEvent.scheduledStartTimestamp !== newEvent.scheduledStartTimestamp) changes.push(`**Début** : ${timestampLabel(oldEvent.scheduledStartTimestamp)} → ${timestampLabel(newEvent.scheduledStartTimestamp)}`);
    if (oldEvent.scheduledEndTimestamp !== newEvent.scheduledEndTimestamp) changes.push(`**Fin** : ${timestampLabel(oldEvent.scheduledEndTimestamp)} → ${timestampLabel(newEvent.scheduledEndTimestamp)}`);
    if (!changes.length) return;

    await sendLog(client, newEvent.guildId, {
      color: DEFAULT_COLORS.warning,
      title: '🛠️ Événement planifié mis à jour',
      description: lines(changes),
    });
  },
};
