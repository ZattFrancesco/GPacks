const { sendLog, DEFAULT_COLORS, lines } = require('../src/utils/discordLogs');

module.exports = {
  name: 'messageDeleteBulk',
  once: false,
  async execute(client, messages, channel) {
    const first = messages?.first?.();
    const guildId = first?.guildId || channel?.guild?.id;
    if (!guildId) return;

    await sendLog(client, guildId, {
      color: DEFAULT_COLORS.danger,
      title: '🧹 Suppression massive de messages',
      description: lines([
        `**Salon** : ${channel}`,
        `**Total supprimé** : **${messages?.size || 0}**`,
      ]),
    });
  },
};
