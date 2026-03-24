const { sendLog, DEFAULT_COLORS, lines } = require('../src/utils/discordLogs');

module.exports = {
  name: 'guildEmojiDelete',
  once: false,
  async execute(client, emoji) {
    await sendLog(client, emoji.guild.id, {
      type: 'guild_emoji_delete',
      color: DEFAULT_COLORS.danger,
      title: '🗑️ Emoji supprimé',
      description: lines([
        `**Nom** : ${emoji.name}`,
        `**ID** : \`${emoji.id}\``,
      ]),
    });
  },
};
