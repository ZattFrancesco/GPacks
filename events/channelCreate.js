const { sendLog, DEFAULT_COLORS, lines, resolveAuditEntry, AuditLogEvent, channelLabel } = require('../src/utils/discordLogs');

module.exports = {
  name: 'channelCreate',
  once: false,
  async execute(client, channel) {
    if (!channel?.guild?.id) return;
    const entry = await resolveAuditEntry(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
    await sendLog(client, channel.guild.id, {
      color: DEFAULT_COLORS.success,
      title: '🆕 Salon créé',
      description: lines([
        `**Salon** : ${channelLabel(channel)}`,
        `**Type** : \`${channel.type}\``,
        `**Catégorie** : ${channel.parent || 'Aucune'}`,
        entry?.executor ? `**Par** : ${entry.executor.tag} (\`${entry.executor.id}\`)` : null,
      ]),
    });
  },
};
