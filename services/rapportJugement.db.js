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

  // `applyNameSearch` peut retourner une nouvelle version de `params`.
  // Donc `params` doit être réassignable (sinon erreur: "Assignment to constant variable").
  let params = [guildId];
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

function normalizeSearch(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  // On coupe pour éviter de gonfler les paramètres et limiter les abus
  return s.replace(/\s+/g, " ").slice(0, 80);
}

/**
 * Ajoute une recherche robuste sur nom/prénom.
 *
 * Cas gérés :
 * - "vazimov"            -> match nom OU prénom
 * - "ibrahim vazimov"    -> match (prenom+nom) OU (nom+prenom)
 * - on garde aussi les concat avec espaces pour les recherches "plein nom".
 */
function applyNameSearch(where, params, search) {
  const q = normalizeSearch(search);
  if (!q) return { where, params };

  // On split sur les espaces pour détecter "prenom nom".
  const tokens = q.split(" ").filter(Boolean).slice(0, 3);

  // 1 seul mot : simple LIKE sur nom/prénom + concat dans les 2 sens.
  if (tokens.length === 1) {
    const like = `%${tokens[0]}%`;
    where +=
      " AND (nom LIKE ? OR prenom LIKE ? OR CONCAT(nom, ' ', prenom) LIKE ? OR CONCAT(prenom, ' ', nom) LIKE ?)";
    params.push(like, like, like, like);
    return { where, params };
  }

  // 2+ mots : on essaye de faire (prenom + nom) OU (nom + prenom)
  // Exemple: tokens[0]="ibrahim", tokens[1]="vazimov".
  const a = `%${tokens[0]}%`;
  const b = `%${tokens[1]}%`;
  const full = `%${tokens.join(" ")}%`;

  where +=
    " AND (" +
    "(prenom LIKE ? AND nom LIKE ?)" +
    " OR (prenom LIKE ? AND nom LIKE ?)" +
    " OR CONCAT(nom, ' ', prenom) LIKE ?" +
    " OR CONCAT(prenom, ' ', nom) LIKE ?" +
    ")";

  // (prenom=a AND nom=b) OR (prenom=b AND nom=a)
  params.push(a, b, b, a, full, full);
  return { where, params };
}

/**
 * ✅ NOUVEAU : liste des rapports (pour paie fin de semaine)
 */
