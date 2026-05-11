const { sendLog, DEFAULT_COLORS, userLabel, channelLabel, lines, trim } = require('../src/utils/discordLogs');
const logger = require('../src/utils/logger');
const {
  isModmailThread,
  editWebhookMessage,
  editDmMessage,
  buildReplyQuote,
} = require('../src/utils/modmail');
const { isOwner } = require('../src/utils/permissions');
const { getByThreadMsg, getByDmMsg } = require('../services/modmailMap.db');

module.exports = {
  name: 'messageUpdate',
  once: false,
  async execute(client, oldMessage, newMessage) {
    if (!newMessage) return;

    // Partial → on tente de fetch.
    try {
      if (newMessage.partial) await newMessage.fetch().catch(() => null);
    } catch {}
    if (newMessage.author?.bot) return;
    if (newMessage.webhookId) return; // pas relayer les édits du webhook lui-même

    const before = String(oldMessage?.content || '');
    const after = String(newMessage?.content || '');
    if (before === after) return;

    // ---- Cas 1 : user édite son DM → mettre à jour le webhook côté thread
    if (!newMessage.guildId) {
      const mapping = await getByDmMsg(newMessage.id);
      if (mapping && mapping.direction === 'incoming') {
        // Reconstruire la quote si reply.
        let quote = '';
        if (newMessage.reference?.messageId) {
          const referenced = await newMessage.channel.messages
            .fetch(newMessage.reference.messageId)
            .catch(() => null);
          if (referenced) quote = buildReplyQuote(referenced);
        }
        const finalContent = quote + (after || '');
        await editWebhookMessage(client, {
          threadId: mapping.thread_id,
          messageId: mapping.thread_msg_id,
          content: finalContent + '\n*— édité*',
        }).catch((err) => logger.warn(`Modmail edit webhook fail: ${err?.message || err}`));
      }
      return;
    }

    // ---- Cas 2 : owner édite son message dans le thread → mettre à jour le DM
    if (isModmailThread(newMessage.channel) && isOwner(newMessage.author.id)) {
      const mapping = await getByThreadMsg(newMessage.id);
      if (mapping && mapping.direction === 'outgoing') {
        await editDmMessage(client, {
          dmChannelId: mapping.dm_channel_id,
          dmMsgId: mapping.dm_msg_id,
          content: after,
        }).catch((err) => logger.warn(`Modmail edit DM fail: ${err?.message || err}`));
      }
      // Pas de log Discord pour ces édits-là (pollue le canal de logs).
      return;
    }

    // ---- Cas par défaut : log Discord (comportement existant)
    if (!newMessage.guildId) return;
    await sendLog(client, newMessage.guildId, {
      type: 'message_update',
      color: DEFAULT_COLORS.warning,
      title: '✏️ Message modifié',
      description: lines([
        `**Auteur** : ${userLabel(newMessage.author)}`,
        `**Salon** : ${channelLabel(newMessage.channel)}`,
        `**Message ID** : \`${newMessage.id}\``,
        newMessage.url ? `[Aller au message](${newMessage.url})` : null,
      ]),
      fields: [
        { name: 'Avant', value: trim(before || '*Vide*', 1024) },
        { name: 'Après', value: trim(after || '*Vide*', 1024) },
      ],
    });
  },
};
