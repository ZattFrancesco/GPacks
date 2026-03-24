const { sendLog, DEFAULT_COLORS, lines } = require('../src/utils/discordLogs');

module.exports = {
  name: 'guildEmojiUpdate',
  once: false,
  async execute(client, oldEmoji, newEmoji) {
    if (oldEmoji.name === newEmoji.name) return;
    await sendLog(client, newEmoji.guild.id, {
      color: DEFAULT_COLORS.warning,
      title: '🛠️ Emoji mis à jour',
      description: lines([
        `**Emoji** : ${newEmoji}`,
        `**Nom** : ${oldEmoji.name} → ${newEmoji.name}`,
        `**ID** : \`${newEmoji.id}\``,
      ]),
      thumbnail: newEmoji.imageURL(),
    });
  },
};
