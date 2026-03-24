const { sendLog, DEFAULT_COLORS, lines } = require('../src/utils/discordLogs');

module.exports = {
  name: 'threadDelete',
  once: false,
  async execute(client, thread) {
    if (!thread?.guild?.id) return;
    await sendLog(client, thread.guild.id, {
      type: 'thread_delete',
      color: DEFAULT_COLORS.danger,
      title: '🗑️ Thread supprimé',
      description: lines([
        `**Nom** : ${thread.name}`,
        `**Parent** : ${thread.parent?.name || thread.parentId || '—'}`,
        `**ID** : \`${thread.id}\``,
      ]),
    });
  },
};
