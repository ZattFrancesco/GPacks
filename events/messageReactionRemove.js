const { sendLog, DEFAULT_COLORS, userLabel, channelLabel, lines } = require('../src/utils/discordLogs');
const logger = require('../src/utils/logger');
const { isModmailThread, reactToMessage } = require('../src/utils/modmail');
const { isOwner } = require('../src/utils/permissions');
const { getByThreadMsg, getByDmMsg } = require('../services/modmailMap.db');

module.exports = {
  name: 'messageReactionRemove',
  once: false,
  async execute(client, reaction, user) {
    try {
      if (reaction?.partial) await reaction.fetch().catch(() => null);
      if (user?.partial) await user.fetch().catch(() => null);
    } catch {}
    const message = reaction?.message;
    if (!message || user?.bot) return;
    if (user.id === client.user.id) return;

    const emojiKey = reaction.emoji?.id
      ? reaction.emoji.id
      : reaction.emoji?.name;

    // ---- Cas 1 : user retire sa réaction côté DM → retirer côté thread
    if (!message.guildId) {
      const mapping = await getByDmMsg(message.id);
      if (mapping) {
        await reactToMessage(client, {
          channelId: mapping.thread_id,
          messageId: mapping.thread_msg_id,
          emoji: emojiKey,
          add: false,
        }).catch((err) => logger.warn(`Modmail react remove (DM→thread) fail: ${err?.message || err}`));
      }
      return;
    }

    // ---- Cas 2 : owner retire sa réaction dans le thread → retirer côté DM
    if (isModmailThread(message.channel) && isOwner(user.id)) {
      const mapping = await getByThreadMsg(message.id);
      if (mapping) {
        await reactToMessage(client, {
          channelId: mapping.dm_channel_id,
          messageId: mapping.dm_msg_id,
          emoji: emojiKey,
          add: false,
        }).catch((err) => logger.warn(`Modmail react remove (thread→DM) fail: ${err?.message || err}`));
      }
      return;
    }

    // ---- Log par défaut
    if (!message.guildId) return;
    await sendLog(client, message.guildId, {
      type: 'message_reaction_remove',
      color: DEFAULT_COLORS.warning,
      title: '➖ Réaction retirée',
      description: lines([
        `**Utilisateur** : ${userLabel(user)}`,
        `**Salon** : ${channelLabel(message.channel)}`,
        `**Emoji** : ${reaction.emoji?.toString?.() || reaction.emoji?.name || '—'}`,
        `**Message ID** : \`${message.id}\``,
      ]),
    });
  },
};
