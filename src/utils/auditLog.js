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

const LEVEL_EMOJI = {
  INFO: "ℹ️",
  WARN: "⚠️",
  ERROR: "❌",
};

const MODULE_EMOJI = {
  DEFCON: "🚨",
  RAPPORTS: "📄",
  TICKETS: "🎫",
  VISAS: "🪪",
  PLANNING: "📅",
  BLACKLIST: "⛔",
  SYSTEM: "⚙️",
};

// Optional nice labels for common actions (keeps logs "classiques" and readable)
const ACTION_LABELS = {
  DEFCON: {
    SET_LEVEL: "DEFCON modifié",
    CONFIG_CHANNEL: "Salon DEFCON modifié",
    CONFIG_MESSAGE: "Message DEFCON modifié",
  },
  RAPPORTS: {
    CREATE: "Rapport créé",
    UPDATE: "Rapport modifié",
    DELETE: "Rapport supprimé",
    WEEK_RESET: "Rapports de la semaine réinitialisés",
  },
  TICKETS: {
    OPEN: "Ticket ouvert",
    CLOSE_REQUEST: "Fermeture demandée",
    CLOSE_CONFIRM: "Ticket fermé",
    REOPEN: "Ticket réouvert",
    DELETE: "Ticket supprimé",
    RENAME: "Ticket renommé",
    ADD_MEMBER: "Membre ajouté au ticket",
    REMOVE_MEMBER: "Membre retiré du ticket",
  },
  VISAS: {
    CREATE: "Visa créé",
    UPDATE: "Visa modifié",
    DELETE: "Visa supprimé",
    STATUS_UPDATE: "Statut de visa modifié",
  },
  PLANNING: {
    CREATE_ENTRY: "Entrée ajoutée",
    EDIT_ENTRY: "Entrée modifiée",
    DELETE_ENTRY: "Entrée supprimée",
    WEEK_CHANGE: "Semaine changée",
    CREATE_JUGEMENT: "Jugement ajouté",
    EDIT_JUGEMENT: "Jugement modifié",
    DELETE_JUGEMENT: "Jugement supprimé",
  },
  BLACKLIST: {
    ADD: "Ajout blacklist",
    REMOVE: "Retrait blacklist",
  },
};

function humanizeAction(moduleName, action) {
  const mod = String(moduleName || "SYSTEM").toUpperCase();
  const act = String(action || "EVENT").toUpperCase();
  const known = ACTION_LABELS?.[mod]?.[act];
  if (known) return known;
  // fallback: "SOME_ACTION" -> "Some action"
  const s = act.toLowerCase().replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildEmbed({ level, module, action, message, userId, sourceChannelId }) {
  const lvl = String(level || "INFO").toUpperCase();
  const mod = String(module || "SYSTEM").toUpperCase();

  const levelEmoji = LEVEL_EMOJI[lvl] || "ℹ️";
  const moduleEmoji = MODULE_EMOJI[mod] || "📌";
  const title = `${levelEmoji} ${moduleEmoji} ${humanizeAction(mod, action)}`;

  const e = new EmbedBuilder().setTitle(title).setDescription(safeStr(message, 4000)).setTimestamp(new Date());

  // Slight severity color
  if (lvl === "ERROR") e.setColor(0xed4245);
  else if (lvl === "WARN") e.setColor(0xfee75c);
  else e.setColor(0x5865f2);

  // Logs "classiques": pas d'IDs techniques, pas de JSON.
  const fields = [];
  if (userId) fields.push({ name: "Par", value: `<@${userId}>`, inline: true });
  if (sourceChannelId) fields.push({ name: "Salon", value: `<#${sourceChannelId}>`, inline: true });
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

          const embed = buildEmbed({ level, module, action, message, userId, sourceChannelId });
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
