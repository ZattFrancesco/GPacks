
const { query } = require('./db');
const logger = require('../src/utils/logger');

const TABLE_SQL = `
CREATE TABLE IF NOT EXISTS logs_config (
  guild_id VARCHAR(32) NOT NULL,
  channel_id VARCHAR(32) NULL,
  enabled_types_json LONGTEXT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (guild_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

const LOG_TYPE_GROUPS = [
  {
    key: 'messages',
    label: 'Messages',
    emoji: '💬',
    types: [
      ['message_create_link', 'Messages avec lien'],
      ['message_delete', 'Message supprimé'],
      ['message_update', 'Message modifié'],
      ['message_bulk_delete', 'Suppression multiple'],
      ['message_reaction_add', 'Réaction ajoutée'],
      ['message_reaction_remove', 'Réaction retirée'],
      ['channel_pins_update', 'Pins modifiés'],
    ],
  },
  {
    key: 'members',
    label: 'Membres',
    emoji: '👥',
    types: [
      ['guild_member_add', 'Arrivée membre'],
      ['guild_member_remove', 'Départ membre'],
      ['guild_member_update', 'Membre modifié'],
      ['guild_ban_add', 'Ban'],
      ['guild_ban_remove', 'Unban'],
      ['user_update', 'Profil utilisateur global'],
    ],
  },
  {
    key: 'channels_roles',
    label: 'Salons & rôles',
    emoji: '🛠️',
    types: [
      ['channel_create', 'Salon créé'],
      ['channel_delete', 'Salon supprimé'],
      ['channel_update', 'Salon modifié'],
      ['role_create', 'Rôle créé'],
      ['role_delete', 'Rôle supprimé'],
      ['role_update', 'Rôle modifié'],
      ['webhooks_update', 'Webhooks modifiés'],
    ],
  },
  {
    key: 'community',
    label: 'Communauté',
    emoji: '🌐',
    types: [
      ['invite_create', 'Invitation créée'],
      ['invite_delete', 'Invitation supprimée'],
      ['thread_create', 'Thread créé'],
      ['thread_delete', 'Thread supprimé'],
      ['thread_update', 'Thread modifié'],
      ['guild_emoji_create', 'Emoji créé'],
      ['guild_emoji_delete', 'Emoji supprimé'],
      ['guild_emoji_update', 'Emoji modifié'],
      ['sticker_create', 'Sticker créé'],
      ['sticker_delete', 'Sticker supprimé'],
      ['sticker_update', 'Sticker modifié'],
    ],
  },
  {
    key: 'voice_events',
    label: 'Vocal & événements',
    emoji: '🔊',
    types: [
      ['voice_state_update', 'État vocal'],
      ['stage_instance_create', 'Stage créé'],
      ['stage_instance_delete', 'Stage supprimé'],
      ['stage_instance_update', 'Stage modifié'],
      ['guild_scheduled_event_create', 'Événement planifié créé'],
      ['guild_scheduled_event_delete', 'Événement planifié supprimé'],
      ['guild_scheduled_event_update', 'Événement planifié modifié'],
      ['guild_scheduled_event_user_add', 'Inscription événement'],
      ['guild_scheduled_event_user_remove', 'Désinscription événement'],
    ],
  },
  {
    key: 'moderation_tools',
    label: 'Outils staff',
    emoji: '🛡️',
    types: [
      ['silent_mute', 'Silent mute'],
      ['slash_command', 'Commandes slash'],
      ['interaction_error', 'Erreurs interactions'],
    ],
  },
];

const LOG_TYPE_LABELS = Object.fromEntries(
  LOG_TYPE_GROUPS.flatMap((group) => group.types.map(([key, label]) => [key, label]))
);
const ALL_LOG_TYPES = LOG_TYPE_GROUPS.flatMap((group) => group.types.map(([key]) => key));

let _ensured = false;

async function ensureTable() {
  if (_ensured) return;
  try {
    await query(TABLE_SQL);
    const columns = await query('SHOW COLUMNS FROM logs_config LIKE "enabled_types_json"');
    if (!columns?.length) {
      await query('ALTER TABLE logs_config ADD COLUMN enabled_types_json LONGTEXT NULL AFTER channel_id');
    }
    _ensured = true;
  } catch (err) {
    logger.warn(`logs.db ensureTable: ${err?.message || err}`);
  }
}

function normalizeEnabledTypes(value) {
  if (!value) return null;
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(parsed)) return null;
  const clean = [...new Set(parsed.map(String).filter((key) => ALL_LOG_TYPES.includes(key)))];
  return clean;
}

async function getConfig(guildId) {
  if (!guildId) return null;
  await ensureTable();
  const rows = await query(
    'SELECT guild_id, channel_id, enabled_types_json FROM logs_config WHERE guild_id = ? LIMIT 1',
    [String(guildId)]
  );
  if (!rows?.length) return null;
  return {
    guildId: rows[0].guild_id,
    channelId: rows[0].channel_id || null,
    enabledTypes: normalizeEnabledTypes(rows[0].enabled_types_json),
  };
}

async function setConfig(guildId, channelId) {
  if (!guildId) return { ok: false, error: 'missing_guildId' };
  await ensureTable();
  await query(
    `INSERT INTO logs_config (guild_id, channel_id)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE channel_id = VALUES(channel_id)`,
    [String(guildId), channelId ? String(channelId) : null]
  );
  return { ok: true };
}

async function setEnabledTypes(guildId, enabledTypes) {
  if (!guildId) return { ok: false, error: 'missing_guildId' };
  await ensureTable();
  const normalized = normalizeEnabledTypes(enabledTypes);
  await query(
    `INSERT INTO logs_config (guild_id, channel_id, enabled_types_json)
     VALUES (?, NULL, ?)
     ON DUPLICATE KEY UPDATE enabled_types_json = VALUES(enabled_types_json)`,
    [String(guildId), normalized ? JSON.stringify(normalized) : null]
  );
  return { ok: true, enabledTypes: normalized };
}

async function isTypeEnabled(guildId, type) {
  if (!guildId || !type) return true;
  const cfg = await getConfig(guildId);
  if (!cfg?.enabledTypes) return true;
  return cfg.enabledTypes.includes(String(type));
}

async function listEnabledGuildIds() {
  await ensureTable();
  const rows = await query(
    'SELECT guild_id FROM logs_config WHERE channel_id IS NOT NULL AND channel_id <> ""'
  );
  return rows.map((r) => String(r.guild_id));
}

function getLogTypeGroups() {
  return LOG_TYPE_GROUPS.map((group) => ({
    ...group,
    types: group.types.map(([key, label]) => ({ key, label })),
  }));
}

module.exports = {
  ensureTable,
  getConfig,
  setConfig,
  setEnabledTypes,
  isTypeEnabled,
  listEnabledGuildIds,
  getLogTypeGroups,
  ALL_LOG_TYPES,
  LOG_TYPE_LABELS,
};
