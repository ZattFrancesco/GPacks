// events/ready.js
const logger = require('../src/utils/logger');
const { startTwitchPoller } = require('../services/twitchPoller');

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    logger.info(`Connecté en tant que ${client.user.tag}`);
    logger.info(`Serveurs: ${client.guilds.cache.size}`);

    // ── Twitch Poller ──────────────────────────────────────────
    // Vérifie les lives toutes les 60s (modifiable en ms ci-dessous)
    if (process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET) {
      startTwitchPoller(client, 60_000);
      logger.info('twitchPoller: activé ✅');
    } else {
      logger.warn('twitchPoller: désactivé (TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET manquants)');
    }
  },
};
