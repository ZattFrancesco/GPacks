// src/services/registry.db.js
const { query } = require("./db");

/**
 * Upsert registry_items sans casser tes overrides.
 * - met à jour default_name/default_description
 * - s'assure qu'un override existe (vide) pour l'item (optionnel mais pratique)
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

  // Crée un override "vide" si pas existant (comme un placeholder)
  await query(
    `INSERT INTO registry_item_overrides (item_key)
     VALUES (?)
     ON DUPLICATE KEY UPDATE item_key = item_key`,
    [itemKey]
  );
}

/**
 * Récupère la catégorie globale (override) d'un item.
 * Si pas défini => null
 */
async function getOverrideForItem(itemKey) {
  const rows = await query(
    `SELECT o.category_key, o.label_override, o.description_override, o.sort_index, o.is_hidden
     FROM registry_item_overrides o
     WHERE o.item_key = ?`,
    [itemKey]
  );
  return rows[0] || null;
}

module.exports = { upsertRegistryItem, getOverrideForItem };