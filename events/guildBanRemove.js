const { sendLog, DEFAULT_COLORS, userLabel, lines, resolveAuditEntry, AuditLogEvent } = require('../src/utils/discordLogs');

module.exports = {
  name: 'guildBanRemove',
  once: false,
  async execute(client, ban) {
    const entry = await resolveAuditEntry(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);
    await sendLog(client, ban.guild.id, {
      color: DEFAULT_COLORS.success,
      title: '🔓 Ban retiré',
      description: lines([
        `**Membre** : ${userLabel(ban.user)}`,
        `**Par** : ${userLabel(entry?.executor)}`,
      ]),
      thumbnail: ban.user.displayAvatarURL?.(),
    });
  },
};
