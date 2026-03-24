const { sendLog, DEFAULT_COLORS, userLabel, channelLabel, lines, trim } = require('../src/utils/discordLogs');

module.exports = {
  name: 'messageDelete',
  once: false,
  async execute(client, message) {
    if (!message?.guildId || message?.author?.bot) return;
    await sendLog(client, message.guildId, {
      color: DEFAULT_COLORS.danger,
      title: '🗑️ Message supprimé',
      description: lines([
        `**Auteur** : ${userLabel(message.author)}`,
        `**Salon** : ${channelLabel(message.channel)}`,
        `**Message ID** : \`${message.id}\``,
      ]),
      fields: [
        {
          name: 'Contenu',
          value: trim(message.content || '*Aucun contenu texte*', 1024),
        },
      ],
    });
  },
};
