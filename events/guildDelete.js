// events/guildDelete.js
const logger = require("../src/utils/logger");

module.exports = {
  name: "guildDelete",
  once: false,
  async execute(client, guild) {
    if (!guild?.id) return;

    logger.warn(
      `Bot retiré du serveur : ${guild.name || "inconnu"} (${guild.id}) — ${guild.memberCount || "?"} membres`
    );

    // NOTE: Les données DB (logs_config, autoroles, tickets, silent_mutes, channel_locks)
    // restent en base pour l'instant. Si tu veux purger automatiquement, décommente ci-dessous.
    //
    // const { query } = require("../services/db");
    // const tables = [
    //   "logs_config",
    //   "guild_autoroles",
    //   "doj_ticket_types",
    //   "doj_ticket_panels",
    //   "doj_tickets",
    //   "doj_channel_locks",
    //   "bot_silent_mutes",
    //   "guild_defcon_channels",
    //   "guild_roles",
    //   "permissions_rules",
    // ];
    // for (const table of tables) {
    //   await query(`DELETE FROM ${table} WHERE guild_id = ?`, [guild.id]).catch(() => {});
    // }
    // logger.info(`Données DB purgées pour le serveur ${guild.id}`);
  },
};
