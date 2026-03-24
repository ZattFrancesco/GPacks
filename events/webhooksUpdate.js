const { sendLog, DEFAULT_COLORS, lines, channelLabel } = require('../src/utils/discordLogs');

module.exports = {
  name: 'webhooksUpdate',
  once: false,
  async execute(client, channel) {
    if (!channel?.guild?.id) return;
    await sendLog(client, channel.guild.id, {
      type: 'webhooks_update',
      color: DEFAULT_COLORS.warning,
      title: '🪝 Webhooks mis à jour',
      description: lines([
        `**Salon** : ${channelLabel(channel)}`,
        `**ID** : \`${channel.id}\``,
      ]),
    });
  },
};
