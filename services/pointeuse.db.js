// services/pointeuse.db.js
const { query } = require("./db");

let ensured = false;

async function ensureTables() {
  if (ensured) return;

  // Settings (IDs Discord stockés en VARCHAR pour éviter toute perte de précision)
  await query(`
    CREATE TABLE IF NOT EXISTS pointeuse_settings (
      guild_id BIGINT UNSIGNED PRIMARY KEY,

      panel_channel_id VARCHAR(32) NULL,
      panel_message_id VARCHAR(32) NULL,

      recap_channel_id VARCHAR(32) NULL,
      recap_message_id VARCHAR(32) NULL,

      logs_channel_id VARCHAR(32) NULL,

      staff_roles_json TEXT NULL,

      active_week_id VARCHAR(12) NULL,

      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS pointeuse_entries (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

      guild_id BIGINT UNSIGNED NOT NULL,
      week_id VARCHAR(12) NOT NULL,

      user_id VARCHAR(32) NOT NULL,

      minutes INT NOT NULL,
      entry_type ENUM('clock','adjust') NOT NULL DEFAULT 'clock',

      created_by VARCHAR(32) NOT NULL,
      reason TEXT NULL,

      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      INDEX idx_week (guild_id, week_id),
      INDEX idx_user (guild_id, user_id),
      INDEX idx_user_time (guild_id, user_id, created_at)
    )
  `);

  ensured = true;
}

function safeJsonParse(str, fallback) {
  try {
    const v = JSON.parse(str);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

async function getSettings(guildId) {
  await ensureTables();
  const rows = await query(
    `SELECT * FROM pointeuse_settings WHERE guild_id = ?`,
    [String(guildId)]
  );
  const s = rows[0] || null;
  if (!s) return null;

  return {
    guild_id: String(s.guild_id),
    panel_channel_id: s.panel_channel_id || null,
    panel_message_id: s.panel_message_id || null,
    recap_channel_id: s.recap_channel_id || null,
    recap_message_id: s.recap_message_id || null,
    logs_channel_id: s.logs_channel_id || null,
    staff_roles: Array.isArray(safeJsonParse(s.staff_roles_json, []))
      ? safeJsonParse(s.staff_roles_json, [])
      : [],
    active_week_id: s.active_week_id || null,
  };
}

async function ensureSettingsRow(guildId) {
  await ensureTables();
  await query(
    `INSERT IGNORE INTO pointeuse_settings (guild_id) VALUES (?)`,
    [String(guildId)]
  );
}

async function setPanelChannel(guildId, channelId) {
  await ensureSettingsRow(guildId);
  await query(
    `UPDATE pointeuse_settings SET panel_channel_id = ? WHERE guild_id = ?`,
    [channelId ? String(channelId) : null, String(guildId)]
  );
}

async function setRecapChannel(guildId, channelId) {
  await ensureSettingsRow(guildId);
  await query(
    `UPDATE pointeuse_settings SET recap_channel_id = ? WHERE guild_id = ?`,
    [channelId ? String(channelId) : null, String(guildId)]
  );
}

async function setLogsChannel(guildId, channelId) {
  await ensureSettingsRow(guildId);
  await query(
    `UPDATE pointeuse_settings SET logs_channel_id = ? WHERE guild_id = ?`,
    [channelId ? String(channelId) : null, String(guildId)]
  );
}

async function setStaffRoles(guildId, roleIds) {
  await ensureSettingsRow(guildId);
  const arr = Array.isArray(roleIds) ? roleIds.map(String) : [];
  await query(
    `UPDATE pointeuse_settings SET staff_roles_json = ? WHERE guild_id = ?`,
    [JSON.stringify(arr), String(guildId)]
  );
}

async function setPanelMessage(guildId, channelId, messageId) {
  await ensureSettingsRow(guildId);
  await query(
    `UPDATE pointeuse_settings
     SET panel_channel_id = ?, panel_message_id = ?
     WHERE guild_id = ?`,
    [String(channelId), String(messageId), String(guildId)]
  );
}

async function setRecapMessage(guildId, channelId, messageId) {
  await ensureSettingsRow(guildId);
  await query(
    `UPDATE pointeuse_settings
     SET recap_channel_id = ?, recap_message_id = ?
     WHERE guild_id = ?`,
    [String(channelId), String(messageId), String(guildId)]
  );
}

async function setActiveWeekId(guildId, weekId) {
  await ensureSettingsRow(guildId);
  await query(
    `UPDATE pointeuse_settings SET active_week_id = ? WHERE guild_id = ?`,
    [weekId ? String(weekId) : null, String(guildId)]
  );
}

async function insertEntry({ guildId, weekId, userId, minutes, entryType, createdBy, reason }) {
  await ensureTables();
  await query(
    `INSERT INTO pointeuse_entries (guild_id, week_id, user_id, minutes, entry_type, created_by, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      String(guildId),
      String(weekId),
      String(userId),
      Number(minutes) || 0,
      entryType === "adjust" ? "adjust" : "clock",
      String(createdBy),
      reason ? String(reason) : null,
    ]
  );
}

async function getTotalsForWeek(guildId, weekId) {
  await ensureTables();
  const rows = await query(
    `SELECT user_id, SUM(minutes) AS total_minutes
     FROM pointeuse_entries
     WHERE guild_id = ? AND week_id = ?
     GROUP BY user_id
     ORDER BY total_minutes DESC`,
    [String(guildId), String(weekId)]
  );

  return (rows || []).map((r) => ({
    userId: String(r.user_id),
    totalMinutes: Number(r.total_minutes) || 0,
  }));
}

async function getTotalForUserWeek(guildId, weekId, userId) {
  await ensureTables();
  const rows = await query(
    `SELECT SUM(minutes) AS total_minutes
     FROM pointeuse_entries
     WHERE guild_id = ? AND week_id = ? AND user_id = ?`,
    [String(guildId), String(weekId), String(userId)]
  );
  return Number(rows?.[0]?.total_minutes) || 0;
}

async function getLastEntryAt(guildId, userId) {
  await ensureTables();
  const rows = await query(
    `SELECT created_at
     FROM pointeuse_entries
     WHERE guild_id = ? AND user_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [String(guildId), String(userId)]
  );
  return rows?.[0]?.created_at ? new Date(rows[0].created_at) : null;
}

module.exports = {
  ensureTables,
  getSettings,
  ensureSettingsRow,
  setPanelChannel,
  setRecapChannel,
  setLogsChannel,
  setStaffRoles,
  setPanelMessage,
  setRecapMessage,
  setActiveWeekId,
  insertEntry,
  getTotalsForWeek,
  getTotalForUserWeek,
  getLastEntryAt,
};
