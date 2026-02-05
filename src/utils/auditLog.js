// src/utils/auditLog.js
// Central audit logger: DB + optional Discord channel
const { EmbedBuilder } = require("discord.js");
const logsDb = require("../../services/logs.db");
const logger = require("./logger");

const sendQueues = new Map(); // guildId -> Promise chain

function safeStr(v, max = 256) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function nowIso() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function buildEmbed({ level, module, action, message, userId, sourceChannelId, meta }) {
  const e = new EmbedBuilder()
    .setTitle(`[${String(level).toUpperCase()}] ${String(module).toUpperCase()} • ${String(action).toUpperCase()}`)
    .setDescription(safeStr(message, 4000))
    .setTimestamp(new Date());

  // Slight severity color (Discord.js color int)
  if (String(level).toUpperCase() === "ERROR") e.setColor(0xed4245);
  else if (String(level).toUpperCase() === "WARN") e.setColor(0xfee75c);
  else e.setColor(0x5865f2);

  const fields = [];
  if (userId) fields.push({ name: "User", value: `<@${userId}> (${userId})`, inline: true });
  if (sourceChannelId) fields.push({ name: "Source", value: `<#${sourceChannelId}>`, inline: true });

  if (meta && typeof meta === "object") {
    const raw = JSON.stringify(meta, null, 2);
    fields.push({ name: "Meta", value: raw.length > 900 ? "```json\n" + raw.slice(0, 890) + "\n…\n```" : "```json\n" + raw + "\n```", inline: false });
  }

  if (fields.length) e.addFields(fields);
  return e;
}

async function enqueueSend(guildId, fn) {
  const gid = String(guildId);
  const prev = sendQueues.get(gid) || Promise.resolve();
  const next = prev
    .catch(() => {})
    .then(async () => {
      // small spacing to reduce rate-limits when spammy modules
      await new Promise((r) => setTimeout(r, 350));
      return fn();
    });
  sendQueues.set(gid, next);
  return next;
}

/**
 * auditLog(client, interaction?, payload)
 * payload: { module, action, level, message, meta, userId, sourceChannelId }
 */
async function auditLog(client, guildId, payload = {}) {
  try {
    const {
      module = "SYSTEM",
      action = "EVENT",
      level = "INFO",
      message = "",
      meta = null,
      userId = null,
      sourceChannelId = null,
    } = payload;

    const gate = await logsDb.shouldLog(guildId, module, level);
    if (!gate.ok) return { logged: false };

    // 1) DB insert (always if enabled)
    const logId = await logsDb.insertLog({
      guildId,
      level,
      module,
      action,
      userId,
      sourceChannelId,
      message,
      meta,
    });

    // 2) Optional Discord channel
    const chId = gate.cfg?.channelId;
    if (chId && client) {
      await enqueueSend(guildId, async () => {
        try {
          const ch = await client.channels.fetch(chId).catch(() => null);
          if (!ch || !ch.isTextBased?.()) return;

          const embed = buildEmbed({ level, module, action, message, userId, sourceChannelId, meta });
          await ch.send({ embeds: [embed] });
        } catch (err) {
          logger.warn(`auditLog: cannot send to log channel (${chId}) - ${err?.message || err}`);
        }
      });
    }

    return { logged: true, id: logId };
  } catch (err) {
    logger.error(`auditLog error: ${err?.stack || err}`);
    return { logged: false, error: err };
  }
}

module.exports = { auditLog };
