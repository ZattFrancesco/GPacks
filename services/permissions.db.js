// services/permissions.db.js
const { query } = require("./db");
const logger = require("../src/utils/logger");

let ensured = false;

async function ensureTables() {
  if (ensured) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS guild_roles (
        guild_id VARCHAR(32) NOT NULL,
        staff_role_id VARCHAR(32) NULL,
        admin_role_id VARCHAR(32) NULL,
        mod_role_id VARCHAR(32) NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (guild_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS permissions_rules (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        guild_id VARCHAR(32) NOT NULL,
        scope VARCHAR(32) NOT NULL DEFAULT 'item',
        item_key VARCHAR(191) NULL,
        category_key VARCHAR(191) NULL,
        access VARCHAR(32) NOT NULL DEFAULT 'public',
        require_discord_perms VARCHAR(255) NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_guild_scope_item (guild_id, scope, item_key),
        INDEX idx_guild_scope_category (guild_id, scope, category_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    ensured = true;
  } catch (err) {
    logger.warn(`permissions.db ensureTables: ${err?.message || err}`);
  }
}

async function getGuildRoles(guildId) {
  await ensureTables();
  const rows = await query(
    "SELECT staff_role_id, admin_role_id, mod_role_id FROM guild_roles WHERE guild_id = ?",
    [guildId]
  );
  return rows[0] || { staff_role_id: null, admin_role_id: null, mod_role_id: null };
}

/**
 * 1) règle scope=item pour item_key
 * 2) sinon règle scope=category pour category_key
 * 3) sinon null (public)
 */
async function getPermissionRule(guildId, itemKey, categoryKey) {
  await ensureTables();

  const item = await query(
    `SELECT access, require_discord_perms
     FROM permissions_rules
     WHERE guild_id = ? AND scope = 'item' AND item_key = ?
     ORDER BY updated_at DESC
     LIMIT 1`,
    [guildId, itemKey]
  );
  if (item[0]) return item[0];

  if (categoryKey) {
    const cat = await query(
      `SELECT access, require_discord_perms
       FROM permissions_rules
       WHERE guild_id = ? AND scope = 'category' AND category_key = ?
       ORDER BY updated_at DESC
       LIMIT 1`,
      [guildId, categoryKey]
    );
    if (cat[0]) return cat[0];
  }

  return null;
}

module.exports = { ensureTables, getGuildRoles, getPermissionRule };
