// src/utils/pointeuseMessages.js
const pointeuseDb = require("../../services/pointeuse.db");
const { buildPanelMessage, buildRecapMessage } = require("./pointeuseView");
const { getIsoWeekId } = require("./pointeuseWeek");

async function ensureActiveWeek(guildId) {
  const s = (await pointeuseDb.getSettings(guildId)) || null;
  if (s?.active_week_id) return s.active_week_id;
  const weekId = getIsoWeekId(new Date());
  await pointeuseDb.setActiveWeekId(guildId, weekId);
  return weekId;
}

async function publishOrUpdatePanel(client, guildId) {
  const settings = await pointeuseDb.getSettings(guildId);
  const channelId = settings?.panel_channel_id;
  if (!channelId) throw new Error("Panel channel non configuré");

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) throw new Error("Panel channel introuvable");

  const payload = buildPanelMessage();

  // Update if exists
  if (settings?.panel_message_id) {
    const msg = await channel.messages.fetch(settings.panel_message_id).catch(() => null);
    if (msg) {
      await msg.edit(payload);
      return { channelId, messageId: msg.id, updated: true };
    }
  }

  const sent = await channel.send(payload);
  await pointeuseDb.setPanelMessage(guildId, channel.id, sent.id);
  return { channelId: channel.id, messageId: sent.id, updated: false };
}

async function publishOrUpdateRecap(client, guildId, weekIdOverride = null) {
  const settings = await pointeuseDb.getSettings(guildId);
  const channelId = settings?.recap_channel_id;
  if (!channelId) throw new Error("Recap channel non configuré");

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) throw new Error("Recap channel introuvable");

  const weekId = weekIdOverride || (await ensureActiveWeek(guildId));
  const totals = await pointeuseDb.getTotalsForWeek(guildId, weekId);
  const payload = buildRecapMessage({ weekId, totals });

  if (settings?.recap_message_id) {
    const msg = await channel.messages.fetch(settings.recap_message_id).catch(() => null);
    if (msg) {
      await msg.edit(payload);
      return { channelId, messageId: msg.id, updated: true, weekId };
    }
  }

  const sent = await channel.send(payload);
  await pointeuseDb.setRecapMessage(guildId, channel.id, sent.id);
  return { channelId: channel.id, messageId: sent.id, updated: false, weekId };
}

module.exports = {
  ensureActiveWeek,
  publishOrUpdatePanel,
  publishOrUpdateRecap,
};
