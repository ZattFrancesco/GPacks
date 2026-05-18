// services/customEmbeds.db.js
const { query } = require('./db');
const logger = require('../src/utils/logger');

const TABLE_SQL = `
CREATE TABLE IF NOT EXISTS custom_embeds (
  message_id   VARCHAR(32) NOT NULL,
  channel_id   VARCHAR(32) NOT NULL,
  guild_id     VARCHAR(32) NULL,
  title        VARCHAR(256) NULL,
  description  TEXT NULL,
  footer       VARCHAR(2048) NULL,
  thumbnail    VARCHAR(1024) NULL,
  image        VARCHAR(1024) NULL,
  color        INT UNSIGNED NULL,
  created_by   VARCHAR(32) NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id),
  INDEX idx_guild (guild_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

let _ensured = false;

async function ensureTable() {
  if (_ensured) return;
  try {
    await query(TABLE_SQL);
    _ensured = true;
  } catch (err) {
    logger.warn(`customEmbeds.db ensureTable: ${err?.message || err}`);
  }
}

function rowToEmbed(row) {
  if (!row) return null;
  return {
    messageId: row.message_id,
    channelId: row.channel_id,
    guildId: row.guild_id || null,
    title: row.title || null,
    description: row.description || null,
    footer: row.footer || null,
    thumbnail: row.thumbnail || null,
    image: row.image || null,
    color: row.color == null ? null : Number(row.color),
    createdBy: row.created_by || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

async function getEmbed(messageId) {
  if (!messageId) return null;
  await ensureTable();
  try {
    const rows = await query(
      `SELECT message_id, channel_id, guild_id, title, description, footer,
              thumbnail, image, color, created_by, created_at, updated_at
       FROM custom_embeds WHERE message_id = ? LIMIT 1`,
      [String(messageId)]
    );
    return rows?.length ? rowToEmbed(rows[0]) : null;
  } catch (err) {
    logger.warn(`customEmbeds.db getEmbed: ${err?.message || err}`);
    return null;
  }
}

async function saveEmbed({
  messageId,
  channelId,
  guildId = null,
  title = null,
  description = null,
  footer = null,
  thumbnail = null,
  image = null,
  color = null,
  createdBy = null,
}) {
  if (!messageId || !channelId) {
    return { ok: false, error: 'missing_ids' };
  }
  await ensureTable();
  try {
    await query(
      `INSERT INTO custom_embeds
         (message_id, channel_id, guild_id, title, description, footer,
          thumbnail, image, color, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         channel_id  = VALUES(channel_id),
         guild_id    = VALUES(guild_id),
         title       = VALUES(title),
         description = VALUES(description),
         footer      = VALUES(footer),
         thumbnail   = VALUES(thumbnail),
         image       = VALUES(image),
         color       = VALUES(color)`,
      [
        String(messageId),
        String(channelId),
        guildId ? String(guildId) : null,
        title ? String(title).slice(0, 256) : null,
        description ? String(description) : null,
        footer ? String(footer).slice(0, 2048) : null,
        thumbnail ? String(thumbnail).slice(0, 1024) : null,
        image ? String(image).slice(0, 1024) : null,
        color == null ? null : Number(color),
        createdBy ? String(createdBy) : null,
      ]
    );
    return { ok: true };
  } catch (err) {
    logger.warn(`customEmbeds.db saveEmbed: ${err?.message || err}`);
    return { ok: false, error: 'db_error' };
  }
}

async function deleteEmbed(messageId) {
  if (!messageId) return { ok: false, error: 'missing_id' };
  await ensureTable();
  try {
    const result = await query(
      'DELETE FROM custom_embeds WHERE message_id = ?',
      [String(messageId)]
    );
    return { ok: true, removed: Number(result?.affectedRows || 0) > 0 };
  } catch (err) {
    logger.warn(`customEmbeds.db deleteEmbed: ${err?.message || err}`);
    return { ok: false, error: 'db_error' };
  }
}

module.exports = {
  ensureTable,
  getEmbed,
  saveEmbed,
  deleteEmbed,
};
