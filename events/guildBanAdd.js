const { sendLog, DEFAULT_COLORS, userLabel, lines, resolveAuditEntry, AuditLogEvent } = require('../src/utils/discordLogs');

module.exports = {
  name: 'guildBanAdd',
  once: false,
  async execute(client, ban) {
    const entry = await resolveAuditEntry(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
    await sendLog(client, ban.guild.id, {
      color: DEFAULT_COLORS.danger,
      title: '🔨 Membre banni',
      description: lines([
        `**Membre** : ${userLabel(ban.user)}`,
        `**Par** : ${userLabel(entry?.executor)}`,
        entry?.reason ? `**Raison** : ${entry.reason}` : null,
      ]),
      thumbnail: ban.user.displayAvatarURL?.(),
    });
  },
};
