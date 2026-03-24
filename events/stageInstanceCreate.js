const { sendLog, DEFAULT_COLORS, lines } = require('../src/utils/discordLogs');

module.exports = {
  name: 'stageInstanceCreate',
  once: false,
  async execute(client, stageInstance) {
    if (!stageInstance?.guildId) return;
    await sendLog(client, stageInstance.guildId, {
      type: 'stage_instance_create',
      color: DEFAULT_COLORS.success,
      title: '🎭 Stage créé',
      description: lines([
        `**Salon** : <#${stageInstance.channelId}>`,
        `**Topic** : ${stageInstance.topic || 'Aucun'}`,
      ]),
    });
  },
};
