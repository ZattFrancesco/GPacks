const { query } = require('./db');
const logger = require('../src/utils/logger');

const TABLE_SQL = `
CREATE TABLE IF NOT EXISTS guild_welcome_messages (
  guild_id    VARCHAR(32) NOT NULL,
  title       VARCHAR(256) NULL,
  message     TEXT NOT NULL,
  updated_by  VARCHAR(32) NULL,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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
    logger.warn(`welcomeMessage.db ensureTable: ${err?.message || err}`);
  }
}

async function getWelcomeMessage(guildId) {
  if (!guildId) return null;
  await ensureTable();
  try {
    const rows = await query(
      'SELECT guild_id, title, message, updated_by, updated_at FROM guild_welcome_messages WHERE guild_id = ? LIMIT 1',
      [String(guildId)]
    );
    if (!rows?.length) return null;
    return {
      guildId: rows[0].guild_id,
      title: rows[0].title || null,
      message: rows[0].message || '',
      updatedBy: rows[0].updated_by || null,
      updatedAt: rows[0].updated_at || null,
    };
  } catch (err) {
    logger.warn(`welcomeMessage.db getWelcomeMessage: ${err?.message || err}`);
    return null;
  }
}

async function setWelcomeMessage({ guildId, title = null, message, updatedBy = null }) {
  if (!guildId) return { ok: false, error: 'missing_guildId' };
  if (!message || !String(message).trim()) return { ok: false, error: 'empty_message' };
  await ensureTable();
  try {
    await query(
      `INSERT INTO guild_welcome_messages (guild_id, title, message, updated_by)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         title = VALUES(title),
         message = VALUES(message),
         updated_by = VALUES(updated_by)`,
      [
        String(guildId),
        title ? String(title).slice(0, 256) : null,
        String(message),
        updatedBy ? String(updatedBy) : null,
      ]
    );
    return { ok: true };
  } catch (err) {
    logger.warn(`welcomeMessage.db setWelcomeMessage: ${err?.message || err}`);
    return { ok: false, error: 'db_error' };
  }
}

async function clearWelcomeMessage(guildId) {
  if (!guildId) return { ok: false, error: 'missing_guildId' };
  await ensureTable();
  try {
    const result = await query(
      'DELETE FROM guild_welcome_messages WHERE guild_id = ?',
      [String(guildId)]
    );
    return { ok: true, removed: Number(result?.affectedRows || 0) > 0 };
  } catch (err) {
    logger.warn(`welcomeMessage.db clearWelcomeMessage: ${err?.message || err}`);
    return { ok: false, error: 'db_error' };
  }
}

/**
 * Remplace les variables dans un template :
 *   {user}        → mention <@id>
 *   {username}    → nom d'utilisateur (sans tag/discriminateur)
 *   {server}      → nom du serveur
 *   {membercount} → nombre total de membres
 */
function applyVariables(template, { member, guild }) {
  if (!template) return '';
  const username = member?.user?.username || member?.user?.tag || 'utilisateur';
  const mention = member?.user?.id ? `<@${member.user.id}>` : username;
  return String(template)
    .replace(/\{user\}/gi, mention)
    .replace(/\{username\}/gi, username)
    .replace(/\{server\}/gi, guild?.name || 'le serveur')
    .replace(/\{membercount\}/gi, String(guild?.memberCount ?? '?'));
}

module.exports = {
  ensureTable,
  getWelcomeMessage,
  setWelcomeMessage,
  clearWelcomeMessage,
  applyVariables,
};
