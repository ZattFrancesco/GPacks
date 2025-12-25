require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { REST, Routes } = require("discord.js");

function getAllJsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...getAllJsFiles(full));
    else if (e.isFile() && e.name.endsWith(".js")) files.push(full);
  }
  return files;
}

(async () => {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;

  if (!token || !clientId) {
    console.error("❌ DISCORD_TOKEN ou CLIENT_ID manquant dans .env");
    process.exit(1);
  }

  const commandsRoot = path.join(process.cwd(), "commands");
  if (!fs.existsSync(commandsRoot)) {
    console.error("❌ Dossier /commands introuvable (rien à déployer).");
    process.exit(1);
  }

  const files = getAllJsFiles(commandsRoot);
  const body = [];

  for (const file of files) {
    const cmd = require(file);
    if (cmd?.data?.toJSON) body.push(cmd.data.toJSON());
  }

  const rest = new REST({ version: "10" }).setToken(token);

  try {
    if (guildId) {
      console.log("🚀 Déploiement GUILD (serveur test)...");
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
      console.log("✅ Commandes déployées sur le serveur test !");
    } else {
      console.log("🚀 Déploiement GLOBAL...");
      await rest.put(Routes.applicationCommands(clientId), { body });
      console.log("✅ Commandes déployées globalement !");
    }
  } catch (err) {
    console.error("❌ Erreur deploy:", err);
    process.exit(1);
  }
})();
