// services/internalPlanning.db.js
const { query } = require("./db");

let ensured = false;

async function ensureTables() {
  if (ensured) return;

  await query(`
    CREATE TABLE IF NOT EXISTS internal_planning_entries (
      id_entry INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      guild_id BIGINT UNSIGNED NOT NULL,

      -- semaine de rattachement (utile même si pas de date: type OTHER)
      week_monday DATE NOT NULL,

      type VARCHAR(20) NOT NULL, -- TRAINING | APPOINTMENT | MEETING | OTHER

      event_datetime DATETIME NULL,

      -- APPOINTMENT
      person_firstname VARCHAR(100) NULL,
      person_lastname  VARCHAR(100) NULL,
      concerned_user_ids TEXT NULL, -- ids séparés par virgule

      -- MEETING
      meeting_motif VARCHAR(200) NULL,
      concerned_role_ids TEXT NULL, -- ids séparés par virgule

      -- OTHER
      other_reason TEXT NULL,

      created_by_user_id BIGINT UNSIGNED NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      INDEX idx_internal_planning_week (guild_id, week_monday),
      INDEX idx_internal_planning_datetime (guild_id, event_datetime)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS internal_planning_message (
      guild_id BIGINT UNSIGNED PRIMARY KEY,
      -- Discord IDs = snowflakes -> stockés en texte
      channel_id VARCHAR(32) NOT NULL,
      message_id VARCHAR(32) NOT NULL,
      week_monday DATE NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Migration douce: si une ancienne version existait en BIGINT
  try {
    const cols = await query(
      `SELECT COLUMN_NAME, DATA_TYPE
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'internal_planning_message'
         AND COLUMN_NAME IN ('channel_id', 'message_id')`
    );

    const typeByName = new Map((cols || []).map((c) => [String(c.COLUMN_NAME), String(c.DATA_TYPE).toLowerCase()]));
    const chType = typeByName.get("channel_id");
    const msgType = typeByName.get("message_id");

    if (chType && chType !== "varchar") await query(`ALTER TABLE internal_planning_message MODIFY channel_id VARCHAR(32) NOT NULL`);
    if (msgType && msgType !== "varchar") await query(`ALTER TABLE internal_planning_message MODIFY message_id VARCHAR(32) NOT NULL`);
  } catch (_) {
    // ignore
  }

  ensured = true;
}

function pad2(n) {
  return String(Number(n)).padStart(2, "0");
}

function isValidDateObj(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function normalizeMysqlDate(dateOrStr) {
  if (dateOrStr instanceof Date) {
    const d = new Date(dateOrStr);
    if (!isValidDateObj(d)) return null;
    d.setHours(0, 0, 0, 0);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  const s = String(dateOrStr || "").trim();
  if (!s) return null;
  // attendu: YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function toMysqlDate(dateObj) {
  if (!isValidDateObj(dateObj)) return null;
  const d = new Date(dateObj);
  d.setHours(0, 0, 0, 0);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toMysqlDatetimeFromParts({ year, month, day, hour }) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const h = Number(hour);

  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d) || !Number.isFinite(h)) return null;
  if (y < 2000 || y > 2100) return null;
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;
  if (h < 0 || h > 23) return null;

  return `${y}-${pad2(m)}-${pad2(d)} ${pad2(h)}:00:00`;
}

function getWeekMondayLocal(date = new Date()) {
  const d = new Date(date);
  if (!isValidDateObj(d)) return new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Dim,1=Lun,...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

async function getPlanningMessage(guildId) {
  const rows = await query(`SELECT * FROM internal_planning_message WHERE guild_id = ? LIMIT 1`, [String(guildId)]);
  return rows?.[0] || null;
}

async function upsertPlanningMessage({ guildId, channelId, messageId, weekMonday }) {
  const week = normalizeMysqlDate(weekMonday);
  if (!week) throw new Error("weekMonday invalide");

  await query(
    `INSERT INTO internal_planning_message (guild_id, channel_id, message_id, week_monday)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE channel_id=VALUES(channel_id), message_id=VALUES(message_id), week_monday=VALUES(week_monday)`,
    [String(guildId), String(channelId), String(messageId), week]
  );
  return res.insertId;
}

async function setWeekMonday(guildId, weekMonday) {
  const week = normalizeMysqlDate(weekMonday);
  if (!week) throw new Error("weekMonday invalide");

  await query(`UPDATE internal_planning_message SET week_monday = ? WHERE guild_id = ?`, [week, String(guildId)]);
}

async function listEntriesForWeek(guildId, weekMonday) {
  const week = normalizeMysqlDate(weekMonday);
  if (!week) return [];

  const rows = await query(
    `SELECT *
     FROM internal_planning_entries
     WHERE guild_id = ?
       AND week_monday = ?
     ORDER BY (event_datetime IS NULL) ASC, event_datetime ASC, id_entry ASC`,
    [String(guildId), week]
  );

  return rows || [];
}

async function insertEntry(data) {
  const {
    guildId,
    weekMonday,
    type,
    eventDatetime,
    personFirstname,
    personLastname,
    concernedUserIds,
    meetingMotif,
    concernedRoleIds,
    otherReason,
    createdByUserId,
  } = data;

  const week = normalizeMysqlDate(weekMonday);
  if (!week) throw new Error("weekMonday invalide");

  const res = await query(
    `INSERT INTO internal_planning_entries
      (guild_id, week_monday, type, event_datetime, person_firstname, person_lastname, concerned_user_ids, meeting_motif, concerned_role_ids, other_reason, created_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      String(guildId),
      week,
      String(type),
      eventDatetime || null,
      personFirstname || null,
      personLastname || null,
      concernedUserIds || null,
      meetingMotif || null,
      concernedRoleIds || null,
      otherReason || null,
      String(createdByUserId),
    ]
  );
}

async function getEntryById(guildId, idEntry) {
  const rows = await query(
    `SELECT * FROM internal_planning_entries WHERE guild_id = ? AND id_entry = ? LIMIT 1`,
    [String(guildId), Number(idEntry)]
  );
  return rows?.[0] || null;
}

async function updateEntry(guildId, idEntry, patch) {
  const allowed = {
    week_monday: patch.weekMonday ? normalizeMysqlDate(patch.weekMonday) : undefined,
    type: patch.type,
    event_datetime: patch.eventDatetime,
    person_firstname: patch.personFirstname,
    person_lastname: patch.personLastname,
    concerned_user_ids: patch.concernedUserIds,
    meeting_motif: patch.meetingMotif,
    concerned_role_ids: patch.concernedRoleIds,
    other_reason: patch.otherReason,
  };

  const sets = [];
  const params = [];
  for (const [k, v] of Object.entries(allowed)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    params.push(v === "" ? null : v);
  }

  if (!sets.length) return;

  params.push(String(guildId), Number(idEntry));

  await query(
    `UPDATE internal_planning_entries SET ${sets.join(", ")} WHERE guild_id = ? AND id_entry = ?`,
    params
  );
}

async function deleteEntry(guildId, idEntry) {
  await query(`DELETE FROM internal_planning_entries WHERE guild_id = ? AND id_entry = ?`, [String(guildId), Number(idEntry)]);
}

module.exports = {
  ensureTables,
  toMysqlDate,
  toMysqlDatetimeFromParts,
  getWeekMondayLocal,
  getPlanningMessage,
  upsertPlanningMessage,
  setWeekMonday,
  listEntriesForWeek,
  insertEntry,
  getEntryById,
  updateEntry,
  deleteEntry,
};
