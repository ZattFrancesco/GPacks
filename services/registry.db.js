// services/registry.db.js
const { query } = require("./db");

/**
 * Upsert registry_items sans casser les overrides.
 * - met à jour default_name/default_description
 * - s'assure qu'un override existe pour l'item (ligne vide)
 */
async function upsertRegistryItem({ itemKey, type, defaultName, defaultDescription }) {
  await query(
    `INSERT INTO registry_items (item_key, type, default_name, default_description)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       type = VALUES(type),
       default_name = VALUES(default_name),
       default_description = VALUES(default_description),
       updated_at = CURRENT_TIMESTAMP`,
    [itemKey, type, defaultName, defaultDescription || null]
  );

  await query(
    `INSERT INTO registry_item_overrides (item_key)
     VALUES (?)
     ON DUPLICATE KEY UPDATE item_key=item_key`,
    [itemKey]
  );
}

async function getGlobalCategoryForItem(itemKey) {
  const rows = await query(
    `SELECT o.category_key
     FROM registry_item_overrides o
     WHERE o.item_key = ?
     LIMIT 1`,
    [itemKey]
  );
  return rows[0]?.category_key || null;
}

module.exports = { upsertRegistryItem, getGlobalCategoryForItem };