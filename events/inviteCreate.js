const { sendLog, DEFAULT_COLORS, lines } = require('../src/utils/discordLogs');

module.exports = {
  name: 'inviteCreate',
  once: false,
  async execute(client, invite) {
    await sendLog(client, invite.guild.id, {
      type: 'invite_create',
      color: DEFAULT_COLORS.success,
      title: '🔗 Invitation créée',
      description: lines([
        `**Code** : \`${invite.code}\``,
        `**Salon** : ${invite.channel || '—'}`,
        `**Créée par** : ${invite.inviter ? `${invite.inviter.tag} (\`${invite.inviter.id}\`)` : '—'}`,
        `**Max uses** : ${invite.maxUses || '∞'}`,
        `**Expire** : ${invite.expiresTimestamp ? `<t:${Math.floor(invite.expiresTimestamp / 1000)}:F>` : 'Jamais'}`,
      ]),
    });
  },
};
