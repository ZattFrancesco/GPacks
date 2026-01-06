// services/visa.db.js

const { query } = require("./db");

let ensured = false;

function normalizeKey(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

async function ensureTables() {
  if (ensured) return;

  await query(`
    CREATE TABLE IF NOT EXISTS doj_visas (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      guild_id VARCHAR(32) NOT NULL,
      channel_id VARCHAR(32) NULL,
      message_id VARCHAR(32) NULL,

      reporter_user_id VARCHAR(32) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

      nom VARCHAR(128) NOT NULL,
      prenom VARCHAR(128) NOT NULL,
      nom_key VARCHAR(128) NOT NULL,
      prenom_key VARCHAR(128) NOT NULL,
      identity_id VARCHAR(64) NOT NULL,

      statut_visa VARCHAR(32) NOT NULL DEFAULT 'Temporaire',
      facture_statut VARCHAR(16) NOT NULL DEFAULT 'Impayee',

      expiration_unix BIGINT NULL,

      permis_validite VARCHAR(255) NULL,
      entreprise VARCHAR(255) NULL,
      poste VARCHAR(255) NULL,

      raison TEXT NULL,

      PRIMARY KEY (id),
      INDEX idx_guild_created (guild_id, created_at),
      INDEX idx_guild_name (guild_id, nom_key, prenom_key),
      INDEX idx_guild_identity (guild_id, identity_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  ensured = true;
}

async function insertVisa(payload) {
  await ensureTables();
  const nomKey = normalizeKey(payload.nom);
  const prenomKey = normalizeKey(payload.prenom);

  const sql = `
    INSERT INTO doj_visas (
      guild_id, channel_id, message_id,
      reporter_user_id,
      nom, prenom, nom_key, prenom_key, identity_id,
      statut_visa, facture_statut,
      expiration_unix,
      permis_validite, entreprise, poste,
      raison
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    payload.guildId,
    payload.channelId || null,
    payload.messageId || null,
    payload.reporterUserId,
    payload.nom,
    payload.prenom,
    nomKey,
    prenomKey,
    String(payload.identityId || "").trim(),
    payload.statutVisa || "Temporaire",
    payload.factureStatut || "Impayee",
    payload.expirationUnix ?? null,
    payload.permisValidite ?? null,
    payload.entreprise ?? null,
    payload.poste ?? null,
    payload.raison ?? null,
  ];

  const res = await query(sql, params);
  return res.insertId;
}

async function updateVisa(visaId, patch) {
  await ensureTables();
  const keys = Object.keys(patch || {});
  if (!keys.length) return;

  const allowed = new Set([
    "channel_id",
    "message_id",
    "statut_visa",
    "facture_statut",
    "expiration_unix",
    "permis_validite",
    "entreprise",
    "poste",
    "raison",
  ]);

  const fields = [];
  const params = [];

  for (const k of keys) {
    if (!allowed.has(k)) continue;
    fields.push(`${k} = ?`);
    params.push(patch[k]);
  }
  if (!fields.length) return;

  params.push(String(visaId));

  await query(`UPDATE doj_visas SET ${fields.join(", ")} WHERE id = ?`, params);
}

async function getVisaById(guildId, visaId) {
  await ensureTables();
  const rows = await query(
    `SELECT * FROM doj_visas WHERE guild_id = ? AND id = ? LIMIT 1`,
    [guildId, String(visaId)]
  );
  return rows?.[0] || null;
}

async function deleteVisa(guildId, visaId) {
  await ensureTables();
  await query(`DELETE FROM doj_visas WHERE guild_id = ? AND id = ?`, [guildId, String(visaId)]);
}

function buildSearchWhere(search, params) {
  const raw = String(search || "").trim();
  if (!raw) return { whereSql: "", params };

  const q = normalizeKey(raw);
  const parts = q.split(" ").filter(Boolean);

  // On supporte :
  // - 1 mot : match nom OU prénom OU identity_id
  // - 2+ mots : match "nom prénom" OU "prénom nom" + identity_id
  const like = (s) => `%${s}%`;

  if (parts.length === 1) {
    const p = parts[0];
    params.push(like(p), like(p), like(p));
    return {
      whereSql: ` AND (identity_id LIKE ? OR nom_key LIKE ? OR prenom_key LIKE ?)` ,
      params,
    };
  }

  const a = parts[0];
  const b = parts.slice(1).join(" ");

  // identity + (nom=a & prenom=b) OR (nom=b & prenom=a) OR concat
  params.push(like(q));
  params.push(like(a), like(b));
  params.push(like(b), like(a));
  params.push(like(q));

  return {
    whereSql:
      ` AND (` +
      `identity_id LIKE ?` +
      ` OR (nom_key LIKE ? AND prenom_key LIKE ?)` +
      ` OR (nom_key LIKE ? AND prenom_key LIKE ?)` +
      ` OR CONCAT(nom_key, ' ', prenom_key) LIKE ?` +
      `)`,
    params,
  };
}

async function countVisas(guildId, search) {
  await ensureTables();
  const params = [guildId];
  const { whereSql, params: p } = buildSearchWhere(search, params);
  const rows = await query(
    `SELECT COUNT(*) AS cnt FROM doj_visas WHERE guild_id = ?${whereSql}`,
    p
  );
  return Number(rows?.[0]?.cnt || 0);
}

async function listVisas(guildId, { search = "", page = 1, pageSize = 5 } = {}) {
  await ensureTables();

  const safePage = Math.max(1, Number(page) || 1);
  const safeSize = Math.min(10, Math.max(1, Number(pageSize) || 5));
  const offset = (safePage - 1) * safeSize;

  const params = [guildId];
  const { whereSql, params: p } = buildSearchWhere(search, params);
  p.push(safeSize, offset);

  const rows = await query(
    `SELECT * FROM doj_visas WHERE guild_id = ?${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`,
    p
  );
  return rows || [];
}

module.exports = {
  ensureTables,
  insertVisa,
  updateVisa,
  getVisaById,
  deleteVisa,
  countVisas,
  listVisas,
  normalizeKey,
};
