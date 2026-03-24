const { sendLog, DEFAULT_COLORS, userLabel, lines, timestampLabel } = require('../src/utils/discordLogs');

module.exports = {
  name: 'guildMemberAdd',
  once: false,
  async execute(client, member) {
    await sendLog(client, member.guild.id, {
      color: DEFAULT_COLORS.success,
      title: '📥 Membre rejoint',
      description: lines([
        `**Membre** : ${userLabel(member.user)}`,
        `**Compte créé** : ${timestampLabel(member.user.createdTimestamp)}`,
        `**Nombre de membres** : **${member.guild.memberCount}**`,
      ]),
      thumbnail: member.user.displayAvatarURL?.(),
    });
  },
};
