const { sendLog, DEFAULT_COLORS, userLabel, lines } = require('../src/utils/discordLogs');

module.exports = {
  name: 'guildMemberRemove',
  once: false,
  async execute(client, member) {
    await sendLog(client, member.guild.id, {
      color: DEFAULT_COLORS.danger,
      title: '📤 Membre parti',
      description: lines([
        `**Membre** : ${userLabel(member.user)}`,
        `**A rejoint le serveur** : ${member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : '—'}`,
        `**Membres** : **${member.guild.memberCount}**`,
      ]),
      thumbnail: member.user.displayAvatarURL?.(),
    });
  },
};
