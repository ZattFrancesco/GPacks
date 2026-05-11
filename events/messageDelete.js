const { sendLog, DEFAULT_COLORS, userLabel, channelLabel, lines, trim } = require('../src/utils/discordLogs');
const logger = require('../src/utils/logger');
const {
  isModmailThread,
  editWebhookMessage,
  editDmMessage,
} = require('../src/utils/modmail');
const { isOwner } = require('../src/utils/permissions');
const { getByThreadMsg, getByDmMsg, deleteByThreadMsg, deleteByDmMsg } = require('../services/modmailMap.db');

module.exports = {
  name: 'messageDelete',
  once: false,
  async execute(client, message) {
    if (!message) return;

    // ---- Cas 1 : user supprime son DM → édit le webhook côté thread en "[supprimé par l'utilisateur]"
    if (!message.guildId) {
      const mapping = await getByDmMsg(message.id);
      if (mapping && mapping.direction === 'incoming') {
        const original = String(message.content || '');
        const tag = '*[Message supprimé par l\'utilisateur]*';
        const newContent = original ? `~~${original}~~\n${tag}` : tag;
        await editWebhookMessage(client, {
          threadId: mapping.thread_id,
          messageId: mapping.thread_msg_id,
          content: newContent,
        }).catch((err) => logger.warn(`Modmail soft-delete (incoming) fail: ${err?.message || err}`));
        // On NE supprime PAS le mapping : on garde la trace si user re-edit/réagit plus tard
        // sur le même message côté DM (cas rare mais possible). Optionnel : à supprimer si tu préfères.
      }
      return;
    }

    // ---- Cas 2 : owner supprime son message dans le thread → édit le DM côté user en "[supprimé par le staff]"
    if (isModmailThread(message.channel)) {
      const mapping = await getByThreadMsg(message.id);
      if (mapping && mapping.direction === 'outgoing') {
        const original = String(message.content || '');
        const tag = '*[Message supprimé par le staff]*';
        const newContent = original ? `~~${original}~~\n${tag}` : tag;
        await editDmMessage(client, {
          dmChannelId: mapping.dm_channel_id,
          dmMsgId: mapping.dm_msg_id,
          content: newContent,
        }).catch((err) => logger.warn(`Modmail soft-delete (outgoing) fail: ${err?.message || err}`));
        await deleteByThreadMsg(message.id);
      }
      return;
    }

    // ---- Cas par défaut : log Discord (comportement existant)
    if (!message.guildId || message.author?.bot) return;
    await sendLog(client, message.guildId, {
      type: 'message_delete',
      color: DEFAULT_COLORS.danger,
      title: '🗑️ Message supprimé',
      description: lines([
        `**Auteur** : ${userLabel(message.author)}`,
        `**Salon** : ${channelLabel(message.channel)}`,
        `**Message ID** : \`${message.id}\``,
      ]),
      fields: [
        { name: 'Contenu', value: trim(message.content || '*Aucun contenu texte*', 1024) },
      ],
    });
  },
};
