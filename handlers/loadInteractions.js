const fs = require("fs");
const path = require("path");

function loadFolder(client, folder, collectionName, key = "id") {
  const dir = path.join(process.cwd(), folder);
  if (!fs.existsSync(dir)) return;

  client[collectionName] = new Map();

  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".js")) continue;
    const item = require(path.join(dir, file));
    const mapKey = item[key] || item.name;
    if (!mapKey) continue;

    client[collectionName].set(mapKey, item);
  }
}

module.exports = (client) => {
  loadFolder(client, "buttons", "buttons");
  loadFolder(client, "modals", "modals");
  loadFolder(client, "selectMenus", "selectMenus");
  loadFolder(client, "autocomplete", "autocomplete", "name");
};