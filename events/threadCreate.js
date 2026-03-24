const { sendLog, DEFAULT_COLORS, lines } = require('../src/utils/discordLogs');

module.exports = {
  name: 'threadCreate',
  once: false,
  async execute(client, thread, newlyCreated) {
    if (!thread?.guild?.id || !newlyCreated) return;
    await sendLog(client, thread.guild.id, {
      color: DEFAULT_COLORS.success,
      title: '🧵 Thread créé',
      description: lines([
        `**Thread** : ${thread}`,
        `**Nom** : ${thread.name}`,
        `**Parent** : ${thread.parent || '—'}`,
        `**ID** : \`${thread.id}\``,
      ]),
    });
  },
};
