// services/jugement.db.js
// Gestion de la config "demande-jugement" (rôles à ping) par serveur.

const { query } = require("./db");

let ensured = false;

async function ensureTable() {
  if (ensured) return;
  ensured = true;

  await query(
    `CREATE TABLE IF NOT EXISTS doj_jugement_settings (
      guild_id VARCHAR(32) NOT NULL,
      ping_role_ids TEXT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (guild_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  );
}

/**
 * @param {string} guildId
 * @returns {Promise<{guild_id:string, ping_role_ids: string|null, updated_at: any}|null>}
 */
async function getSettings(guildId) {
  if (!guildId) return null;
  await ensureTable();
  const rows = await query(
    `SELECT guild_id, ping_role_ids, updated_at
     FROM doj_jugement_settings
     WHERE guild_id = ?
     LIMIT 1`,
    [guildId]
  );
  return rows?.[0] || null;
}

/**
 * @param {string} guildId
 * @param {{ pingRoleIds?: string[] }} data
 */
async function upsertSettings(guildId, data = {}) {
  if (!guildId) return;
  await ensureTable();
  const ping_role_ids = Array.isArray(data.pingRoleIds) ? JSON.stringify(data.pingRoleIds) : null;

  await query(
    `INSERT INTO doj_jugement_settings (guild_id, ping_role_ids)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE
       ping_role_ids = VALUES(ping_role_ids)`,
    [guildId, ping_role_ids]
  );
}

/**
 * @param {string} guildId
 * @returns {Promise<string[]>}
 */
async function getPingRoleIds(guildId) {
  const s = await getSettings(guildId);
  if (!s?.ping_role_ids) return [];
  try {
    const arr = JSON.parse(s.ping_role_ids);
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch {
    return [];
  }
}

module.exports = {
  ensureTable,
  getSettings,
  upsertSettings,
  getPingRoleIds,
};
