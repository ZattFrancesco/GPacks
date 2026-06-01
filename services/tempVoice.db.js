// services/tempVoice.db.js
const { query } = require('./db');
const logger = require('../src/utils/logger');

// ─── Schéma ──────────────────────────────────────────────────────────────────
// guild_temp_voice_config : salons "hub" configurés par les admins
//   guild_id      → ID du serveur
//   hub_channel_id→ ID du salon vocal qui déclenche la création
//   template      → gabarit du nom  (ex: "🎮 {user}" / "{user}'s room")
//   category_id   → optionnel : créer la voc dans cette catégorie
//
// guild_temp_voice_active : vocales créées dynamiquement
//   channel_id    → ID du salon temporaire
//   guild_id
//   owner_id      → membre qui a déclenché la création
//   hub_channel_id→ hub source
// ─────────────────────────────────────────────────────────────────────────────

const TABLE_CONFIG = `
CREATE TABLE IF NOT EXISTS guild_temp_voice_config (
  guild_id       VARCHAR(32) NOT NULL,
  hub_channel_id VARCHAR(32) NOT NULL,
  template       VARCHAR(100) NOT NULL DEFAULT '🔊 {user}',
  category_id    VARCHAR(32) NULL,
  created_by     VARCHAR(32) NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (guild_id, hub_channel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

const TABLE_ACTIVE = `
CREATE TABLE IF NOT EXISTS guild_temp_voice_active (
  channel_id     VARCHAR(32) NOT NULL,
  guild_id       VARCHAR(32) NOT NULL,
  owner_id       VARCHAR(32) NOT NULL,
  hub_channel_id VARCHAR(32) NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (channel_id),
  INDEX idx_guild (guild_id),
  INDEX idx_owner (guild_id, owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

let _ensured = false;

async function ensureTable() {
  if (_ensured) return;
  try {
    await query(TABLE_CONFIG);
    await query(TABLE_ACTIVE);
    _ensured = true;
  } catch (err) {
    logger.warn(`tempVoice.db ensureTable: ${err?.message || err}`);
  }
}

// ─── Config (hub) ─────────────────────────────────────────────────────────────

async function setConfig({ guildId, hubChannelId, template, categoryId = null, createdBy = null }) {
  await ensureTable();
  try {
    await query(
      `INSERT INTO guild_temp_voice_config (guild_id, hub_channel_id, template, category_id, created_by)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         template    = VALUES(template),
         category_id = VALUES(category_id),
         created_by  = VALUES(created_by)`,
      [
        String(guildId),
        String(hubChannelId),
        String(template).slice(0, 100),
        categoryId ? String(categoryId) : null,
        createdBy ? String(createdBy) : null,
      ]
    );
    return { ok: true };
  } catch (err) {
    logger.warn(`tempVoice.db setConfig: ${err?.message || err}`);
    return { ok: false, error: 'db_error' };
  }
}

async function getConfig(guildId, hubChannelId) {
  await ensureTable();
  try {
    const rows = await query(
      'SELECT * FROM guild_temp_voice_config WHERE guild_id = ? AND hub_channel_id = ? LIMIT 1',
      [String(guildId), String(hubChannelId)]
    );
    if (!rows?.length) return null;
    return {
      guildId:      rows[0].guild_id,
      hubChannelId: rows[0].hub_channel_id,
      template:     rows[0].template,
      categoryId:   rows[0].category_id || null,
      createdBy:    rows[0].created_by  || null,
    };
  } catch (err) {
    logger.warn(`tempVoice.db getConfig: ${err?.message || err}`);
    return null;
  }
}

async function getAllConfigs(guildId) {
  await ensureTable();
  try {
    const rows = await query(
      'SELECT * FROM guild_temp_voice_config WHERE guild_id = ?',
      [String(guildId)]
    );
    return (rows || []).map(r => ({
      guildId:      r.guild_id,
      hubChannelId: r.hub_channel_id,
      template:     r.template,
      categoryId:   r.category_id || null,
    }));
  } catch (err) {
    logger.warn(`tempVoice.db getAllConfigs: ${err?.message || err}`);
    return [];
  }
}

async function deleteConfig(guildId, hubChannelId) {
  await ensureTable();
  try {
    const result = await query(
      'DELETE FROM guild_temp_voice_config WHERE guild_id = ? AND hub_channel_id = ?',
      [String(guildId), String(hubChannelId)]
    );
    return { ok: true, removed: Number(result?.affectedRows || 0) > 0 };
  } catch (err) {
    logger.warn(`tempVoice.db deleteConfig: ${err?.message || err}`);
    return { ok: false, error: 'db_error' };
  }
}

// ─── Salons actifs ────────────────────────────────────────────────────────────

async function registerActive({ channelId, guildId, ownerId, hubChannelId }) {
  await ensureTable();
  try {
    await query(
      `INSERT IGNORE INTO guild_temp_voice_active (channel_id, guild_id, owner_id, hub_channel_id)
       VALUES (?, ?, ?, ?)`,
      [String(channelId), String(guildId), String(ownerId), String(hubChannelId)]
    );
    return { ok: true };
  } catch (err) {
    logger.warn(`tempVoice.db registerActive: ${err?.message || err}`);
    return { ok: false, error: 'db_error' };
  }
}

async function getActive(channelId) {
  await ensureTable();
  try {
    const rows = await query(
      'SELECT * FROM guild_temp_voice_active WHERE channel_id = ? LIMIT 1',
      [String(channelId)]
    );
    if (!rows?.length) return null;
    return {
      channelId:    rows[0].channel_id,
      guildId:      rows[0].guild_id,
      ownerId:      rows[0].owner_id,
      hubChannelId: rows[0].hub_channel_id,
    };
  } catch (err) {
    logger.warn(`tempVoice.db getActive: ${err?.message || err}`);
    return null;
  }
}

async function removeActive(channelId) {
  await ensureTable();
  try {
    await query(
      'DELETE FROM guild_temp_voice_active WHERE channel_id = ?',
      [String(channelId)]
    );
    return { ok: true };
  } catch (err) {
    logger.warn(`tempVoice.db removeActive: ${err?.message || err}`);
    return { ok: false, error: 'db_error' };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Remplace les variables dans le template :
 *   {user}       → nom d'affichage du membre (displayName)
 *   {username}   → nom d'utilisateur Discord
 *   {tag}        → user#discrim  (ou juste username si pas de discrim)
 *   {count}      → nombre de membres actuellement dans le salon (passé manuellement)
 */
function applyTemplate(template, { member, count = '' }) {
  if (!template) return '🔊 Vocal';
  const displayName = member?.displayName || member?.user?.username || 'Utilisateur';
  const username    = member?.user?.username || displayName;
  const tag         = member?.user?.tag || username;

  return String(template)
    .replace(/\{user\}/gi,     displayName)
    .replace(/\{username\}/gi, username)
    .replace(/\{tag\}/gi,      tag)
    .replace(/\{count\}/gi,    String(count));
}

module.exports = {
  ensureTable,
  setConfig,
  getConfig,
  getAllConfigs,
  deleteConfig,
  registerActive,
  getActive,
  removeActive,
  applyTemplate,
};
