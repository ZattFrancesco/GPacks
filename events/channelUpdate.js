const { sendLog, DEFAULT_COLORS, lines } = require('../src/utils/discordLogs');

module.exports = {
  name: 'channelUpdate',
  once: false,
  async execute(client, oldChannel, newChannel) {
    if (!newChannel?.guild?.id) return;
    const changes = [];

    if (oldChannel.name !== newChannel.name) changes.push(`**Nom** : ${oldChannel.name} → ${newChannel.name}`);
    if (oldChannel.topic !== newChannel.topic) changes.push(`**Sujet** : ${oldChannel.topic || 'Aucun'} → ${newChannel.topic || 'Aucun'}`);
    if (oldChannel.parentId !== newChannel.parentId) changes.push(`**Catégorie** : ${oldChannel.parent?.name || 'Aucune'} → ${newChannel.parent?.name || 'Aucune'}`);
    if (oldChannel.nsfw !== newChannel.nsfw) changes.push(`**NSFW** : ${oldChannel.nsfw ? 'Oui' : 'Non'} → ${newChannel.nsfw ? 'Oui' : 'Non'}`);
    if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) changes.push(`**Slowmode** : ${oldChannel.rateLimitPerUser || 0}s → ${newChannel.rateLimitPerUser || 0}s`);
    if (!changes.length) return;

    await sendLog(client, newChannel.guild.id, {
      color: DEFAULT_COLORS.warning,
      title: '🛠️ Salon mis à jour',
      description: lines([
        `**Salon** : ${newChannel}`,
        ...changes,
      ]),
    });
  },
};
