// services/judgementPlanning.db.js
const { query } = require("./db");

let ensured = false;

async function ensureTables() {
  if (ensured) return;

  await query(`
    CREATE TABLE IF NOT EXISTS judgement_planning_entries (
      id_judge INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      guild_id BIGINT UNSIGNED NOT NULL,

      accused_firstname VARCHAR(100) NOT NULL,
      accused_lastname  VARCHAR(100) NOT NULL,
      accused_id        VARCHAR(50)  NOT NULL,

      ticket_url TEXT NOT NULL,

      judgement_datetime DATETIME NOT NULL,

      created_by_user_id BIGINT UNSIGNED NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      INDEX idx_guild_date (guild_id, judgement_datetime)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS judgement_planning_message (
      guild_id BIGINT UNSIGNED PRIMARY KEY,
      -- ⚠️ Discord IDs (snowflakes) = très grands entiers.
      -- Les stocker en BIGINT puis les lire en JS peut casser l'ID (perte de précision).
      -- On les stocke donc en texte.
      channel_id VARCHAR(32) NOT NULL,
      message_id VARCHAR(32) NOT NULL,
      week_monday DATE NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Migration douce: si la table existait déjà en BIGINT, on convertit en VARCHAR.
  // (Pas d'erreur si déjà bon.)
  try {
    const cols = await query(
      `SELECT COLUMN_NAME, DATA_TYPE
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'judgement_planning_message'
         AND COLUMN_NAME IN ('channel_id', 'message_id')`
    );

    const typeByName = new Map((cols || []).map(c => [String(c.COLUMN_NAME), String(c.DATA_TYPE).toLowerCase()]));
    const chType = typeByName.get('channel_id');
    const msgType = typeByName.get('message_id');

    if (chType && chType !== 'varchar') {
      await query(`ALTER TABLE judgement_planning_message MODIFY channel_id VARCHAR(32) NOT NULL`);
    }
    if (msgType && msgType !== 'varchar') {
      await query(`ALTER TABLE judgement_planning_message MODIFY message_id VARCHAR(32) NOT NULL`);
    }
  } catch (_) {
    // On ne bloque pas le bot si le user n'a pas les droits sur INFORMATION_SCHEMA.
  }

  ensured = true;
}

function pad2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return String(x).padStart(2, "0");
}

function isValidDateObj(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function normalizeMysqlDate(mysqlDate) {
  const s = String(mysqlDate || "").trim();
  // Accept only YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;

  const [y, mo, da] = s.split("-").map(Number);
  if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(da)) return null;
  if (mo < 1 || mo > 12) return null;
  if (da < 1 || da > 31) return null;

  const dt = new Date(`${s}T00:00:00`);
  // Vérifie que JS n'a pas "corrigé" la date (ex: 2026-02-31)
  if (!isValidDateObj(dt)) return null;
  if (dt.getFullYear() !== y || (dt.getMonth() + 1) !== mo || dt.getDate() !== da) return null;

  return s;
}

function toMysqlDate(d) {
  // Retourne "YYYY-MM-DD" ou null si invalide
  if (!isValidDateObj(d)) return null;

  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  if (!mm || !dd) return null;

  return `${yyyy}-${mm}-${dd}`;
}

function toMysqlDatetimeFromParts(year, month, day, hourStr) {
  // Retourne "YYYY-MM-DD HH:MM:00" ou null
  const y = Number(String(year || "").trim());
  const m = Number(String(month || "").trim());
  const d = Number(String(day || "").trim());

  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (y < 1900 || y > 2100) return null;
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;

  // Heure au format HH:MM
  const hm = String(hourStr || "").trim();
  const m1 = hm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m1) return null;

  const hh = Number(m1[1]);
  const mi = Number(m1[2]);
  if (hh < 0 || hh > 23 || mi < 0 || mi > 59) return null;

  // Vérifie que la date existe vraiment (ex: 31/02)
  const test = new Date(y, m - 1, d, hh, mi, 0, 0);
  if (!isValidDateObj(test)) return null;
  if (test.getFullYear() !== y || (test.getMonth() + 1) !== m || test.getDate() !== d) return null;

  const yyyy = String(y);
  const mm = pad2(m);
  const dd = pad2(d);
  const HH = pad2(hh);
  const MI = pad2(mi);
  if (!mm || !dd || !HH || !MI) return null;

  return `${yyyy}-${mm}-${dd} ${HH}:${MI}:00`;
}

function getWeekMondayLocal(date = new Date()) {
  // Monday = 1 in ISO. JS getDay(): Sunday=0..Saturday=6
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // move to Monday
  d.setDate(d.getDate() + diff);
  return d;
}

async function getPlanningMessage(guildId) {
  const rows = await query(
    `SELECT guild_id, channel_id, message_id, week_monday
     FROM judgement_planning_message
     WHERE guild_id = ?`,
    [guildId]
  );
  return rows[0] || null;
}

async function upsertPlanningMessage({ guildId, channelId, messageId, weekMonday }) {
  const safeWeek = normalizeMysqlDate(weekMonday) || toMysqlDate(getWeekMondayLocal());
  await query(
    `INSERT INTO judgement_planning_message (guild_id, channel_id, message_id, week_monday)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       channel_id = VALUES(channel_id),
       message_id = VALUES(message_id),
       week_monday = VALUES(week_monday)`,
    [String(guildId), String(channelId), String(messageId), safeWeek]
  );
}

async function setWeekMonday(guildId, weekMonday) {
  const safeWeek = normalizeMysqlDate(weekMonday) || toMysqlDate(getWeekMondayLocal());
  await query(
    `UPDATE judgement_planning_message SET week_monday = ? WHERE guild_id = ?`,
    [safeWeek, guildId]
  );
}

async function listEntriesBetween(guildId, startDt, endDt) {
  return query(
    `SELECT *
     FROM judgement_planning_entries
     WHERE guild_id = ?
       AND judgement_datetime >= ?
       AND judgement_datetime < ?
     ORDER BY judgement_datetime ASC, id_judge ASC`,
    [guildId, startDt, endDt]
  );
}

async function listEntriesForWeek(guildId, weekMondayDate) {
  const normalized = normalizeMysqlDate(weekMondayDate) || toMysqlDate(getWeekMondayLocal()) || null;
  if (!normalized) return [];

  const start = `${normalized} 00:00:00`;

  // end = next monday
  const d = new Date(`${normalized}T00:00:00`);
  d.setDate(d.getDate() + 7);

  const endDate = toMysqlDate(d) || normalized;
  const end = `${endDate} 00:00:00`;

  return listEntriesBetween(guildId, start, end);
}

async function insertEntry(guildId, data) {
  const {
    accused_firstname,
    accused_lastname,
    accused_id,
    ticket_url,
    judgement_datetime,
    created_by_user_id,
  } = data;

  const rows = const res = await query(
    `INSERT INTO judgement_planning_entries
      (guild_id, accused_firstname, accused_lastname, accused_id, ticket_url, judgement_datetime, created_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [guildId, accused_firstname, accused_lastname, accused_id, ticket_url, judgement_datetime, created_by_user_id]
  );

  return rows?.insertId;
  return res.insertId;

}

async function getEntryById(guildId, idJudge) {
  const rows = await query(
    `SELECT * FROM judgement_planning_entries WHERE guild_id = ? AND id_judge = ?`,
    [guildId, idJudge]
  );
  return rows[0] || null;
}

async function updateEntry(guildId, idJudge, data) {
  const {
    accused_firstname,
    accused_lastname,
    accused_id,
    ticket_url,
    judgement_datetime,
  } = data;

  await query(
    `UPDATE judgement_planning_entries
     SET accused_firstname = ?, accused_lastname = ?, accused_id = ?, ticket_url = ?, judgement_datetime = ?
     WHERE guild_id = ? AND id_judge = ?`,
    [accused_firstname, accused_lastname, accused_id, ticket_url, judgement_datetime, guildId, idJudge]
  );
}

async function deleteEntry(guildId, idJudge) {
  await query(
    `DELETE FROM judgement_planning_entries WHERE guild_id = ? AND id_judge = ?`,
    [guildId, idJudge]
  );
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
  listEntriesBetween,
  insertEntry,
  getEntryById,
  updateEntry,
  deleteEntry,
};
