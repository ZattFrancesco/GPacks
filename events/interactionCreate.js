// index.js (racine)
const { Client, Collection, GatewayIntentBits, Partials } = require("discord.js");
const { loadEnv } = require("./src/utils/env");
const logger = require("./src/utils/logger");

const { loadEvents } = require("./src/handlers/eventHandler");
const { loadSlashCommands, loadPrefixCommands } = require("./src/handlers/commandHandler");

// ✅ Registry sync (DB) - ajouté
const { syncRegistryAll } = require("./handlers/registrySync");

loadEnv();

// --- Sécurité env ---
if (!process.env.DISCORD_TOKEN) {
  logger.error("DISCORD_TOKEN manquant dans .env");
  process.exit(1);
}

// --- Intents : version "full" ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,

    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,

    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,

    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,

    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildModeration,

    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildIntegrations,

    GatewayIntentBits.GuildScheduledEvents,
    GatewayIntentBits.GuildMessageTyping,

    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageTyping,
    GatewayIntentBits.DirectMessageReactions,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.Reaction,
    Partials.User,
    Partials.ThreadMember,
  ],
});

// Collections
client.commands = new Collection();
client.prefixGlobal = new Collection();
client.prefixDev = new Collection();

// Interactions (buttons/modals/select/autocomplete)
const loadInteractions = require("./handlers/loadInteractions");
loadInteractions(client);

// Crash safety
process.on("unhandledRejection", (err) => logger.error(`UNHANDLED REJECTION: ${err?.stack || err}`));
process.on("uncaughtException", (err) => logger.error(`UNCAUGHT EXCEPTION: ${err?.stack || err}`));

(async () => {
  try {
    await loadSlashCommands(client);
    await loadPrefixCommands(client);
    await loadEvents(client);

    // ✅ Sync registry en DB (slash/buttons/modals/select/autocomplete)
    // Si la DB n'est pas configurée, ça va throw -> on log et on continue
    try {
      await syncRegistryAll();
    } catch (e) {
      logger.warn(`Registry sync ignoré (DB pas prête ?) : ${e?.message || e}`);
    }

    await client.login(process.env.DISCORD_TOKEN);
  } catch (err) {
    logger.error(`Erreur au démarrage: ${err?.stack || err}`);
    process.exit(1);
  }
})();