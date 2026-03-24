const logger = require("../src/utils/logger");
const { sendBotLogToAllGuilds, DEFAULT_COLORS, lines } = require("../src/utils/discordLogs");

module.exports = {
  name: "clientReady",
  once: true,
  async execute(client) {
    logger.info(`Connecté en tant que ${client.user.tag}`);
    logger.info(`Serveurs: ${client.guilds.cache.size}`);

    await sendBotLogToAllGuilds(client, {
      color: DEFAULT_COLORS.success,
      title: '🟢 Bot démarré',
      description: lines([
        `**Bot** : ${client.user.tag}`,
        `**Serveurs** : **${client.guilds.cache.size}**`,
        `**Heure** : <t:${Math.floor(Date.now() / 1000)}:F>`,
      ]),
      footer: 'Ghost\'Packs • Bot logs',
    }).catch(() => {});
  }
};
