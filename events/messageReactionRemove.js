const { sendLog, DEFAULT_COLORS, userLabel, channelLabel, lines } = require('../src/utils/discordLogs');

module.exports = {
  name: 'messageReactionRemove',
  once: false,
  async execute(client, reaction, user) {
    try {
      if (reaction?.partial) await reaction.fetch().catch(() => null);
      if (user?.partial) await user.fetch().catch(() => null);
    } catch {}
    const message = reaction?.message;
    if (!message?.guildId || user?.bot) return;

    await sendLog(client, message.guildId, {
      color: DEFAULT_COLORS.warning,
      title: '➖ Réaction retirée',
      description: lines([
        `**Utilisateur** : ${userLabel(user)}`,
        `**Salon** : ${channelLabel(message.channel)}`,
        `**Emoji** : ${reaction.emoji?.toString?.() || reaction.emoji?.name || '—'}`,
        `**Message ID** : \`${message.id}\``,
      ]),
    });
  },
};
