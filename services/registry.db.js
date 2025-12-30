// services/registry.db.js
const { query } = require("./db");

/**
 * Upsert (insert/update) d'un item dans registry_items
 * + garantit qu'une ligne existe aussi dans registry_item_overrides
 * @param {{ item_key: string, type: string, default_name: string, default_description?: string|null }} item
 */
async function upsertRegistryItem(item) {
  const { item_key, type, default_name, default_description = null } = item || {};
  if (!item_key || !type || !default_name) return;

  // 1) Upsert item
  await query(
    `INSERT INTO registry_items (item_key, type, default_name, default_description)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       type = VALUES(type),
       default_name = VALUES(default_name),
       default_description = VALUES(default_description)`,
    [item_key, type, default_name, default_description]
  );

  // 2) Garantir override existant (si ta table a une PK item_key, ça marche nickel)
  await query(
    `INSERT INTO registry_item_overrides (item_key, category_key, label_override, description_override, is_hidden, sort_index)
     VALUES (?, NULL, NULL, NULL, 0, 0)
     ON DUPLICATE KEY UPDATE item_key = item_key`,
    [item_key]
  );
}

/**
 * Récupère la catégorie globale d’un item
 * @param {string} itemKey
 * @returns {Promise<string|null>}
 */
async function getGlobalCategoryForItem(itemKey) {
  if (!itemKey) return null;

  const rows = await query(
    `SELECT category_key
     FROM registry_item_overrides
     WHERE item_key = ?
     LIMIT 1`,
    [itemKey]
  );

  if (!rows || rows.length === 0) return null;
  return rows[0].category_key;
}

module.exports = {
  upsertRegistryItem,
  getGlobalCategoryForItem,
};