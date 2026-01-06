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
      channel_id BIGINT UNSIGNED NOT NULL,
      message_id BIGINT UNSIGNED NOT NULL,
      week_monday DATE NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  ensured = true;
}

function pad2(n) {
  const x = Number(n);
  return String(x).padStart(2, "0");
}

function toMysqlDate(d) {
  // d: JS Date (local)
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

function toMysqlDatetimeFromParts(year, month, day, hourStr) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);

  const hm = String(hourStr || "").trim();
  const m1 = hm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m1) return null;

  const hh = Number(m1[1]);
  const mi = Number(m1[2]);
  if (hh < 0 || hh > 23 || mi < 0 || mi > 59) return null;

  const yyyy = String(y);
  const mm = pad2(m);
  const dd = pad2(d);
  const HH = pad2(hh);
  const MI = pad2(mi);

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
  await query(
    `INSERT INTO judgement_planning_message (guild_id, channel_id, message_id, week_monday)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       channel_id = VALUES(channel_id),
       message_id = VALUES(message_id),
       week_monday = VALUES(week_monday)`,
    [guildId, channelId, messageId, weekMonday]
  );
}

async function setWeekMonday(guildId, weekMonday) {
  await query(
    `UPDATE judgement_planning_message SET week_monday = ? WHERE guild_id = ?`,
    [weekMonday, guildId]
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
  const start = `${weekMondayDate} 00:00:00`;
  // end = next monday
  const d = new Date(weekMondayDate + "T00:00:00");
  d.setDate(d.getDate() + 7);
  const end = `${toMysqlDate(d)} 00:00:00`;
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

  const rows = await query(
    `INSERT INTO judgement_planning_entries
      (guild_id, accused_firstname, accused_lastname, accused_id, ticket_url, judgement_datetime, created_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [guildId, accused_firstname, accused_lastname, accused_id, ticket_url, judgement_datetime, created_by_user_id]
  );

  return rows?.insertId;
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
