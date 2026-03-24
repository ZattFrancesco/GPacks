const { sendLog, DEFAULT_COLORS, userLabel, lines, timestampLabel, resolveAuditEntry, AuditLogEvent } = require('../src/utils/discordLogs');

module.exports = {
  name: 'guildMemberRemove',
  once: false,
  async execute(client, member) {
    const kickEntry = await resolveAuditEntry(
      member.guild,
      AuditLogEvent.MemberKick,
      member.id,
      (entry) => String(entry.executorId || entry.executor?.id || '') !== String(member.id)
    );

    await sendLog(client, member.guild.id, {
      type: 'guild_member_remove',
      color: kickEntry ? DEFAULT_COLORS.danger : DEFAULT_COLORS.warning,
      title: kickEntry ? '🥾 Membre expulsé' : '📤 Membre parti',
      description: lines([
        `**Membre** : ${userLabel(member.user)}`,
        `**A rejoint le serveur** : ${timestampLabel(member.joinedTimestamp)}`,
        kickEntry?.executor ? `**Par** : ${userLabel(kickEntry.executor)}` : null,
        kickEntry?.reason ? `**Raison** : ${kickEntry.reason}` : null,
        `**Nombre de membres** : **${member.guild.memberCount}**`,
      ]),
      thumbnail: member.user.displayAvatarURL?.(),
    });
  },
};
