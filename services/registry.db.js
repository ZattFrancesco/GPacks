// services/registry.db.js
const { query } = require("./db");

let registryTablesReady = false;

async function ensureRegistryTables() {
  if (registryTablesReady) return;

  await query(`
    CREATE TABLE IF NOT EXISTS registry_items (
      item_key VARCHAR(191) NOT NULL,
      type VARCHAR(50) NOT NULL,
      category_name VARCHAR(191) NOT NULL DEFAULT 'General',
      default_name VARCHAR(191) NOT NULL,
      default_description TEXT NULL,
      PRIMARY KEY (item_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS registry_item_overrides (
      item_key VARCHAR(191) NOT NULL,
      category_key VARCHAR(191) NULL,
      label_override VARCHAR(191) NULL,
      description_override TEXT NULL,
      is_hidden TINYINT(1) NOT NULL DEFAULT 0,
      sort_index INT NOT NULL DEFAULT 0,
      PRIMARY KEY (item_key),
      KEY idx_registry_item_overrides_category_key (category_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS help_categories (
      category_key VARCHAR(191) NOT NULL,
      display_name VARCHAR(191) NOT NULL,
      emoji VARCHAR(50) NULL,
      color VARCHAR(32) NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_hidden TINYINT(1) NOT NULL DEFAULT 0,
      PRIMARY KEY (category_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  registryTablesReady = true;
}

/**
 * Upsert (insert/update) d'un item dans registry_items
 * + garantit qu'une ligne existe aussi dans registry_item_overrides
 * @param {{ item_key: string, type: string, default_name: string, default_description?: string|null, category_name?: string|null }} item
 */
async function upsertRegistryItem(item) {
  await ensureRegistryTables();

  // NOTE: la table registry_items contient un champ NOT NULL `category_name`.
  // Si tu ne le fournis pas, MySQL refusera l'INSERT (ER_NO_DEFAULT_FOR_FIELD).
  // On force donc une valeur par défaut.
  const {
    item_key,
    type,
    default_name,
    default_description = null,
    category_name = "General",
  } = item || {};
  if (!item_key || !type || !default_name) return;

  // 1) Upsert item
  await query(
    `INSERT INTO registry_items (item_key, type, category_name, default_name, default_description)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       type = VALUES(type),
       category_name = VALUES(category_name),
       default_name = VALUES(default_name),
       default_description = VALUES(default_description)`,
    [item_key, type, category_name || "General", default_name, default_description]
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
  await ensureRegistryTables();

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
  ensureRegistryTables,
  upsertRegistryItem,
  getGlobalCategoryForItem,
};
