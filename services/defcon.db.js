// services/defcon.db.js
const { query } = require('./db');
const logger = require('../src/utils/logger');

let ensured = false;

async function ensureTable() {
  if (ensured) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS bot_defcon_messages (
        level TINYINT UNSIGNED NOT NULL,
        message TEXT NULL,
        footer VARCHAR(255) NULL,
        color INT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (level)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS guild_defcon_channels (
        guild_id VARCHAR(32) NOT NULL,
        channel_id VARCHAR(32) NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (guild_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    ensured = true;
  } catch (err) {
    logger.warn(`defcon.db ensureTable: ${err?.message || err}`);
  }
}

async function getDefconMessage(level) {
  await ensureTable();
  const rows = await query(
    'SELECT level, message, footer, color FROM bot_defcon_messages WHERE level = ? LIMIT 1',
    [Number(level)]
  );
  return rows?.[0] || null;
}

async function setDefconMessage(level, { message = null, footer = null, color = null } = {}) {
  await ensureTable();
  await query(
    `INSERT INTO bot_defcon_messages (level, message, footer, color)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       message = VALUES(message),
       footer = VALUES(footer),
       color = VALUES(color)`,
    [Number(level), message, footer, color !== null && color !== undefined ? Number(color) : null]
  );
  return { ok: true };
}

async function getDefconChannel(guildId) {
  if (!guildId) return null;
  await ensureTable();
  const rows = await query(
    'SELECT channel_id FROM guild_defcon_channels WHERE guild_id = ? LIMIT 1',
    [String(guildId)]
  );
  return rows?.[0]?.channel_id || null;
}

async function setDefconChannel(guildId, channelId) {
  if (!guildId) return { ok: false, error: 'missing_guildId' };
  await ensureTable();
  if (!channelId) {
    await query('DELETE FROM guild_defcon_channels WHERE guild_id = ?', [String(guildId)]);
  } else {
    await query(
      `INSERT INTO guild_defcon_channels (guild_id, channel_id)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE channel_id = VALUES(channel_id)`,
      [String(guildId), String(channelId)]
    );
  }
  return { ok: true };
}

module.exports = {
  ensureTable,
  getDefconMessage,
  setDefconMessage,
  getDefconChannel,
  setDefconChannel,
};
