const { query } = require('./db');

let ensured = false;

async function ensureTables() {
  if (ensured) return;

  await query(`
    CREATE TABLE IF NOT EXISTS doj_channel_locks (
      guild_id VARCHAR(32) NOT NULL,
      channel_id VARCHAR(32) NOT NULL,
      locked_by_user_id VARCHAR(32) NOT NULL,
      overwrites_json LONGTEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (guild_id, channel_id),
      INDEX idx_guild_created (guild_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  ensured = true;
}

async function getLockSnapshot(guildId, channelId) {
  await ensureTables();
  const rows = await query(
    `SELECT * FROM doj_channel_locks WHERE guild_id = ? AND channel_id = ? LIMIT 1`,
    [String(guildId), String(channelId)]
  );
  return rows?.[0] || null;
}

async function listLockSnapshots(guildId) {
  await ensureTables();
  return await query(
    `SELECT * FROM doj_channel_locks WHERE guild_id = ? ORDER BY created_at ASC`,
    [String(guildId)]
  );
}

async function saveLockSnapshot(guildId, channelId, lockedByUserId, overwrites) {
  await ensureTables();
  await query(
    `INSERT INTO doj_channel_locks (guild_id, channel_id, locked_by_user_id, overwrites_json)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       locked_by_user_id = VALUES(locked_by_user_id),
       overwrites_json = VALUES(overwrites_json)`,
    [
      String(guildId),
      String(channelId),
      String(lockedByUserId),
      JSON.stringify(overwrites || []),
    ]
  );
}

async function deleteLockSnapshot(guildId, channelId) {
  await ensureTables();
  await query(
    `DELETE FROM doj_channel_locks WHERE guild_id = ? AND channel_id = ?`,
    [String(guildId), String(channelId)]
  );
}

function parseOverwritesJson(value) {
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

module.exports = {
  ensureTables,
  getLockSnapshot,
  listLockSnapshots,
  saveLockSnapshot,
  deleteLockSnapshot,
  parseOverwritesJson,
};
