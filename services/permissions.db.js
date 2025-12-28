// services/permissions.db.js
const { query } = require("./db");

async function getGuildRoles(guildId) {
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

module.exports = { getGuildRoles, getPermissionRule };