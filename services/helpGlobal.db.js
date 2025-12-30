// services/helpGlobal.db.js
const { query } = require("./db");

async function getVisibleCategories() {
  return await query(
    `SELECT category_key, display_name, emoji, color, sort_order
     FROM help_categories
     WHERE is_hidden = 0
     ORDER BY sort_order ASC, display_name ASC`
  );
}

async function getItemsForCategory(categoryKey) {
  return await query(
    `SELECT
        i.item_key,
        i.type,
        i.default_name,
        i.default_description,
        o.label_override,
        o.description_override,
        o.sort_index
     FROM registry_items i
     JOIN registry_item_overrides o ON o.item_key = i.item_key
     WHERE o.is_hidden = 0 AND o.category_key = ?
     ORDER BY o.sort_index ASC, COALESCE(o.label_override, i.default_name) ASC`,
    [categoryKey]
  );
}

async function getUncategorizedItems() {
  return await query(
    `SELECT
        i.item_key,
        i.type,
        i.default_name,
        i.default_description,
        o.label_override,
        o.description_override,
        o.sort_index
     FROM registry_items i
     JOIN registry_item_overrides o ON o.item_key = i.item_key
     WHERE o.is_hidden = 0 AND (o.category_key IS NULL OR o.category_key = '')
     ORDER BY o.sort_index ASC, COALESCE(o.label_override, i.default_name) ASC`
  );
}

module.exports = { getVisibleCategories, getItemsForCategory, getUncategorizedItems };