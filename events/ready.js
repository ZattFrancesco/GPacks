const logger = require("../src/utils/logger");

module.exports = {
  name: "clientReady",
  once: true,
  async execute(client) {
    logger.info(`Connecté en tant que ${client.user.tag}`);
    logger.info(`Serveurs: ${client.guilds.cache.size}`);
  }
};
