const { sendLog, DEFAULT_COLORS, lines } = require('../src/utils/discordLogs');

module.exports = {
  name: 'channelCreate',
  once: false,
  async execute(client, channel) {
    if (!channel?.guild?.id) return;
    await sendLog(client, channel.guild.id, {
      color: DEFAULT_COLORS.success,
      title: '🆕 Salon créé',
      description: lines([
        `**Salon** : ${channel}`,
        `**Nom** : ${channel.name || '—'}`,
        `**Type** : \`${channel.type}\``,
        `**ID** : \`${channel.id}\``,
      ]),
    });
  },
};
