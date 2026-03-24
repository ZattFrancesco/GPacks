const { sendLog, DEFAULT_COLORS, userLabel, channelLabel, lines, trim } = require('../src/utils/discordLogs');

module.exports = {
  name: 'messageUpdate',
  once: false,
  async execute(client, oldMessage, newMessage) {
    if (!newMessage?.guildId || newMessage?.author?.bot) return;
    const before = String(oldMessage?.content || '');
    const after = String(newMessage?.content || '');
    if (before === after) return;

    await sendLog(client, newMessage.guildId, {
      type: 'message_update',
      color: DEFAULT_COLORS.warning,
      title: '✏️ Message modifié',
      description: lines([
        `**Auteur** : ${userLabel(newMessage.author)}`,
        `**Salon** : ${channelLabel(newMessage.channel)}`,
        `**Message ID** : \`${newMessage.id}\``,
        newMessage.url ? `[Aller au message](${newMessage.url})` : null,
      ]),
      fields: [
        { name: 'Avant', value: trim(before || '*Vide*', 1024) },
        { name: 'Après', value: trim(after || '*Vide*', 1024) },
      ],
    });
  },
};
