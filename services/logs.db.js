const { query } = require('./db');
const logger = require('../src/utils/logger');

const TABLE_SQL = `
CREATE TABLE IF NOT EXISTS logs_config (
  guild_id VARCHAR(32) NOT NULL,
  channel_id VARCHAR(32) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (guild_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

async function ensureTable() {
  try {
    await query(TABLE_SQL);
  } catch (err) {
    logger.warn(`logs.db ensureTable: ${err?.message || err}`);
  }
}

async function getConfig(guildId) {
  if (!guildId) return null;
  await ensureTable();
  const rows = await query(
    'SELECT guild_id, channel_id FROM logs_config WHERE guild_id = ? LIMIT 1',
    [String(guildId)]
  );
  if (!rows?.length) return null;
  return {
    guildId: rows[0].guild_id,
    channelId: rows[0].channel_id || null,
  };
}

async function setConfig(guildId, channelId) {
  if (!guildId) return { ok: false, error: 'missing_guildId' };
  await ensureTable();
  await query(
    `INSERT INTO logs_config (guild_id, channel_id)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE channel_id = VALUES(channel_id)`,
    [String(guildId), channelId ? String(channelId) : null]
  );
  return { ok: true };
}

module.exports = { ensureTable, getConfig, setConfig };