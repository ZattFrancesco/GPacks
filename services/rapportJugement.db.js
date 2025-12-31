// services/rapportJugement.db.js
// Stockage des rapports de jugement + resets hebdomadaires (sans supprimer l'historique)

const { query } = require("./db");

let ensured = false;

async function ensureTables() {
  if (ensured) return;
  ensured = true;

  await query(
    `CREATE TABLE IF NOT EXISTS doj_jugement_reports (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      guild_id VARCHAR(32) NOT NULL,
      reporter_user_id VARCHAR(32) NOT NULL,

      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      date_jugement_unix BIGINT NULL,

      nom VARCHAR(80) NOT NULL,
      prenom VARCHAR(80) NOT NULL,

      judge_user_id VARCHAR(32) NULL,
      judge_name VARCHAR(128) NOT NULL,
      judge_key VARCHAR(160) NOT NULL,

      procureur VARCHAR(128) NULL,
      avocat VARCHAR(128) NULL,

      peine TEXT NULL,
      amende TEXT NULL,
      tig TINYINT(1) NOT NULL DEFAULT 0,
      tig_entreprise VARCHAR(160) NULL,
      observation TEXT NULL,

      PRIMARY KEY (id),
      KEY idx_guild_created (guild_id, created_at),
      KEY idx_guild_judgekey (guild_id, judge_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  );

  await query(
    `CREATE TABLE IF NOT EXISTS doj_jugement_week_resets (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      guild_id VARCHAR(32) NOT NULL,
      reset_by_user_id VARCHAR(32) NOT NULL,
      reset_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_guild_reset (guild_id, reset_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  );
}

/**
 * @param {string} guildId
 * @returns {Promise<{reset_at: Date} | null>}
 */
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

/**
 * @param {string} guildId
 * @param {string} userId
 */
async function addWeekReset(guildId, userId) {
  if (!guildId || !userId) return;
  await ensureTables();
  await query(
    `INSERT INTO doj_jugement_week_resets (guild_id, reset_by_user_id)
     VALUES (?, ?)`,
    [guildId, userId]
  );
}

/**
 * @param {object} data
 */
async function insertReport(data) {
  await ensureTables();
  const {
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
  } = data;

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
      date_jugement_unix ?? null,
      nom,
      prenom,
      judge_user_id ?? null,
      judge_name,
      judge_key,
      procureur ?? null,
      avocat ?? null,
      peine ?? null,
      amende ?? null,
      tig ? 1 : 0,
      tig_entreprise ?? null,
      observation ?? null,
    ]
  );
}

/**
 * @param {string} guildId
 * @param {Date|null} sinceDate
 * @returns {Promise<Array<{judge_key:string, judge_user_id:string|null, judge_name:string, cnt:number}>>}
 */
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
    `SELECT judge_key, MAX(judge_user_id) AS judge_user_id, MAX(judge_name) AS judge_name, COUNT(*) AS cnt
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

module.exports = {
  ensureTables,
  getLastReset,
  addWeekReset,
  insertReport,
  getCountsByJudge,
};
