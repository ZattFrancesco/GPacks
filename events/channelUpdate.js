const {
  sendLog,
  DEFAULT_COLORS,
  lines,
  trim,
  diffOverwriteMaps,
  resolveAuditEntry,
  AuditLogEvent,
} = require('../src/utils/discordLogs');

module.exports = {
  name: 'channelUpdate',
  once: false,
  async execute(client, oldChannel, newChannel) {
    if (!newChannel?.guild?.id) return;
    const changes = [];
    const fields = [];

    if (oldChannel.name !== newChannel.name) changes.push(`**Nom** : ${oldChannel.name || '—'} → ${newChannel.name || '—'}`);
    if (oldChannel.topic !== newChannel.topic) changes.push(`**Sujet** : ${oldChannel.topic || 'Aucun'} → ${newChannel.topic || 'Aucun'}`);
    if (oldChannel.parentId !== newChannel.parentId) changes.push(`**Catégorie** : ${oldChannel.parent?.name || 'Aucune'} → ${newChannel.parent?.name || 'Aucune'}`);
    if (oldChannel.nsfw !== newChannel.nsfw) changes.push(`**NSFW** : ${oldChannel.nsfw ? 'Oui' : 'Non'} → ${newChannel.nsfw ? 'Oui' : 'Non'}`);
    if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) changes.push(`**Slowmode** : ${oldChannel.rateLimitPerUser || 0}s → ${newChannel.rateLimitPerUser || 0}s`);
    if (oldChannel.bitrate !== newChannel.bitrate) changes.push(`**Bitrate** : ${oldChannel.bitrate || 0} → ${newChannel.bitrate || 0}`);
    if (oldChannel.userLimit !== newChannel.userLimit) changes.push(`**Limite utilisateurs** : ${oldChannel.userLimit || 0} → ${newChannel.userLimit || 0}`);

    const overwriteChanges = diffOverwriteMaps(oldChannel, newChannel);
    if (overwriteChanges.length) {
      fields.push({ name: 'Permissions modifiées', value: trim(overwriteChanges.join('\n'), 1024) });
    }

    if (!changes.length && !fields.length) return;
    const entry = await resolveAuditEntry(newChannel.guild, AuditLogEvent.ChannelUpdate, newChannel.id);

    await sendLog(client, newChannel.guild.id, {
      color: DEFAULT_COLORS.warning,
      title: '🛠️ Salon mis à jour',
      description: lines([
        `**Salon** : ${newChannel}`,
        entry?.executor ? `**Par** : ${entry.executor.tag} (\`${entry.executor.id}\`)` : null,
        ...changes,
      ]),
      fields,
    });
  },
};
