const logger = require("../src/utils/logger");

module.exports = {
  // discord.js v15 renomme l'event "ready" -> "clientReady"
  // Utiliser "clientReady" évite le warning de dépréciation.
  name: "clientReady",
  once: true,
  execute(client) {
    logger.info(`Connecté en tant que ${client.user.tag}`);
    logger.info(`Serveurs: ${client.guilds.cache.size}`);
  }
};
