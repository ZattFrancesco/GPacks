const { sendLog, DEFAULT_COLORS, lines } = require('../src/utils/discordLogs');

module.exports = {
  name: 'guildEmojiCreate',
  once: false,
  async execute(client, emoji) {
    await sendLog(client, emoji.guild.id, {
      type: 'guild_emoji_create',
      color: DEFAULT_COLORS.success,
      title: '😀 Emoji créé',
      description: lines([
        `**Emoji** : ${emoji}`,
        `**Nom** : ${emoji.name}`,
        `**ID** : \`${emoji.id}\``,
      ]),
      thumbnail: emoji.imageURL?.(),
    });
  },
};
