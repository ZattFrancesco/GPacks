const { query } = require('./db');
const logger = require('../src/utils/logger');

const TABLE_SQL = `
CREATE TABLE IF NOT EXISTS bot_silent_mutes (
  guild_id VARCHAR(32) NOT NULL,
  user_id VARCHAR(32) NOT NULL,
  added_by VARCHAR(32) NULL,
  reason VARCHAR(255) NULL,
  added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (guild_id, user_id),
  INDEX idx_guild_added_at (guild_id, added_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

async function ensureTable() {
  try {
    await query(TABLE_SQL);
  } catch (err) {
    logger.warn(`SilentMute ensureTable: ${err?.message || err}`);
  }
}

function normalizeUserId(input) {
  if (!input) return null;
  const s = String(input).trim();
  const mention = s.match(/^<@!?(\d+)>$/);
  if (mention) return mention[1];
  const plain = s.match(/^(\d{10,30})$/);
  if (plain) return plain[1];
  const any = s.match(/(\d{10,30})/);
  return any ? any[1] : null;
}

async function addSilentMute({ guildId, userId, addedBy = null, reason = null }) {
  if (!guildId || !userId) return { ok: false, error: 'missing_ids' };
  await ensureTable();
  await query(
    `INSERT INTO bot_silent_mutes (guild_id, user_id, added_by, reason)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       added_by = VALUES(added_by),
       reason = VALUES(reason),
       added_at = CURRENT_TIMESTAMP`,
    [String(guildId), String(userId), addedBy ? String(addedBy) : null, reason || null]
  );
  return { ok: true };
}

async function removeSilentMute(guildId, userId) {
  if (!guildId || !userId) return { ok: false, error: 'missing_ids' };
  await ensureTable();
  await query('DELETE FROM bot_silent_mutes WHERE guild_id = ? AND user_id = ?', [String(guildId), String(userId)]);
  return { ok: true };
}

async function getSilentMute(guildId, userId) {
  if (!guildId || !userId) return { muted: false };
  try {
    await ensureTable();
    const rows = await query(
      `SELECT guild_id, user_id, added_by, reason, added_at
       FROM bot_silent_mutes
       WHERE guild_id = ? AND user_id = ?
       LIMIT 1`,
      [String(guildId), String(userId)]
    );
    if (!rows?.length) return { muted: false };
    return {
      muted: true,
      guild_id: rows[0].guild_id,
      user_id: rows[0].user_id,
      added_by: rows[0].added_by || null,
      reason: rows[0].reason || null,
      added_at: rows[0].added_at || null,
    };
  } catch (err) {
    logger.warn(`SilentMute getSilentMute: ${err?.message || err}`);
    return { muted: false };
  }
}

async function isSilentMuted(guildId, userId) {
  const row = await getSilentMute(guildId, userId);
  return row.muted === true;
}

async function listSilentMutes(guildId, limit = 50) {
  if (!guildId) return [];
  await ensureTable();
  const lim = Math.max(1, Math.min(Number(limit) || 50, 100));
  return query(
    `SELECT guild_id, user_id, added_by, reason, added_at
     FROM bot_silent_mutes
     WHERE guild_id = ?
     ORDER BY added_at DESC
     LIMIT ${lim}`,
    [String(guildId)]
  );
}

module.exports = {
  ensureTable,
  normalizeUserId,
  addSilentMute,
  removeSilentMute,
  getSilentMute,
  isSilentMuted,
  listSilentMutes,
};
