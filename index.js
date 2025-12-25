// index.js (racine)
const { Client, Collection, GatewayIntentBits, Partials } = require("discord.js");
const { loadEnv } = require("./src/utils/env");
const logger = require("./src/utils/logger");

const { loadEvents } = require("./src/handlers/eventHandler");
const { loadSlashCommands, loadPrefixCommands } = require("./src/handlers/commandHandler");

loadEnv();

// --- Sécurité env ---
if (!process.env.DISCORD_TOKEN) {
  logger.error("DISCORD_TOKEN manquant dans .env");
  process.exit(1);
}

// --- Intents : version "full" ---
const client = new Client({
  intents: [
    // Base
    GatewayIntentBits.Guilds,

    // Messages
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,

    // Membres / présence (privilégiés)
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,

    // Réactions
    GatewayIntentBits.GuildMessageReactions,

    // Vocal
    GatewayIntentBits.GuildVoiceStates,

    // Invites / modération
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildModeration,

    // Emojis / stickers / webhooks / intégrations
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildIntegrations,

    // Scheduled events + typing (optionnel)
    GatewayIntentBits.GuildScheduledEvents,
    GatewayIntentBits.GuildMessageTyping,

    // MP
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageTyping,
    GatewayIntentBits.DirectMessageReactions,
  ],
  partials: [
    Partials.Channel,   // requis pour DM
    Partials.Message,
    Partials.Reaction,
    Partials.User,
    Partials.ThreadMember,
  ],
});

// Collections (slash + prefix + interactions)
client.commands = new Collection();
client.prefixGlobal = new Collection();
client.prefixDev = new Collection();

// Interactions (buttons/modals/selects/autocomplete) - chargé ici
const loadInteractions = require("./handlers/loadInteractions");
loadInteractions(client);

// Crash safety
process.on("unhandledRejection", (err) =>
  logger.error(`UNHANDLED REJECTION: ${err?.stack || err}`)
);
process.on("uncaughtException", (err) =>
  logger.error(`UNCAUGHT EXCEPTION: ${err?.stack || err}`)
);

(async () => {
  try {
    // Loaders
    await loadSlashCommands(client);
    await loadPrefixCommands(client);
    await loadEvents(client);

    // Login
    await client.login(process.env.DISCORD_TOKEN);
  } catch (err) {
    logger.error(`Erreur au démarrage: ${err?.stack || err}`);
    process.exit(1);
  }
})();