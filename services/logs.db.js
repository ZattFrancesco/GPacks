// services/logs.db.js
// Central logs config + audit journal (per guild)

const { query } = require("./db");

let ensured = false;

const LEVELS = ["INFO", "WARN", "ERROR"];

function clampLevel(lvl) {
  const s = String(lvl || "INFO").toUpperCase();
  return LEVELS.includes(s) ? s : "INFO";
}

function defaultModules() {
  return {
    DEFCON: true,
    RAPPORTS: true,
    TICKETS: true,
    VISAS: true,
    PLANNING: true,
    BLACKLIST: true,
  };
}

async function ensureTables() {
  if (ensured) return;
  ensured = true;

  await query(`
    CREATE TABLE IF NOT EXISTS doj_logs_config (
      guild_id VARCHAR(32) NOT NULL,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      channel_id VARCHAR(32) NULL,
      min_level ENUM('INFO','WARN','ERROR') NOT NULL DEFAULT 'INFO',
      modules_json TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (guild_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS doj_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      guild_id VARCHAR(32) NOT NULL,
      level ENUM('INFO','WARN','ERROR') NOT NULL DEFAULT 'INFO',
      module VARCHAR(32) NOT NULL,
      action VARCHAR(64) NOT NULL,
      user_id VARCHAR(32) NULL,
      source_channel_id VARCHAR(32) NULL,
      message VARCHAR(1024) NOT NULL,
      meta_json TEXT NULL,
      PRIMARY KEY (id),
      INDEX idx_guild_time (guild_id, created_at),
      INDEX idx_guild_module (guild_id, module)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Soft migration: ensure modules_json is not NULL
  const r = await query(
    `SELECT COUNT(*) AS c
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'doj_logs_config'
       AND COLUMN_NAME = 'modules_json'`
  );
  if (Number(r?.[0]?.c || 0) === 0) {
    await query(`ALTER TABLE doj_logs_config ADD COLUMN modules_json TEXT NOT NULL`);
  }
}

async function getConfig(guildId) {
  await ensureTables();
  const gid = String(guildId);
  const rows = await query(
    `SELECT guild_id, enabled, channel_id, min_level, modules_json
     FROM doj_logs_config WHERE guild_id = ?`,
    [gid]
  );
  if (rows?.[0]) {
    const row = rows[0];
    let mods = null;
    try { mods = JSON.parse(row.modules_json || "{}"); } catch { mods = {}; }
    return {
      guildId: row.guild_id,
      enabled: Boolean(row.enabled),
      channelId: row.channel_id || null,
      minLevel: clampLevel(row.min_level),
      modules: { ...defaultModules(), ...(mods || {}) },
    };
  }

  // create default
  const cfg = {
    guildId: gid,
    enabled: true,
    channelId: null,
    minLevel: "INFO",
    modules: defaultModules(),
  };
  await upsertConfig(cfg);
  return cfg;
}

async function upsertConfig({ guildId, enabled, channelId, minLevel, modules }) {
  await ensureTables();
  const gid = String(guildId);
  const mods = { ...defaultModules(), ...(modules || {}) };

  await query(
    `INSERT INTO doj_logs_config (guild_id, enabled, channel_id, min_level, modules_json)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       enabled = VALUES(enabled),
       channel_id = VALUES(channel_id),
       min_level = VALUES(min_level),
       modules_json = VALUES(modules_json)`,
    [
      gid,
      enabled ? 1 : 0,
      channelId ? String(channelId) : null,
      clampLevel(minLevel),
      JSON.stringify(mods),
    ]
  );
  return true;
}

function levelRank(lvl) {
  const s = clampLevel(lvl);
  if (s === "INFO") return 1;
  if (s === "WARN") return 2;
  return 3; // ERROR
}

async function shouldLog(guildId, moduleName, level) {
  const cfg = await getConfig(guildId);
  if (!cfg.enabled) return { ok: false, cfg };
  const mod = String(moduleName || "").toUpperCase();
  if (!cfg.modules?.[mod]) return { ok: false, cfg };
  if (levelRank(level) < levelRank(cfg.minLevel)) return { ok: false, cfg };
  return { ok: true, cfg };
}

async function insertLog({
  guildId,
  level = "INFO",
  module = "SYSTEM",
  action = "EVENT",
  userId = null,
  sourceChannelId = null,
  message = "",
  meta = null,
}) {
  await ensureTables();
  const res = await query(
    `INSERT INTO doj_logs (guild_id, level, module, action, user_id, source_channel_id, message, meta_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      String(guildId),
      clampLevel(level),
      String(module).toUpperCase().slice(0, 32),
      String(action).toUpperCase().slice(0, 64),
      userId ? String(userId) : null,
      sourceChannelId ? String(sourceChannelId) : null,
      String(message || "").slice(0, 1024),
      meta ? JSON.stringify(meta).slice(0, 65000) : null,
    ]
  );
  return res?.insertId || null;
}

module.exports = {
  ensureTables,
  getConfig,
  upsertConfig,
  shouldLog,
  insertLog,
  clampLevel,
  defaultModules,
  levelRank,
};
