// services/defcon.db.js
// Config DEFCON (messages + channel) - GLOBAL (pas par serveur)

const { query } = require("./db");

let ensured = false;

async function ensureTables() {
  if (ensured) return;
  ensured = true;

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

  await query(
    `CREATE TABLE IF NOT EXISTS doj_defcon_settings (
      id TINYINT NOT NULL,
      channel_id VARCHAR(32) NULL,
      ping_role_id VARCHAR(32) NULL,
      last_message_id VARCHAR(32) NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  );

// Migration: ajoute les colonnes si la table existait déjà avant (ALTER TABLE)
try { await query(`ALTER TABLE doj_defcon_settings ADD COLUMN ping_role_id VARCHAR(32) NULL`); } catch {}
try { await query(`ALTER TABLE doj_defcon_settings ADD COLUMN last_message_id VARCHAR(32) NULL`); } catch {}


  // Default settings row
  await query(`INSERT IGNORE INTO doj_defcon_settings (id, channel_id, ping_role_id, last_message_id) VALUES (1, NULL, NULL, NULL);`);

  // Default messages if missing
  for (const lvl of [1, 2, 3]) {
    await query(
      `INSERT IGNORE INTO doj_defcon_messages (level, message, color, footer)
       VALUES (?, ?, ?, ?)`,
      [lvl, `DEFCON ${lvl} activé.`, 0x2b2d31, null]
    );
  }
}

async function getDefconMessage(level) {
  await ensureTables();
  const rows = await query(`SELECT * FROM doj_defcon_messages WHERE level = ? LIMIT 1`, [level]);
  return rows?.[0] || null;
}

async function upsertDefconMessage({ level, message, color, footer }) {
  await ensureTables();
  await query(
    `INSERT INTO doj_defcon_messages (level, message, color, footer)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE message = VALUES(message), color = VALUES(color), footer = VALUES(footer)`,
    [level, message, color ?? null, footer ?? null]
  );
}

async function getDefconSettings() {
  await ensureTables();
  const rows = await query(
    `SELECT channel_id, ping_role_id, last_message_id FROM doj_defcon_settings WHERE id = 1 LIMIT 1`
  );
  const r = rows?.[0] || {};
  return {
    channel_id: r.channel_id || null,
    ping_role_id: r.ping_role_id || null,
    last_message_id: r.last_message_id || null,
  };
}

async function setDefconChannelConfig({ channelId, pingRoleId }) {
  await ensureTables();
  await query(
    `UPDATE doj_defcon_settings
     SET channel_id = ?, ping_role_id = ?
     WHERE id = 1`,
    [channelId || null, pingRoleId || null]
  );
}

async function setLastDefconMessageId(messageId) {
  await ensureTables();
  await query(
    `UPDATE doj_defcon_settings SET last_message_id = ? WHERE id = 1`,
    [messageId || null]
  );
}

module.exports = {
  ensureTables,
  getDefconMessage,
  upsertDefconMessage,
  getDefconSettings,
  setDefconChannelConfig,
  setLastDefconMessageId,
};