async function listReports(guildId, sinceDate = null, limit = 200, offset = 0, search = null) {
  if (!guildId) return [];
  await ensureTables();

  // `applyNameSearch` peut retourner une nouvelle version de `params`.
  // Donc `params` doit être réassignable (sinon erreur: "Assignment to constant variable").
  let params = [guildId];
  let where = "guild_id = ?";

  if (sinceDate) {
    where += " AND created_at >= ?";
    params.push(sinceDate);
  }

  ({ where, params } = applyNameSearch(where, params, search));

  const lim = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const off = Math.min(Math.max(Number(offset) || 0, 0), 1000000);

  params.push(lim);
  params.push(off);

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
async function getReportCount(guildId, sinceDate = null, search = null) {
  if (!guildId) return 0;
  await ensureTables();

  // `applyNameSearch` peut retourner une nouvelle version de `params`.
  // Donc `params` doit être réassignable (sinon erreur: "Assignment to constant variable").
  let params = [guildId];
  let where = "guild_id = ?";

  if (sinceDate) {
    where += " AND created_at >= ?";
    params.push(sinceDate);
  }

  ({ where, params } = applyNameSearch(where, params, search));

  const rows = await query(
    `SELECT COUNT(*) AS cnt
     FROM doj_jugement_reports
     WHERE ${where}`,
    params
  );

  return Number(rows?.[0]?.cnt || 0);
}

module.exports = {
  ensureTables,
  getLastReset,
  addWeekReset,
  insertReport,
  getCountsByJudge,
  listReports,
  getReportCount,
  // édition
  getReportById,
  updateReportById,
};

/**
 * 🔎 Récupère un rapport par id (sécurisé par guild_id)
 */
async function getReportById(guildId, reportId) {
  if (!guildId || !reportId) return null;
  await ensureTables();

  const id = Number(reportId);
  if (!Number.isFinite(id) || id <= 0) return null;

  const rows = await query(
    `SELECT
        id,
        guild_id,
        reporter_user_id,
        created_at,
        date_jugement_unix,
        nom, prenom,
        judge_user_id,
        judge_name,
        judge_key,
        procureur,
        avocat,
        peine,
        amende,
        tig,
        tig_entreprise,
        observation
     FROM doj_jugement_reports
     WHERE guild_id = ? AND id = ?
     LIMIT 1`,
    [guildId, id]
  );

  return rows?.[0] || null;
}

function buildJudgeFieldsFromInput(input) {
  const raw = String(input ?? "").trim();
  const uid = extractUserId(raw);
  const name = raw || "/";
  const key = uid ? `U:${uid}` : `T:${normalizeTextKey(name)}`;
  return { judge_user_id: uid, judge_name: name, judge_key: key };
}

function normalizeNullableText(v) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

/**
 * ✏️ Met à jour un rapport par id.
 * - Sécurisé par guild_id
 * - Whitelist stricte des champs
 */
async function updateReportById(guildId, reportId, patch = {}) {
  if (!guildId || !reportId) return false;
  await ensureTables();

  const id = Number(reportId);
  if (!Number.isFinite(id) || id <= 0) return false;

  const allowed = new Set([
    "date_jugement_unix",
    "nom",
    "prenom",
    "judge_name",
    "procureur",
    "avocat",
    "peine",
    "amende",
    "tig",
    "tig_entreprise",
    "observation",
  ]);

  const updates = [];
  const params = [];

  // Date
  if (Object.prototype.hasOwnProperty.call(patch, "date_jugement_unix") && allowed.has("date_jugement_unix")) {
    const v = patch.date_jugement_unix;
    const n = v === null || v === "" ? null : Number(v);
    updates.push("date_jugement_unix = ?");
    params.push(Number.isFinite(n) ? Math.floor(n) : null);
  }

  // Nom / Prénom
  if (Object.prototype.hasOwnProperty.call(patch, "nom") && allowed.has("nom")) {
    const s = String(patch.nom ?? "").trim();
    updates.push("nom = ?");
    params.push(s.length ? s.slice(0, 128) : "");
  }
  if (Object.prototype.hasOwnProperty.call(patch, "prenom") && allowed.has("prenom")) {
    const s = String(patch.prenom ?? "").trim();
    updates.push("prenom = ?");
    params.push(s.length ? s.slice(0, 128) : "");
  }

  // Juge : si on modifie judge_name, on recalcule judge_user_id + judge_key
  if (Object.prototype.hasOwnProperty.call(patch, "judge_name") && allowed.has("judge_name")) {
    const jf = buildJudgeFieldsFromInput(patch.judge_name);
    updates.push("judge_user_id = ?", "judge_name = ?", "judge_key = ?");
    params.push(jf.judge_user_id, jf.judge_name.slice(0, 255), jf.judge_key.slice(0, 255));
  }

  // Textes
  for (const k of ["procureur", "avocat", "amende", "tig_entreprise"]) {
    if (!Object.prototype.hasOwnProperty.call(patch, k) || !allowed.has(k)) continue;
    const s = normalizeNullableText(patch[k]);
    updates.push(`${k} = ?`);
    params.push(s ? s.slice(0, 255) : null);
  }

  for (const k of ["peine", "observation"]) {
    if (!Object.prototype.hasOwnProperty.call(patch, k) || !allowed.has(k)) continue;
    const s = normalizeNullableText(patch[k]);
    updates.push(`${k} = ?`);
    params.push(s);
  }

  // TIG
  if (Object.prototype.hasOwnProperty.call(patch, "tig") && allowed.has("tig")) {
    const v = patch.tig;
    const b = v === true || v === 1 || v === "1" || String(v).toLowerCase() === "oui" || String(v).toLowerCase() === "true";
    updates.push("tig = ?");
    params.push(b ? 1 : 0);

    // Si on désactive TIG, on vide l'entreprise (si non fourni explicitement)
    if (!b && !Object.prototype.hasOwnProperty.call(patch, "tig_entreprise")) {
      updates.push("tig_entreprise = NULL");
    }
  }

  if (!updates.length) return false;

  params.push(guildId, id);
  await query(
    `UPDATE doj_jugement_reports
     SET ${updates.join(", ")}
     WHERE guild_id = ? AND id = ?`,
    params
  );
  return true;
}