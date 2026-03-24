const { sendLog, DEFAULT_COLORS, lines, resolveAuditExecutor, AuditLogEvent } = require('../src/utils/discordLogs');

module.exports = {
  name: 'channelDelete',
  once: false,
  async execute(client, channel) {
    if (!channel?.guild?.id) return;
    const executor = await resolveAuditExecutor(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
    await sendLog(client, channel.guild.id, {
      color: DEFAULT_COLORS.danger,
      title: '🗑️ Salon supprimé',
      description: lines([
        `**Nom** : ${channel.name || '—'}`,
        `**Type** : \`${channel.type}\``,
        `**ID** : \`${channel.id}\``,
        `**Par** : ${executor ? `${executor.tag} (\`${executor.id}\`)` : '—'}`,
      ]),
    });
  },
};
