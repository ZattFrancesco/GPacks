const { sendLog, DEFAULT_COLORS, userLabel, lines } = require('../src/utils/discordLogs');

module.exports = {
  name: 'guildMemberAdd',
  once: false,
  async execute(client, member) {
    await sendLog(client, member.guild.id, {
      color: DEFAULT_COLORS.success,
      title: '📥 Membre rejoint',
      description: lines([
        `**Membre** : ${userLabel(member.user)}`,
        `**Compte créé** : <t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`,
        `**Membres** : **${member.guild.memberCount}**`,
      ]),
      thumbnail: member.user.displayAvatarURL?.(),
    });
  },
};
