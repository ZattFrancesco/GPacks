const { sendLog, DEFAULT_COLORS, lines } = require('../src/utils/discordLogs');

module.exports = {
  name: 'stageInstanceDelete',
  once: false,
  async execute(client, stageInstance) {
    if (!stageInstance?.guildId) return;
    await sendLog(client, stageInstance.guildId, {
      color: DEFAULT_COLORS.danger,
      title: '🗑️ Stage supprimé',
      description: lines([
        `**Salon** : <#${stageInstance.channelId}>`,
        `**Topic** : ${stageInstance.topic || 'Aucun'}`,
      ]),
    });
  },
};
