const { sendLog, DEFAULT_COLORS, userLabel, channelLabel, lines } = require('../src/utils/discordLogs');
const logger = require('../src/utils/logger');
const { isModmailThread, reactToMessage } = require('../src/utils/modmail');
const { isOwner } = require('../src/utils/permissions');
const { getByThreadMsg, getByDmMsg } = require('../services/modmailMap.db');

module.exports = {
  name: 'messageReactionAdd',
  once: false,
  async execute(client, reaction, user) {
    try {
      if (reaction?.partial) await reaction.fetch().catch(() => null);
      if (user?.partial) await user.fetch().catch(() => null);
    } catch {}
    const message = reaction?.message;
    if (!message || user?.bot) return;

    // Le bot lui-même ne relaie pas ses propres réactions (sinon boucle infinie).
    if (user.id === client.user.id) return;

    const emojiKey = reaction.emoji?.id
      ? reaction.emoji.id              // emoji custom (peut ne pas marcher en DM si pas accessible)
      : reaction.emoji?.name;          // emoji unicode

    // ---- Cas 1 : user réagit côté DM → relayer côté thread
    if (!message.guildId) {
      const mapping = await getByDmMsg(message.id);
      if (mapping) {
        await reactToMessage(client, {
          channelId: mapping.thread_id,
          messageId: mapping.thread_msg_id,
          emoji: emojiKey,
          add: true,
        }).catch((err) => logger.warn(`Modmail react relay (DM→thread) fail: ${err?.message || err}`));
      }
      return;
    }

    // ---- Cas 2 : owner réagit dans le thread modmail → relayer côté DM
    if (isModmailThread(message.channel) && isOwner(user.id)) {
      const mapping = await getByThreadMsg(message.id);
      if (mapping) {
        await reactToMessage(client, {
          channelId: mapping.dm_channel_id,
          messageId: mapping.dm_msg_id,
          emoji: emojiKey,
          add: true,
        }).catch((err) => logger.warn(`Modmail react relay (thread→DM) fail: ${err?.message || err}`));
      }
      return;
    }

    // ---- Log par défaut
    if (!message.guildId) return;
    await sendLog(client, message.guildId, {
      type: 'message_reaction_add',
      color: DEFAULT_COLORS.info,
      title: '➕ Réaction ajoutée',
      description: lines([
        `**Utilisateur** : ${userLabel(user)}`,
        `**Salon** : ${channelLabel(message.channel)}`,
        `**Emoji** : ${reaction.emoji?.toString?.() || reaction.emoji?.name || '—'}`,
        `**Message ID** : \`${message.id}\``,
      ]),
    });
  },
};
