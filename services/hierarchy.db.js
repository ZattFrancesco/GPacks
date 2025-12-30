const { query } = require("./db");
const logger = require("../src/utils/logger");

const SQL = `
CREATE TABLE IF NOT EXISTS doj_hierarchy_settings (
  guild_id VARCHAR(32) NOT NULL,
  title VARCHAR(128) NULL,
  color VARCHAR(16) NULL,
  footer VARCHAR(128) NULL,
  channel_id VARCHAR(32) NULL,
  message_id VARCHAR(32) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (guild_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS doj_hierarchy_tiers (
  id INT NOT NULL AUTO_INCREMENT,
  guild_id VARCHAR(32) NOT NULL,
  tier_index INT NOT NULL,
  name VARCHAR(64) NOT NULL,
  description VARCHAR(256) NULL,
  PRIMARY KEY (id),
  INDEX (guild_id),
  UNIQUE KEY uniq_guild_tier (guild_id, tier_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS doj_hierarchy_tier_roles (
  tier_id INT NOT NULL,
  role_id VARCHAR(32) NOT NULL,
  role_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (tier_id, role_id),
  INDEX (tier_id),
  INDEX (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

let _ensured = false;
async function ensure() {
  if (_ensured) return;
  try {
    // mysql2 ne supporte pas toujours multi-statement selon config,
    // donc on split "propre"
    const parts = SQL.split(";").map(s => s.trim()).filter(Boolean);
    for (const p of parts) await query(p);
    _ensured = true;
  } catch (e) {
    logger.warn(`Hierarchy ensure: ${e?.message || e}`);
  }
}

async function getSettings(guildId) {
  await ensure();
  const rows = await query("SELECT * FROM doj_hierarchy_settings WHERE guild_id = ? LIMIT 1", [String(guildId)]);
  if (!rows?.length) return null;
  return rows[0];
}

async function upsertSettings(guildId, patch = {}) {
  await ensure();
  const current = (await getSettings(guildId)) || {};
  const merged = { ...current, ...patch };

  await query(
    `INSERT INTO doj_hierarchy_settings (guild_id, title, color, footer, channel_id, message_id)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       title=VALUES(title),
       color=VALUES(color),
       footer=VALUES(footer),
       channel_id=VALUES(channel_id),
       message_id=VALUES(message_id)`,
    [
      String(guildId),
      merged.title || null,
      merged.color || null,
      merged.footer || null,
      merged.channel_id || null,
      merged.message_id || null,
    ]
  );
  return await getSettings(guildId);
}

async function listTiers(guildId) {
  await ensure();
  return await query(
    `SELECT id, tier_index, name, description
     FROM doj_hierarchy_tiers
     WHERE guild_id = ?
     ORDER BY tier_index ASC`,
    [String(guildId)]
  );
}

async function createTier(guildId, name, description = null) {
  await ensure();
  const tiers = await listTiers(guildId);
  const nextIndex = tiers.length ? Math.max(...tiers.map(t => t.tier_index)) + 1 : 1;

  await query(
    `INSERT INTO doj_hierarchy_tiers (guild_id, tier_index, name, description)
     VALUES (?, ?, ?, ?)`,
    [String(guildId), nextIndex, name, description]
  );

  const updated = await listTiers(guildId);
  return updated;
}

async function deleteTier(guildId, tierId) {
  await ensure();
  // sécurité: tier appartient au serveur
  const tiers = await listTiers(guildId);
  const tier = tiers.find(t => String(t.id) === String(tierId));
  if (!tier) return tiers;

  await query("DELETE FROM doj_hierarchy_tier_roles WHERE tier_id = ?", [tier.id]);
  await query("DELETE FROM doj_hierarchy_tiers WHERE id = ?", [tier.id]);

  // reindex pour garder 1..N
  const after = await listTiers(guildId);
  for (let i = 0; i < after.length; i++) {
    await query("UPDATE doj_hierarchy_tiers SET tier_index = ? WHERE id = ?", [i + 1, after[i].id]);
  }
  return await listTiers(guildId);
}

async function moveTier(guildId, tierId, direction /* "up"|"down" */) {
  await ensure();
  const tiers = await listTiers(guildId);
  const idx = tiers.findIndex(t => String(t.id) === String(tierId));
  if (idx === -1) return tiers;

  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= tiers.length) return tiers;

  const a = tiers[idx];
  const b = tiers[swapWith];

  await query("UPDATE doj_hierarchy_tiers SET tier_index = ? WHERE id = ?", [b.tier_index, a.id]);
  await query("UPDATE doj_hierarchy_tiers SET tier_index = ? WHERE id = ?", [a.tier_index, b.id]);

  return await listTiers(guildId);
}

async function setTierMeta(guildId, tierId, name, description = null) {
  await ensure();
  await query(
    `UPDATE doj_hierarchy_tiers
     SET name = ?, description = ?
     WHERE id = ? AND guild_id = ?`,
    [name, description, Number(tierId), String(guildId)]
  );
  return await listTiers(guildId);
}

async function setTierRoles(guildId, tierId, roleIds = []) {
  await ensure();

  // check tier belongs to guild
  const tiers = await listTiers(guildId);
  const tier = tiers.find(t => String(t.id) === String(tierId));
  if (!tier) return { ok: false, error: "tier_not_found" };

  await query("DELETE FROM doj_hierarchy_tier_roles WHERE tier_id = ?", [tier.id]);

  // insertion avec ordre
  let order = 0;
  for (const rid of roleIds) {
    await query(
      "INSERT INTO doj_hierarchy_tier_roles (tier_id, role_id, role_order) VALUES (?, ?, ?)",
      [tier.id, String(rid), order++]
    );
  }
  return { ok: true };
}

async function getTierRoles(guildId) {
  await ensure();
  const tiers = await listTiers(guildId);
  if (!tiers.length) return [];

  const ids = tiers.map(t => t.id);
  const rows = await query(
    `SELECT tier_id, role_id, role_order
     FROM doj_hierarchy_tier_roles
     WHERE tier_id IN (${ids.map(() => "?").join(",")})
     ORDER BY tier_id ASC, role_order ASC`,
    ids
  );

  const map = new Map();
  for (const t of tiers) map.set(String(t.id), []);
  for (const r of rows) map.get(String(r.tier_id))?.push(String(r.role_id));

  return tiers.map(t => ({
    ...t,
    role_ids: map.get(String(t.id)) || [],
  }));
}

module.exports = {
  ensure,
  getSettings,
  upsertSettings,
  listTiers,
  createTier,
  deleteTier,
  moveTier,
  setTierMeta,
  setTierRoles,
  getTierRoles,
};