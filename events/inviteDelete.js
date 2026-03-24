const { sendLog, DEFAULT_COLORS, lines } = require('../src/utils/discordLogs');

module.exports = {
  name: 'inviteDelete',
  once: false,
  async execute(client, invite) {
    await sendLog(client, invite.guild.id, {
      type: 'invite_delete',
      color: DEFAULT_COLORS.danger,
      title: '❌ Invitation supprimée',
      description: lines([
        `**Code** : \`${invite.code}\``,
        `**Salon** : ${invite.channel || '—'}`,
      ]),
    });
  },
};
