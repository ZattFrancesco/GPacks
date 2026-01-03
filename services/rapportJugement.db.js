// services/rapportJugement.db.js
const { query } = require("./db");

let ensured = false;

function extractUserId(str) {
  if (!str) return null;
  const s = String(str).trim();
  const m = s.match(/^<@!?(\d{16,20})>$/);
  return m ? m[1] : null;
}

function normalizeTextKey(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 190);
}

async function ensureTables() {
  if (ensured) return;
  ensured = true;

  await query(`
    CREATE TABLE IF NOT EXISTS doj_jugement_reports (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      guild_id VARCHAR(32) NOT NULL,
      reporter_user_id VARCHAR(32) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

      date_jugement_unix BIGINT NULL,

      nom VARCHAR(128) NOT NULL,
      prenom VARCHAR(128) NOT NULL,

      judge_user_id VARCHAR(32) NULL,
      judge_name VARCHAR(255) NOT NULL,
      judge_key VARCHAR(255) NOT NULL,

      procureur VARCHAR(255) NULL,
      avocat VARCHAR(255) NULL,

      peine TEXT NULL,
      amende VARCHAR(255) NULL,
      tig TINYINT(1) NOT NULL DEFAULT 0,
      tig_entreprise VARCHAR(255) NULL,
      observation TEXT NULL,

      PRIMARY KEY (id),
      INDEX idx_guild_created (guild_id, created_at),
      INDEX idx_guild_judgekey (guild_id, judge_key),
      INDEX idx_guild_datejug (guild_id, date_jugement_unix)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS doj_jugement_week_resets (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      guild_id VARCHAR(32) NOT NULL,
      reset_by_user_id VARCHAR(32) NOT NULL,
      reset_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_guild_reset (guild_id, reset_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

async function getLastReset(guildId) {
  if (!guildId) return null;
  await ensureTables();
  const rows = await query(
    `SELECT reset_at
     FROM doj_jugement_week_resets
     WHERE guild_id = ?
     ORDER BY reset_at DESC
     LIMIT 1`,
    [guildId]
  );
  return rows?.[0] || null;
}

async function addWeekReset(guildId, userId) {
  await ensureTables();
  if (!guildId || !userId) return;
  await query(
    `INSERT INTO doj_jugement_week_resets (guild_id, reset_by_user_id) VALUES (?, ?)`,
    [guildId, userId]
  );
}

async function insertReport(data) {
  await ensureTables();

  const guild_id = data.guild_id ?? data.guildId;
  const reporter_user_id = data.reporter_user_id ?? data.reporterUserId;

  const nom = data.nom;
  const prenom = data.prenom;

  const date_jugement_unix =
    data.date_jugement_unix ??
    data.dateJugementUnix ??
    data.dateJugement ??
    null;

  const judgeInput = data.judge_name ?? data.judgeName ?? data.juge ?? "";
  const judge_user_id =
    data.judge_user_id ?? data.judgeUserId ?? extractUserId(judgeInput);

  let judge_name = data.judge_name ?? data.judgeName ?? "";
  if (!judge_name) judge_name = String(judgeInput || "").trim();

  let judge_key = data.judge_key ?? data.judgeKey ?? null;
  if (!judge_key) {
    if (judge_user_id) judge_key = `U:${judge_user_id}`;
    else judge_key = `T:${normalizeTextKey(judge_name)}`;
  }

  const procureur = data.procureur ?? null;
  const avocat = data.avocat ?? null;

  const peine = data.peine ?? null;
  const amende = data.amende ?? null;

  const tig = data.tig ? 1 : 0;
  const tig_entreprise = data.tig_entreprise ?? data.tigEntreprise ?? null;

  const observation = data.observation ?? null;

  if (!guild_id || !reporter_user_id || !nom || !prenom || !judge_key) {
    throw new Error(
      `insertReport: champs manquants (guild_id=${guild_id}, reporter=${reporter_user_id}, nom=${nom}, prenom=${prenom}, judge_key=${judge_key})`
    );
  }

  await query(
    `INSERT INTO doj_jugement_reports (
      guild_id, reporter_user_id, date_jugement_unix,
      nom, prenom,
      judge_user_id, judge_name, judge_key,
      procureur, avocat,
      peine, amende, tig, tig_entreprise, observation
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      guild_id,
      reporter_user_id,
      date_jugement_unix,
      nom,
      prenom,
      judge_user_id,
      judge_name,
      judge_key,
      procureur,
      avocat,
      peine,
      amende,
      tig,
      tig_entreprise,
      observation,
    ]
  );
}

