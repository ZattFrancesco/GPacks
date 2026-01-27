// src/utils/pointeuseLogs.js
const { EmbedBuilder } = require("discord.js");
const pointeuseDb = require("../../services/pointeuse.db");
const { formatHmFromMinutes } = require("./pointeuseView");

async function sendLog(client, guildId, embed) {
  const settings = await pointeuseDb.getSettings(guildId);
  const channelId = settings?.logs_channel_id;
  if (!channelId) return;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;
  await channel.send({ embeds: [embed] }).catch(() => null);
}

function buildClockLog({ userId, weekId, minutes }) {
  return new EmbedBuilder()
    .setTitle("Pointage")
    .setDescription(`Membre: <@${userId}>\nDurée: **${formatHmFromMinutes(minutes)}**\nSemaine: **${weekId}**`)
    .setTimestamp(new Date());
}

function buildAdjustLog({ targetUserId, weekId, minutes, action, staffId, reason }) {
  return new EmbedBuilder()
    .setTitle("Ajustement staff")
    .setDescription(
      `Membre: <@${targetUserId}>\nAction: **${action}**\nDurée: **${formatHmFromMinutes(minutes)}**\nSemaine: **${weekId}**\nPar: <@${staffId}>\nRaison: ${reason}`
    )
    .setTimestamp(new Date());
}

function buildResetLog({ fromWeekId, toWeekId, staffId }) {
  return new EmbedBuilder()
    .setTitle("Reset semaine")
    .setDescription(
      `Par: <@${staffId}>\nAncienne semaine: **${fromWeekId}**\nNouvelle semaine: **${toWeekId}**`
    )
    .setTimestamp(new Date());
}

module.exports = {
  sendLog,
  buildClockLog,
  buildAdjustLog,
  buildResetLog,
};
