// services/defcon.db.js
// DEFCON
// - Messages: GLOBAUX (1/2/3) dans la DB
// - Canaux: PAR SERVEUR (guild_id -> channel_id + ping_role_id + last_message_id)

const { query } = require("./db");

let ensured = false;

async function ensureTables() {
  if (ensured) return;
  ensured = true;

  // Messages globaux (niveau 1/2/3)
  await query(
    `CREATE TABLE IF NOT EXISTS doj_defcon_messages (
      level TINYINT NOT NULL,
      message TEXT NOT NULL,
      color INT NULL,
      footer VARCHAR(255) NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (level)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  );

  // Canaux par serveur
  await query(
    `CREATE TABLE IF NOT EXISTS doj_defcon_channels (
      guild_id VARCHAR(32) NOT NULL,
      channel_id VARCHAR(32) NULL,
      ping_role_id VARCHAR(32) NULL,
      last_message_id VARCHAR(32) NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (guild_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  );

  // Migration douce (si tu avais déjà l'ancienne table globale)
  // On évite les ALTER qui spam les logs en vérifiant d'abord l'existence des colonnes.
  const columnExists = async (table, column) => {
    const r = await query(
      `SELECT COUNT(*) AS c
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    );
    return Number(r?.[0]?.c || 0) > 0;
  };

  if (!(await columnExists('doj_defcon_messages', 'footer'))) {
    await query(`ALTER TABLE doj_defcon_messages ADD COLUMN footer VARCHAR(255) NULL`);
  }
  if (!(await columnExists('doj_defcon_messages', 'color'))) {
    await query(`ALTER TABLE doj_defcon_messages ADD COLUMN color INT NULL`);
  }

  // Default messages si manquants
  for (const lvl of [1, 2, 3]) {
    await query(
      `INSERT IGNORE INTO doj_defcon_messages (level, message, color, footer)
       VALUES (?, ?, NULL, NULL)`,
      [lvl, `DEFCON ${lvl} activé.`]
    );
  }
}

async function getDefconMessage(level) {
  await ensureTables();
  // NOTE: services/db.js::query() retourne DIRECTEMENT `rows` (Array),
  // pas une tuple [rows, fields]. Donc on ne doit PAS destructurer.
  const rows = await query(
    `SELECT level, message, color, footer FROM doj_defcon_messages WHERE level = ?`,
    [Number(level)]
  );
  return rows?.[0] || null;
}

async function upsertDefconMessage({ level, message, color, footer }) {
  await ensureTables();
  await query(
    `INSERT INTO doj_defcon_messages (level, message, color, footer)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE message = VALUES(message), color = VALUES(color), footer = VALUES(footer)`,
    [Number(level), String(message), color ?? null, footer ?? null]
  );
}

async function getChannelConfig(guildId) {
  await ensureTables();
  const rows = await query(
    `SELECT guild_id, channel_id, ping_role_id, last_message_id
     FROM doj_defcon_channels WHERE guild_id = ?`,
    [String(guildId)]
  );
  return rows?.[0] || null;
}

async function getAllChannelConfigs() {
  await ensureTables();
  const rows = await query(
    `SELECT guild_id, channel_id, ping_role_id, last_message_id
     FROM doj_defcon_channels
     WHERE channel_id IS NOT NULL`
  );
  return rows || [];
}

async function setDefconChannelConfig({ guildId, channelId, pingRoleId }) {
  await ensureTables();
  await query(
    `INSERT INTO doj_defcon_channels (guild_id, channel_id, ping_role_id, last_message_id)
     VALUES (?, ?, ?, NULL)
     ON DUPLICATE KEY UPDATE channel_id = VALUES(channel_id), ping_role_id = VALUES(ping_role_id), last_message_id = NULL`,
    [String(guildId), channelId ? String(channelId) : null, pingRoleId ? String(pingRoleId) : null]
  );
}

async function setLastDefconMessageId(guildId, messageId) {
  await ensureTables();
  await query(
    `UPDATE doj_defcon_channels SET last_message_id = ? WHERE guild_id = ?`,
    [messageId || null, String(guildId)]
  );
}

module.exports = {
  ensureTables,
  getDefconMessage,
  upsertDefconMessage,

  // per-guild channels
  getChannelConfig,
  getAllChannelConfigs,
  setDefconChannelConfig,
  setLastDefconMessageId,
};