async function getCountsByJudge(guildId, sinceDate = null) {
  if (!guildId) return [];
  await ensureTables();

  const params = [guildId];
  let where = "guild_id = ?";

  if (sinceDate) {
    where += " AND created_at >= ?";
    params.push(sinceDate);
  }

  const rows = await query(
    `SELECT judge_key,
            MAX(judge_user_id) AS judge_user_id,
            MAX(judge_name) AS judge_name,
            COUNT(*) AS cnt
     FROM doj_jugement_reports
     WHERE ${where}
     GROUP BY judge_key
     ORDER BY cnt DESC`,
    params
  );

  return (rows || []).map((r) => ({
    judge_key: r.judge_key,
    judge_user_id: r.judge_user_id || null,
    judge_name: r.judge_name || "",
    cnt: Number(r.cnt || 0),
  }));
}

/**
 * ✅ NOUVEAU : liste des rapports (pagination: limit + offset)
 */
async function listReports(guildId, sinceDate = null, limit = 200, offset = 0) {
  if (!guildId) return [];
  await ensureTables();

  const params = [guildId];
  let where = "guild_id = ?";

  if (sinceDate) {
    where += " AND created_at >= ?";
    params.push(sinceDate);
  }

  params.push(Number(limit) || 200);
  params.push(Number(offset) || 0);

  const rows = await query(
    `SELECT
        id,
        reporter_user_id,
        created_at,
        date_jugement_unix,
        nom, prenom,
        judge_name,
        procureur,
        avocat,
        peine,
        amende,
        tig,
        tig_entreprise,
        observation
     FROM doj_jugement_reports
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    params
  );

  return rows || [];
}

/**
 * ✅ NOUVEAU : nombre de rapports sur la période
 */
async function getReportCount(guildId, sinceDate = null) {
  if (!guildId) return 0;
  await ensureTables();

  const params = [guildId];
  let where = "guild_id = ?";

  if (sinceDate) {
    where += " AND created_at >= ?";
    params.push(sinceDate);
  }

  const rows = await query(
    `SELECT COUNT(*) AS cnt
     FROM doj_jugement_reports
     WHERE ${where}`,
    params
  );

  return Number(rows?.[0]?.cnt || 0);
}

/**
 * ✅ AJOUTS COMPAT PAGINATION COMMANDES
 * On expose des helpers avec les noms attendus par /rapport-semaine et /rapport-alltime.
 */

// Semaine = depuis le dernier reset si présent, sinon 7 jours glissants.
async function _getWeekSinceDate(guildId) {
  const lastReset = await getLastReset(guildId);
  if (lastReset?.reset_at) return lastReset.reset_at;
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}

async function listReportsWeek(guildId, offset = 0, limit = 10) {
  const since = await _getWeekSinceDate(guildId);
  return listReports(guildId, since, limit, offset);
}

async function countReportsWeek(guildId) {
  const since = await _getWeekSinceDate(guildId);
  return getReportCount(guildId, since);
}

async function listReportsAll(guildId, offset = 0, limit = 10) {
  return listReports(guildId, null, limit, offset);
}

async function countReportsAll(guildId) {
  return getReportCount(guildId, null);
}

module.exports = {
  ensureTables,
  getLastReset,
  addWeekReset,
  insertReport,
  getCountsByJudge,

  listReports,
  getReportCount,

  // ✅ exports pour la pagination des commandes
  listReportsWeek,
  countReportsWeek,
  listReportsAll,
  countReportsAll,
};