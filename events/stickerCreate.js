const { sendLog, DEFAULT_COLORS, lines } = require('../src/utils/discordLogs');

module.exports = {
  name: 'stickerCreate',
  once: false,
  async execute(client, sticker) {
    if (!sticker?.guild?.id) return;
    await sendLog(client, sticker.guild.id, {
      color: DEFAULT_COLORS.success,
      title: '🪄 Sticker créé',
      description: lines([
        `**Nom** : ${sticker.name}`,
        `**ID** : \`${sticker.id}\``,
        `**Description** : ${sticker.description || 'Aucune'}`,
      ]),
    });
  },
};
