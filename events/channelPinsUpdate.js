const { sendLog, DEFAULT_COLORS, channelLabel, lines } = require('../src/utils/discordLogs');

module.exports = {
  name: 'channelPinsUpdate',
  once: false,
  async execute(client, channel, time) {
    if (!channel?.guild?.id) return;
    await sendLog(client, channel.guild.id, {
      type: 'channel_pins_update',
      color: DEFAULT_COLORS.info,
      title: '📌 Pins mis à jour',
      description: lines([
        `**Salon** : ${channelLabel(channel)}`,
        `**Dernière mise à jour** : ${time ? `<t:${Math.floor(new Date(time).getTime() / 1000)}:F>` : '—'}`,
      ]),
    });
  },
};
