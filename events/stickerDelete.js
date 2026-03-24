const { sendLog, DEFAULT_COLORS, lines } = require('../src/utils/discordLogs');

module.exports = {
  name: 'stickerDelete',
  once: false,
  async execute(client, sticker) {
    if (!sticker?.guild?.id) return;
    await sendLog(client, sticker.guild.id, {
      color: DEFAULT_COLORS.danger,
      title: '🗑️ Sticker supprimé',
      description: lines([
        `**Nom** : ${sticker.name}`,
        `**ID** : \`${sticker.id}\``,
      ]),
    });
  },
};
