const fs = require("fs");
const path = require("path");

function normalizeItems(mod) {
  if (!mod) return [];
  if (Array.isArray(mod)) return mod;
  return [mod];
}

function loadFolder(client, folder, exactMapName, prefixListName, key = "id") {
  const dir = path.join(process.cwd(), folder);
  if (!fs.existsSync(dir)) return;

  client[exactMapName] = new Map();
  client[prefixListName] = [];

  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".js")) continue;

    const exported = require(path.join(dir, file));
    const items = normalizeItems(exported);

    for (const item of items) {
      if (!item) continue;

      if (item.idPrefix) {
        client[prefixListName].push(item);
        continue;
      }

      const mapKey = item[key] || item.name;
      if (!mapKey) continue;

      client[exactMapName].set(mapKey, item);
    }
  }
}

module.exports = (client) => {
  loadFolder(client, "buttons", "buttons", "buttonsPrefix");
  loadFolder(client, "modals", "modals", "modalsPrefix");
  loadFolder(client, "selectmenus", "selectMenus", "selectMenusPrefix"); // ✅ ici le fix
  loadFolder(client, "autocomplete", "autocomplete", "autocompletePrefix", "name");
};