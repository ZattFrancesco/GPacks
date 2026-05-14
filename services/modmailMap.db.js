const { query } = require('./db');
const logger = require('../src/utils/logger');

const TABLE_SQL = `
CREATE TABLE IF NOT EXISTS bot_modmail_msg_map (
  thread_id        VARCHAR(32) NOT NULL,
  thread_msg_id    VARCHAR(32) NOT NULL,
  dm_channel_id    VARCHAR(32) NOT NULL,
  dm_msg_id        VARCHAR(32) NOT NULL,
  user_id          VARCHAR(32) NOT NULL,
  direction        ENUM('incoming','outgoing') NOT NULL,
  webhook_id       VARCHAR(32) NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (thread_msg_id),
  UNIQUE KEY uniq_dm_msg (dm_msg_id),
  INDEX idx_thread (thread_id),
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

let _ensured = false;

async function ensureTable() {
  if (_ensured) return;
  try {
    await query(TABLE_SQL);
    _ensured = true;
  } catch (err) {
    logger.warn(`ModmailMap ensureTable: ${err?.message || err}`);
  }
}

/**
 * Enregistre une paire thread_msg <-> dm_msg.
 * direction = 'incoming' : DM user → webhook posté dans thread
 * direction = 'outgoing' : message owner dans thread → DM envoyé au user
 */
async function saveMapping({
  threadId, threadMsgId, dmChannelId, dmMsgId, userId, direction, webhookId = null,
}) {
  if (!threadMsgId || !dmMsgId) return;
  await ensureTable();
  try {
    await query(
      `INSERT INTO bot_modmail_msg_map
        (thread_id, thread_msg_id, dm_channel_id, dm_msg_id, user_id, direction, webhook_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        thread_id = VALUES(thread_id),
        dm_channel_id = VALUES(dm_channel_id),
        dm_msg_id = VALUES(dm_msg_id),
        user_id = VALUES(user_id),
        direction = VALUES(direction),
        webhook_id = VALUES(webhook_id)`,
      [
        String(threadId),
        String(threadMsgId),
        String(dmChannelId),
        String(dmMsgId),
        String(userId),
        direction,
        webhookId ? String(webhookId) : null,
      ]
    );
  } catch (err) {
    logger.warn(`ModmailMap saveMapping: ${err?.message || err}`);
  }
}

async function getByThreadMsg(threadMsgId) {
  if (!threadMsgId) return null;
  await ensureTable();
  try {
    const rows = await query(
      `SELECT * FROM bot_modmail_msg_map WHERE thread_msg_id = ? LIMIT 1`,
      [String(threadMsgId)]
    );
    return rows?.[0] || null;
  } catch (err) {
    logger.warn(`ModmailMap getByThreadMsg: ${err?.message || err}`);
    return null;
  }
}

async function getByDmMsg(dmMsgId) {
  if (!dmMsgId) return null;
  await ensureTable();
  try {
    const rows = await query(
      `SELECT * FROM bot_modmail_msg_map WHERE dm_msg_id = ? LIMIT 1`,
      [String(dmMsgId)]
    );
    return rows?.[0] || null;
  } catch (err) {
    logger.warn(`ModmailMap getByDmMsg: ${err?.message || err}`);
    return null;
  }
}

async function deleteByThreadMsg(threadMsgId) {
  if (!threadMsgId) return;
  await ensureTable();
  try {
    await query(`DELETE FROM bot_modmail_msg_map WHERE thread_msg_id = ?`, [String(threadMsgId)]);
  } catch (err) {
    logger.warn(`ModmailMap deleteByThreadMsg: ${err?.message || err}`);
  }
}

async function deleteByDmMsg(dmMsgId) {
  if (!dmMsgId) return;
  await ensureTable();
  try {
    await query(`DELETE FROM bot_modmail_msg_map WHERE dm_msg_id = ?`, [String(dmMsgId)]);
  } catch (err) {
    logger.warn(`ModmailMap deleteByDmMsg: ${err?.message || err}`);
  }
}

module.exports = {
  ensureTable,
  saveMapping,
  getByThreadMsg,
  getByDmMsg,
  deleteByThreadMsg,
  deleteByDmMsg,
};
