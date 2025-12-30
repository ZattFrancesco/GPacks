// handlers/registrySync.js
const path = require("path");
const fs = require("fs");
const logger = require("../utils/logger");
const { upsertRegistryItem } = require("../../services/registry.db");

function getAllJsFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...getAllJsFiles(full));
    else if (e.isFile() && e.name.endsWith(".js")) out.push(full);
  }
  return out;
}

async function syncSlashCommands() {
  const commandsRoot = path.join(process.cwd(), "commands");
  const files = getAllJsFiles(commandsRoot);

  for (const file of files) {
    const cmd = require(file);
    if (!cmd?.data?.name) continue;

    const itemKey = `slash:${cmd.data.name}`;
    await upsertRegistryItem({
      itemKey,
      type: "slash",
      defaultName: `/${cmd.data.name}`,
      defaultDescription: cmd.data.description || null,
    });
  }
}

async function syncFolder(folderName, type, idField = "id") {
  const root = path.join(process.cwd(), folderName);
  const files = getAllJsFiles(root);

  for (const file of files) {
    const item = require(file);
    const id = item?.[idField] || item?.name;
    if (!id) continue;

    const itemKey = `${type}:${id}`;
    await upsertRegistryItem({
      itemKey,
      type,
      defaultName: id,
      defaultDescription: item.description || null,
    });
  }
}

async function syncRegistryAll() {
  try {
    await syncSlashCommands();
    await syncFolder("buttons", "button", "id");
    await syncFolder("modals", "modal", "id");
    await syncFolder("selectMenus", "select", "id");
    await syncFolder("autocomplete", "autocomplete", "name");

    logger.info("Registry sync: OK");
  } catch (err) {
    logger.error(`Registry sync: ERREUR: ${err?.stack || err}`);
    throw err;
  }
}

module.exports = { syncRegistryAll };