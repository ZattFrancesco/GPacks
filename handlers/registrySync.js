// src/handlers/registrySync.js
const path = require("path");
const fs = require("fs");
const { upsertRegistryItem } = require("../services/registry.db");

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

async function syncSlashAndContext() {
  const commandsRoot = path.join(process.cwd(), "commands");
  const files = getAllJsFiles(commandsRoot);

  for (const file of files) {
    const cmd = require(file);
    if (!cmd?.data?.name) continue;

    // slash + context menus passent tous par commands/
    // type réel : on détecte si ContextMenuCommandBuilder (pas simple sans instance),
    // donc on met "slash" par défaut. Tu pourras affiner plus tard.
    const itemKey = `slash:${cmd.data.name}`;
    const defaultName = `/${cmd.data.name}`;
    const defaultDescription = cmd.data.description || null;

    await upsertRegistryItem({
      itemKey,
      type: "slash",
      defaultName,
      defaultDescription,
    });
  }
}

async function syncSimpleFolder(folderName, type) {
  const root = path.join(process.cwd(), folderName);
  const files = getAllJsFiles(root);

  for (const file of files) {
    const item = require(file);
    const id = item?.id || item?.name;
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
  await syncSlashAndContext();

  await syncSimpleFolder("buttons", "button");
  await syncSimpleFolder("modals", "modal");
  await syncSimpleFolder("selectMenus", "select");
  await syncSimpleFolder("autocomplete", "autocomplete");

  // optionnel:
  // await syncSimpleFolder("prefixCommands", "prefix"); // si tu veux aussi les lister
}

module.exports = { syncRegistryAll };