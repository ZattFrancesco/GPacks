const { query } = require('./db');
const logger = require('../src/utils/logger');

const TABLE_SQL = `
CREATE TABLE IF NOT EXISTS guild_autoroles (
  guild_id VARCHAR(32) NOT NULL,
  role_id VARCHAR(32) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (guild_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

let _ensured = false;

async function ensureTable() {
  if (_ensured) return;
  try {
    await query(TABLE_SQL);
    _ensured = true;
  } catch (err) {
    logger.warn(`autorole.db ensureTable: ${err?.message || err}`);
  }
}

async function getAutorole(guildId) {
  if (!guildId) return null;
  await ensureTable();
  const rows = await query(
    'SELECT guild_id, role_id FROM guild_autoroles WHERE guild_id = ? LIMIT 1',
    [String(guildId)]
  );
  if (!rows?.length) return null;
  return {
    guildId: rows[0].guild_id,
    roleId: rows[0].role_id || null,
  };
}

async function setAutorole(guildId, roleId) {
  if (!guildId) return { ok: false, error: 'missing_guildId' };
  await ensureTable();
  await query(
    `INSERT INTO guild_autoroles (guild_id, role_id)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE role_id = VALUES(role_id)`,
    [String(guildId), roleId ? String(roleId) : null]
  );
  return { ok: true, roleId: roleId ? String(roleId) : null };
}

async function clearAutorole(guildId) {
  return setAutorole(guildId, null);
}

async function clearAutoroleIfMatches(guildId, roleId) {
  if (!guildId || !roleId) return { ok: false, error: 'missing_argument' };
  await ensureTable();
  const result = await query(
    'UPDATE guild_autoroles SET role_id = NULL WHERE guild_id = ? AND role_id = ?',
    [String(guildId), String(roleId)]
  );
  return { ok: true, changed: Number(result?.affectedRows || 0) > 0 };
}

module.exports = {
  ensureTable,
  getAutorole,
  setAutorole,
  clearAutorole,
  clearAutoroleIfMatches,
};
