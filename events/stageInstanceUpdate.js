const { sendLog, DEFAULT_COLORS, lines } = require('../src/utils/discordLogs');

module.exports = {
  name: 'stageInstanceUpdate',
  once: false,
  async execute(client, oldStage, newStage) {
    if (!newStage?.guildId) return;
    const changes = [];
    if (oldStage.topic !== newStage.topic) changes.push(`**Topic** : ${oldStage.topic || 'Aucun'} → ${newStage.topic || 'Aucun'}`);
    if (oldStage.privacyLevel !== newStage.privacyLevel) changes.push(`**Privacy** : ${oldStage.privacyLevel} → ${newStage.privacyLevel}`);
    if (!changes.length) return;

    await sendLog(client, newStage.guildId, {
      type: 'stage_instance_update',
      color: DEFAULT_COLORS.warning,
      title: '🛠️ Stage mis à jour',
      description: lines([
        `**Salon** : <#${newStage.channelId}>`,
        ...changes,
      ]),
    });
  },
};
