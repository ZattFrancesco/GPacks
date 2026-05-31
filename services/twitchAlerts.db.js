// services/twitchAlerts.db.js
const { query } = require('./db');
const logger = require('../src/utils/logger');

const TABLE_SQL = `
CREATE TABLE IF NOT EXISTS twitch_alerts (
  id          INT UNSIGNED AUTO_INCREMENT,
  guild_id    VARCHAR(32)  NOT NULL,
  twitch_login VARCHAR(64) NOT NULL,
  channel_id  VARCHAR(32)  NOT NULL,
  role_id     VARCHAR(32)  NULL,
  live        TINYINT(1)   NOT NULL DEFAULT 0,
  added_by    VARCHAR(32)  NULL,
  added_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_guild_channel (guild_id, twitch_login)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

let _ensured = false;

async function ensureTable() {
  if (_ensured) return;
  try {
    await query(TABLE_SQL);
    _ensured = true;
  } catch (err) {
    logger.warn(`twitchAlerts.db ensureTable: ${err?.message || err}`);
  }
}

/** Ajoute ou met à jour une alerte Twitch pour une guilde. */
async function addAlert({ guildId, twitchLogin, channelId, roleId = null, addedBy = null }) {
  await ensureTable();
  try {
    await query(
      `INSERT INTO twitch_alerts (guild_id, twitch_login, channel_id, role_id, added_by)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         channel_id = VALUES(channel_id),
         role_id    = VALUES(role_id),
         added_by   = VALUES(added_by),
         live       = 0`,
      [
        String(guildId),
        String(twitchLogin).toLowerCase(),
        String(channelId),
        roleId ? String(roleId) : null,
        addedBy ? String(addedBy) : null,
      ]
    );
    return { ok: true };
  } catch (err) {
    logger.warn(`twitchAlerts.db addAlert: ${err?.message || err}`);
    return { ok: false, error: 'db_error' };
  }
}

/** Retire une alerte Twitch d'une guilde. */
async function removeAlert({ guildId, twitchLogin }) {
  await ensureTable();
  try {
    const result = await query(
      'DELETE FROM twitch_alerts WHERE guild_id = ? AND twitch_login = ?',
      [String(guildId), String(twitchLogin).toLowerCase()]
    );
    return { ok: true, removed: Number(result?.affectedRows || 0) > 0 };
  } catch (err) {
    logger.warn(`twitchAlerts.db removeAlert: ${err?.message || err}`);
    return { ok: false, error: 'db_error' };
  }
}

/** Récupère toutes les alertes d'une guilde. */
async function listAlerts(guildId) {
  await ensureTable();
  try {
    return await query(
      'SELECT * FROM twitch_alerts WHERE guild_id = ? ORDER BY twitch_login ASC',
      [String(guildId)]
    );
  } catch (err) {
    logger.warn(`twitchAlerts.db listAlerts: ${err?.message || err}`);
    return [];
  }
}

/** Récupère toutes les alertes (toutes guildes) — utilisé par le poller. */
async function getAllAlerts() {
  await ensureTable();
  try {
    return await query('SELECT * FROM twitch_alerts');
  } catch (err) {
    logger.warn(`twitchAlerts.db getAllAlerts: ${err?.message || err}`);
    return [];
  }
}

/** Met à jour l'état live d'une entrée. */
async function setLiveStatus({ guildId, twitchLogin, live }) {
  await ensureTable();
  try {
    await query(
      'UPDATE twitch_alerts SET live = ? WHERE guild_id = ? AND twitch_login = ?',
      [live ? 1 : 0, String(guildId), String(twitchLogin).toLowerCase()]
    );
  } catch (err) {
    logger.warn(`twitchAlerts.db setLiveStatus: ${err?.message || err}`);
  }
}

module.exports = {
  ensureTable,
  addAlert,
  removeAlert,
  listAlerts,
  getAllAlerts,
  setLiveStatus,
};
