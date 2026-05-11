const { sendLog, DEFAULT_COLORS, channelLabel, lines } = require('../src/utils/discordLogs');
const logger = require('../src/utils/logger');
const { isModmailThread, setPinDmMessage } = require('../src/utils/modmail');
const { getByThreadMsg } = require('../services/modmailMap.db');

// Cache en mémoire des pins par channel : channelId → Set<messageId>.
// Permet de diff entre deux events pour savoir QUEL message a été (dés)épinglé.
const pinsCache = new Map();

async function syncPinsAndDiff(channel) {
  const prev = pinsCache.get(channel.id) || new Set();
  let current;
  try {
    const pinned = await channel.messages.fetchPinned();
    current = new Set(pinned.keys());
  } catch {
    return { added: [], removed: [] };
  }
  const added = [...current].filter((id) => !prev.has(id));
  const removed = [...prev].filter((id) => !current.has(id));
  pinsCache.set(channel.id, current);
  return { added, removed };
}

module.exports = {
  name: 'channelPinsUpdate',
  once: false,
  async execute(client, channel, time) {
    // ---- Miroir épinglage : thread modmail → DM côté user
    if (isModmailThread(channel)) {
      const { added, removed } = await syncPinsAndDiff(channel);

      for (const msgId of added) {
        const mapping = await getByThreadMsg(msgId);
        if (mapping) {
          await setPinDmMessage(client, {
            dmChannelId: mapping.dm_channel_id,
            dmMsgId: mapping.dm_msg_id,
            pin: true,
          }).catch((err) => logger.warn(`Modmail pin sync (add) fail: ${err?.message || err}`));
        }
      }

      for (const msgId of removed) {
        const mapping = await getByThreadMsg(msgId);
        if (mapping) {
          await setPinDmMessage(client, {
            dmChannelId: mapping.dm_channel_id,
            dmMsgId: mapping.dm_msg_id,
            pin: false,
          }).catch((err) => logger.warn(`Modmail pin sync (remove) fail: ${err?.message || err}`));
        }
      }
      return;
    }

    // ---- Log par défaut
    if (!channel?.guild?.id) return;
    await sendLog(client, channel.guild.id, {
      type: 'channel_pins_update',
      color: DEFAULT_COLORS.info,
      title: '📌 Pins mis à jour',
      description: lines([
        `**Salon** : ${channelLabel(channel)}`,
        `**Dernière mise à jour** : ${time ? `<t:${Math.floor(new Date(time).getTime() / 1000)}:F>` : '—'}`,
      ]),
    });
  },
};
