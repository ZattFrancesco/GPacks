// services/tickets.db.js
// DB layer pour le module Tickets (types, panels, tickets)

const { query } = require("./db");

let ensured = false;

function normalizeId(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "");
}

function safeJsonParse(v, fallback) {
  try {
    if (v === null || v === undefined) return fallback;
    if (typeof v === "object") return v;
    return JSON.parse(String(v));
  } catch {
    return fallback;
  }
}

async function ensureTables() {
  if (ensured) return;

  // Petit helper: éviter les ALTER bruyants ("Duplicate column")
  // en vérifiant d'abord si la colonne existe.
  async function columnExists(tableName, columnName) {
    const rows = await query(
      `SELECT COUNT(*) AS c
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND COLUMN_NAME = ?`,
      [tableName, columnName]
    );
    const c = rows && rows[0] ? Number(rows[0].c) : 0;
    return c > 0;
  }

  // Types
  await query(`
    CREATE TABLE IF NOT EXISTS doj_ticket_types (
      id VARCHAR(64) NOT NULL,
      guild_id VARCHAR(32) NOT NULL,

      label VARCHAR(80) NOT NULL,
      emoji VARCHAR(32) NULL,
      namemodalrename TINYINT(1) NOT NULL DEFAULT 0,

      category_opened_id VARCHAR(32) NULL,
      staff_role_ids_json TEXT NULL,

      open_ping_role_id VARCHAR(32) NULL,

      custom_embed_enabled TINYINT(1) NOT NULL DEFAULT 0,
      custom_embed_title VARCHAR(256) NULL,
      custom_embed_description TEXT NULL,

      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      PRIMARY KEY (guild_id, id),
      INDEX idx_guild (guild_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Panels
  await query(`
    CREATE TABLE IF NOT EXISTS doj_ticket_panels (
      id VARCHAR(64) NOT NULL,
      guild_id VARCHAR(32) NOT NULL,

      channel_id VARCHAR(32) NOT NULL,
      message_id VARCHAR(32) NULL,

      title VARCHAR(256) NOT NULL,
      description TEXT NOT NULL,
      color INT NULL,
      style VARCHAR(16) NOT NULL DEFAULT 'menu',
      required_role_id VARCHAR(32) NULL,

      logo_url TEXT NULL,
      banner_url TEXT NULL,

      type_ids_json TEXT NOT NULL,

      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      PRIMARY KEY (guild_id, id),
      INDEX idx_guild (guild_id),
      INDEX idx_message (guild_id, message_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Tickets
  await query(`
    CREATE TABLE IF NOT EXISTS doj_tickets (
      ticket_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      guild_id VARCHAR(32) NOT NULL,
      channel_id VARCHAR(32) NOT NULL,

      panel_id VARCHAR(64) NOT NULL,
      type_id VARCHAR(64) NOT NULL,

      author_user_id VARCHAR(32) NOT NULL,
      nom VARCHAR(128) NULL,
      prenom VARCHAR(128) NULL,

      status VARCHAR(16) NOT NULL DEFAULT 'open',
      opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      closed_at TIMESTAMP NULL,
      deleted_at TIMESTAMP NULL,

      PRIMARY KEY (ticket_id),
      UNIQUE KEY uniq_guild_channel (guild_id, channel_id),
      INDEX idx_guild_status (guild_id, status),
      INDEX idx_guild_author (guild_id, author_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);


  // Migrations légères (silencieuses) : on ajoute seulement si manquant.
  // Types
  if (!(await columnExists("doj_ticket_types", "open_ping_role_id"))) {
    await query("ALTER TABLE doj_ticket_types ADD COLUMN open_ping_role_id VARCHAR(32) NULL");
  }

  // Tickets
  if (!(await columnExists("doj_tickets", "control_message_id"))) {
    await query("ALTER TABLE doj_tickets ADD COLUMN control_message_id VARCHAR(32) NULL");
  }
  if (!(await columnExists("doj_tickets", "pending_close_message_id"))) {
    await query("ALTER TABLE doj_tickets ADD COLUMN pending_close_message_id VARCHAR(32) NULL");
  }
  if (!(await columnExists("doj_tickets", "pending_close_at"))) {
    await query("ALTER TABLE doj_tickets ADD COLUMN pending_close_at TIMESTAMP NULL");
  }

  ensured = true;
}

// -------------------- TYPES --------------------

async function createType(guildId, payload) {
  await ensureTables();
  const id = normalizeId(payload.id);
  if (!id) throw new Error("id de type invalide");

  await query(
    `INSERT INTO doj_ticket_types (
      guild_id, id,
      label, emoji, namemodalrename,
      category_opened_id, staff_role_ids_json,
      open_ping_role_id,
      custom_embed_enabled, custom_embed_title, custom_embed_description
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      label=VALUES(label),
      emoji=VALUES(emoji),
      namemodalrename=VALUES(namemodalrename),
      category_opened_id=VALUES(category_opened_id),
      staff_role_ids_json=VALUES(staff_role_ids_json),
      open_ping_role_id=VALUES(open_ping_role_id),
      custom_embed_enabled=VALUES(custom_embed_enabled),
      custom_embed_title=VALUES(custom_embed_title),
      custom_embed_description=VALUES(custom_embed_description)
    `,
    [
      guildId,
      id,
      payload.label,
      payload.emoji || null,
      payload.nameModalRename ? 1 : 0,
      payload.categoryOpenedId || null,
      JSON.stringify(payload.staffRoleIds || []),
      payload.openPingRoleId || null,
      payload.customEmbedEnabled ? 1 : 0,
      payload.customEmbedTitle || null,
      payload.customEmbedDescription || null,
    ]
  );

  return id;
}

async function getType(guildId, typeId) {
  await ensureTables();
  const id = normalizeId(typeId);
  const rows = await query(
    `SELECT * FROM doj_ticket_types WHERE guild_id = ? AND id = ? LIMIT 1`,
    [guildId, id]
  );
  const r = rows?.[0] || null;
  if (!r) return null;
  return {
    ...r,
    staff_role_ids: safeJsonParse(r.staff_role_ids_json, []),
    custom_embed_enabled: Boolean(r.custom_embed_enabled),
  };
}

async function listTypes(guildId) {
  await ensureTables();
  const rows = await query(
    `SELECT * FROM doj_ticket_types WHERE guild_id = ? ORDER BY id ASC`,
    [guildId]
  );
  return (rows || []).map((r) => ({
    ...r,
    staff_role_ids: safeJsonParse(r.staff_role_ids_json, []),
    custom_embed_enabled: Boolean(r.custom_embed_enabled),
  }));
}

async function deleteType(guildId, typeId) {
  await ensureTables();
  const id = normalizeId(typeId);
  await query(`DELETE FROM doj_ticket_types WHERE guild_id = ? AND id = ?`, [guildId, id]);
}

async function updateType(guildId, typeId, patch) {
  await ensureTables();
  const id = normalizeId(typeId);

  const allowed = new Set([
    "label",
    "emoji",
    "namemodalrename",
    "category_opened_id",
    "staff_role_ids_json",
    "open_ping_role_id",
    "custom_embed_enabled",
    "custom_embed_title",
    "custom_embed_description",
  ]);

  const keys = Object.keys(patch || {}).filter((k) => allowed.has(k));
  if (!keys.length) return;
  const fields = keys.map((k) => `${k} = ?`);
  const params = keys.map((k) => patch[k]);
  params.push(guildId, id);
  await query(
    `UPDATE doj_ticket_types SET ${fields.join(", ")} WHERE guild_id = ? AND id = ?`,
    params
  );
}

// -------------------- PANELS --------------------

async function createPanel(guildId, payload) {
  await ensureTables();
  const id = normalizeId(payload.id);
  if (!id) throw new Error("id de panel invalide");

  await query(
    `INSERT INTO doj_ticket_panels (
      guild_id, id,
      channel_id, message_id,
      title, description, color, style, required_role_id,
      logo_url, banner_url,
      type_ids_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      channel_id=VALUES(channel_id),
      message_id=VALUES(message_id),
      title=VALUES(title),
      description=VALUES(description),
      color=VALUES(color),
      style=VALUES(style),
      required_role_id=VALUES(required_role_id),
      logo_url=VALUES(logo_url),
      banner_url=VALUES(banner_url),
      type_ids_json=VALUES(type_ids_json)
    `,
    [
      guildId,
      id,
      payload.channelId,
      payload.messageId || null,
      payload.title,
      payload.description,
      payload.color ?? null,
      payload.style || "menu",
      payload.requiredRoleId || null,
      payload.logoUrl || null,
      payload.bannerUrl || null,
      JSON.stringify(payload.typeIds || []),
    ]
  );

  return id;
}

async function getPanel(guildId, panelId) {
  await ensureTables();
  const id = normalizeId(panelId);
  const rows = await query(
    `SELECT * FROM doj_ticket_panels WHERE guild_id = ? AND id = ? LIMIT 1`,
    [guildId, id]
  );
  const r = rows?.[0] || null;
  if (!r) return null;
  return { ...r, type_ids: safeJsonParse(r.type_ids_json, []) };
}

async function getPanelByMessage(guildId, messageId) {
  await ensureTables();
  const rows = await query(
    `SELECT * FROM doj_ticket_panels WHERE guild_id = ? AND message_id = ? LIMIT 1`,
    [guildId, String(messageId)]
  );
  const r = rows?.[0] || null;
  if (!r) return null;
  return { ...r, type_ids: safeJsonParse(r.type_ids_json, []) };
}

async function deletePanel(guildId, panelId) {
  await ensureTables();
  const id = normalizeId(panelId);
  await query(`DELETE FROM doj_ticket_panels WHERE guild_id = ? AND id = ?`, [guildId, id]);
}

async function updatePanel(guildId, panelId, patch) {
  await ensureTables();
  const id = normalizeId(panelId);
  const allowed = new Set([
    "channel_id",
    "message_id",
    "title",
    "description",
    "color",
    "style",
    "required_role_id",
    "logo_url",
    "banner_url",
    "type_ids_json",
  ]);
  const keys = Object.keys(patch || {}).filter((k) => allowed.has(k));
  if (!keys.length) return;
  const fields = keys.map((k) => `${k} = ?`);
  const params = keys.map((k) => patch[k]);
  params.push(guildId, id);
  await query(
    `UPDATE doj_ticket_panels SET ${fields.join(", ")} WHERE guild_id = ? AND id = ?`,
    params
  );
}

// -------------------- TICKETS --------------------

async function createTicket(guildId, payload) {
  await ensureTables();
  const res = await query(
    `INSERT INTO doj_tickets (
      guild_id, channel_id,
      panel_id, type_id,
      author_user_id,
      nom, prenom,
      status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'open')`,
    [
      guildId,
      payload.channelId,
      normalizeId(payload.panelId),
      normalizeId(payload.typeId),
      payload.authorUserId,
      payload.nom || null,
      payload.prenom || null,
    ]
  );
  return Number(res.insertId);
}

async function getTicketByChannel(guildId, channelId) {
  await ensureTables();
  const rows = await query(
    `SELECT * FROM doj_tickets WHERE guild_id = ? AND channel_id = ? LIMIT 1`,
    [guildId, String(channelId)]
  );
  return rows?.[0] || null;
}

async function getTicketById(guildId, ticketId) {
  await ensureTables();
  const rows = await query(
    `SELECT * FROM doj_tickets WHERE guild_id = ? AND ticket_id = ? LIMIT 1`,
    [guildId, String(ticketId)]
  );
  return rows?.[0] || null;
}

async function setTicketStatus(guildId, ticketId, status) {
  await ensureTables();
  const st = String(status);
  const patch = { status: st };
  if (st === "closed") patch.closed_at = new Date();
  if (st === "deleted") patch.deleted_at = new Date();
  if (st === "open") patch.closed_at = null;

  const fields = Object.keys(patch).map((k) => `${k} = ?`);
  const params = Object.values(patch);
  params.push(guildId, String(ticketId));
  await query(
    `UPDATE doj_tickets SET ${fields.join(", ")} WHERE guild_id = ? AND ticket_id = ?`,
    params
  );
}


async function setTicketControlMessageId(guildId, ticketId, messageId) {
  await ensureTables();
  await query(
    "UPDATE doj_tickets SET control_message_id = ? WHERE guild_id = ? AND ticket_id = ?",
    [messageId ? String(messageId) : null, String(guildId), String(ticketId)]
  );
}

async function setPendingCloseMessage(guildId, ticketId, messageId) {
  await ensureTables();
  await query(
    "UPDATE doj_tickets SET pending_close_message_id = ?, pending_close_at = ? WHERE guild_id = ? AND ticket_id = ?",
    [messageId ? String(messageId) : null, messageId ? new Date() : null, String(guildId), String(ticketId)]
  );
}

async function clearPendingCloseMessage(guildId, ticketId) {
  await ensureTables();
  await query(
    "UPDATE doj_tickets SET pending_close_message_id = NULL, pending_close_at = NULL WHERE guild_id = ? AND ticket_id = ?",
    [String(guildId), String(ticketId)]
  );
}

module.exports = {
  ensureTables,
  normalizeId,

  // Types
  createType,
  updateType,
  getType,
  listTypes,
  deleteType,

  // Panels
  createPanel,
  updatePanel,
  getPanel,
  getPanelByMessage,
  deletePanel,

  // Tickets
  createTicket,
  getTicketByChannel,
  getTicketById,
  setTicketStatus,
  setTicketControlMessageId,
  setPendingCloseMessage,
  clearPendingCloseMessage,
};
