const { sendLog, DEFAULT_COLORS, lines } = require('../src/utils/discordLogs');

module.exports = {
  name: 'stickerUpdate',
  once: false,
  async execute(client, oldSticker, newSticker) {
    if (!newSticker?.guild?.id) return;
    const changes = [];
    if (oldSticker.name !== newSticker.name) changes.push(`**Nom** : ${oldSticker.name} → ${newSticker.name}`);
    if (oldSticker.description !== newSticker.description) changes.push(`**Description** : ${oldSticker.description || 'Aucune'} → ${newSticker.description || 'Aucune'}`);
    if (!changes.length) return;

    await sendLog(client, newSticker.guild.id, {
      color: DEFAULT_COLORS.warning,
      title: '🛠️ Sticker mis à jour',
      description: lines(changes),
    });
  },
};
