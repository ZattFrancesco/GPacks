const { sendLog, DEFAULT_COLORS, userLabel, lines, resolveAuditExecutor, AuditLogEvent } = require('../src/utils/discordLogs');

module.exports = {
  name: 'guildBanAdd',
  once: false,
  async execute(client, ban) {
    const executor = await resolveAuditExecutor(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
    await sendLog(client, ban.guild.id, {
      color: DEFAULT_COLORS.danger,
      title: '🔨 Membre banni',
      description: lines([
        `**Membre** : ${userLabel(ban.user)}`,
        `**Par** : ${userLabel(executor)}`,
      ]),
      thumbnail: ban.user.displayAvatarURL?.(),
    });
  },
};
