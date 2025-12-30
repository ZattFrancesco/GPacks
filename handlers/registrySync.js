// handlers/registrySync.js
const path = require("path");
const fs = require("fs");
const logger = require("../src/utils/logger");
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

module.exports = async function registrySync() {
  try {
    const commandsRoot = path.join(process.cwd(), "commands");
    const files = getAllJsFiles(commandsRoot);

    for (const file of files) {
      const cmd = require(file);
      if (!cmd?.data?.name) continue;

      const itemKey = `slash:${cmd.data.name}`;
      const defaultName = `/${cmd.data.name}`;
      const defaultDescription = cmd.data.description || null;

      await upsertRegistryItem({
        item_key: itemKey,
        type: "slash",
        default_name: defaultName,
        default_description: defaultDescription,
      });
    }

    logger.info(`[registrySync] OK: ${files.length} commande(s) sync en DB`);
  } catch (err) {
    // Important : si MySQL est down, on ne casse pas le bot
    logger.warn("Registry DB ignoré (DB pas prête ?) :", err?.message || err);
  }
};