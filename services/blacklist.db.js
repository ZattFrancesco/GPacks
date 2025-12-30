// services/blacklist.db.js
const { query } = require("./db");
const logger = require("../src/utils/logger");

const TABLE_SQL = `
CREATE TABLE IF NOT EXISTS bot_blacklist (
  user_id VARCHAR(32) NOT NULL,
  reason VARCHAR(255) NULL,
  added_by VARCHAR(32) NULL,
  added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

async function ensureTable() {
  try {
    await query(TABLE_SQL);
  } catch (err) {
    logger.warn(`Blacklist ensureTable: ${err?.message || err}`);
  }
}

function normalizeUserId(input) {
  if (!input) return null;
  const s = String(input).trim();

  // <@123> ou <@!123>
  const m = s.match(/^<@!?(\d+)>$/);
  if (m) return m[1];

  // juste chiffres
  const d = s.match(/^(\d{10,30})$/);
  if (d) return d[1];

  // si quelqu’un colle un truc avec des chiffres dedans
  const any = s.match(/(\d{10,30})/);
  return any ? any[1] : null;
}

async function isBlacklisted(userId) {
  if (!userId) return { blacklisted: false };
  try {
    await ensureTable();
    const rows = await query(
      "SELECT user_id, reason, added_by, added_at FROM bot_blacklist WHERE user_id = ? LIMIT 1",
      [String(userId)]
    );
    if (!rows?.length) return { blacklisted: false };
    return {
      blacklisted: true,
      reason: rows[0].reason || null,
      added_by: rows[0].added_by || null,
      added_at: rows[0].added_at || null,
    };
  } catch (err) {
    logger.warn(`Blacklist isBlacklisted: ${err?.message || err}`);
    return { blacklisted: false };
  }
}

async function addToBlacklist({ userId, reason = null, addedBy = null }) {
  if (!userId) return { ok: false, error: "missing_userId" };
  await ensureTable();
  await query(
    `INSERT INTO bot_blacklist (user_id, reason, added_by)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       reason = VALUES(reason),
       added_by = VALUES(added_by),
       added_at = CURRENT_TIMESTAMP`,
    [String(userId), reason, addedBy ? String(addedBy) : null]
  );
  return { ok: true };
}

async function removeFromBlacklist(userId) {
  if (!userId) return { ok: false, error: "missing_userId" };
  await ensureTable();
  await query("DELETE FROM bot_blacklist WHERE user_id = ?", [String(userId)]);
  return { ok: true };
}

async function listBlacklisted(limit = 25) {
  await ensureTable();
  const lim = Math.max(1, Math.min(Number(limit) || 25, 100));
  return await query(
    `SELECT user_id, reason, added_by, added_at
     FROM bot_blacklist
     ORDER BY added_at DESC
     LIMIT ${lim}`
  );
}

module.exports = {
  ensureTable,
  normalizeUserId,
  isBlacklisted,
  addToBlacklist,
  removeFromBlacklist,
  listBlacklisted,
};