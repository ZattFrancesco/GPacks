// src/handlers/commandHandler.js
const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");

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

async function loadSlashCommands(client) {
  const commandsDir = path.join(process.cwd(), "commands");
  const files = getAllJsFiles(commandsDir);

  for (const file of files) {
    const cmd = require(file);
    if (!cmd?.data?.name || typeof cmd.execute !== "function") continue;

    client.commands.set(cmd.data.name, cmd);
    logger.info(`Commande slash chargée: /${cmd.data.name}`);
  }
}

async function loadPrefixCommands(client) {
  const base = path.join(process.cwd(), "prefixCommands");
  const globalDir = path.join(base, "global");
  const devDir = path.join(base, "dev");

  // Global
  for (const file of getAllJsFiles(globalDir)) {
    const cmd = require(file);
    if (!cmd?.name || typeof cmd.execute !== "function") continue;
    client.prefixGlobal.set(cmd.name, cmd);
    logger.info(`Prefix global chargé: ${cmd.name}`);
  }

  // Dev
  for (const file of getAllJsFiles(devDir)) {
    const cmd = require(file);
    if (!cmd?.name || typeof cmd.execute !== "function") continue;
    client.prefixDev.set(cmd.name, cmd);
    logger.info(`Prefix dev chargé: ${cmd.name}`);
  }
}

module.exports = { loadSlashCommands, loadPrefixCommands };