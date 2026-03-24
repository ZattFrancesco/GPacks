const { sendLog, DEFAULT_COLORS, lines, resolveAuditEntry, AuditLogEvent } = require('../src/utils/discordLogs');

module.exports = {
  name: 'channelDelete',
  once: false,
  async execute(client, channel) {
    if (!channel?.guild?.id) return;
    const entry = await resolveAuditEntry(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
    await sendLog(client, channel.guild.id, {
      color: DEFAULT_COLORS.danger,
      title: '🗑️ Salon supprimé',
      description: lines([
        `**Nom** : ${channel.name || '—'}`,
        `**Type** : \`${channel.type}\``,
        `**ID** : \`${channel.id}\``,
        entry?.executor ? `**Par** : ${entry.executor.tag} (\`${entry.executor.id}\`)` : null,
        entry?.reason ? `**Raison** : ${entry.reason}` : null,
      ]),
    });
  },
};
