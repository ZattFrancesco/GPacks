const { query } = require("./db");

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
  getGlobalCategoryForItem
};