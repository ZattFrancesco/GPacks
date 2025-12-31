// services/rapportJugement.db.js
// Stockage des rapports de jugement + resets hebdomadaires (sans supprimer l'historique)

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
      INDEX idx_guild_judgekey (guild_id, judge_key)
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

/**
 * Dernier reset de semaine
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
 * Ajoute un reset (sans effacer l'historique)
 * @param {string} guildId
 * @param {string} userId
 */
async function addWeekReset(guildId, userId) {
  await ensureTables();
  if (!guildId || !userId) return;
  await query(
    `INSERT INTO doj_jugement_week_resets (guild_id, reset_by_user_id) VALUES (?, ?)`,
    [guildId, userId]
  );
}

/**
 * Insert rapport de jugement
 * Accepte payload camelCase (guildId, reporterUserId, dateJugement...) OU snake_case.
 * @param {object} data
 */
async function insertReport(data) {
  await ensureTables();

  // ✅ compat camelCase / snake_case
  const guild_id = data.guild_id ?? data.guildId;
  const reporter_user_id = data.reporter_user_id ?? data.reporterUserId;

  const nom = data.nom;
  const prenom = data.prenom;

  const date_jugement_unix =
    data.date_jugement_unix ??
    data.dateJugementUnix ??
    data.dateJugement ??
    null;

  // juge : si mention, on stocke user_id + key U:ID
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

  // sécurité : si un champ obligatoire manque, on refuse au lieu d'insérer du vide
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

/**
 * Stats par juge (alltime ou depuis une date)
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

module.exports = {
  ensureTables,
  getLastReset,
  addWeekReset,
  insertReport,
  getCountsByJudge,
};