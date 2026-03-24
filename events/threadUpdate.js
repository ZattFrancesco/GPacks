const { sendLog, DEFAULT_COLORS, lines } = require('../src/utils/discordLogs');

module.exports = {
  name: 'threadUpdate',
  once: false,
  async execute(client, oldThread, newThread) {
    if (!newThread?.guild?.id) return;
    const changes = [];
    if (oldThread.name !== newThread.name) changes.push(`**Nom** : ${oldThread.name} → ${newThread.name}`);
    if (oldThread.archived !== newThread.archived) changes.push(`**Archivé** : ${oldThread.archived ? 'Oui' : 'Non'} → ${newThread.archived ? 'Oui' : 'Non'}`);
    if (oldThread.locked !== newThread.locked) changes.push(`**Verrouillé** : ${oldThread.locked ? 'Oui' : 'Non'} → ${newThread.locked ? 'Oui' : 'Non'}`);
    if (!changes.length) return;

    await sendLog(client, newThread.guild.id, {
      color: DEFAULT_COLORS.warning,
      title: '🛠️ Thread mis à jour',
      description: lines([
        `**Thread** : ${newThread}`,
        ...changes,
      ]),
    });
  },
};
