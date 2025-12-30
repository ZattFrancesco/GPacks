/**
 * Prefix commands (optionnel)
 * - GLOBAL: PREFIX_GLOBAL (ex: !)
 * - DEV: PREFIX_DEV (ex: !!)
 */
const logger = require("../src/utils/logger");
const { isOwner } = require("../src/utils/permissions");
const { isBlacklisted } = require("../services/blacklist.db");

module.exports = {
  name: "messageCreate",
  once: false,
  async execute(client, message) {
    if (!message || message.author?.bot) return;

    // Blacklist globale (owner jamais bloqué)
    if (!isOwner(message.author.id)) {
      const bl = await isBlacklisted(message.author.id);
      if (bl.blacklisted) {
        const msg = bl.reason
          ? `❌ Tu es blacklisté du bot. Raison: ${bl.reason}`
          : "❌ Tu es blacklisté du bot.";
        return message.reply(msg).catch(() => {});
      }
    }

    const prefixGlobal = process.env.PREFIX_GLOBAL || "!";
    const prefixDev = process.env.PREFIX_DEV || "!!";

    const content = String(message.content || "");
    const isDevPrefix = content.startsWith(prefixDev);
    const isGlobalPrefix = content.startsWith(prefixGlobal);

    if (!isDevPrefix && !isGlobalPrefix) return;

    const usedPrefix = isDevPrefix ? prefixDev : prefixGlobal;
    const raw = content.slice(usedPrefix.length).trim();
    if (!raw) return;

    const parts = raw.split(/\s+/);
    const name = parts.shift().toLowerCase();
    const args = parts;

    // DEV scope = owner only
    if (isDevPrefix && !isOwner(message.author.id)) {
      return message.reply("❌ Commande dev réservée à l’owner.").catch(() => {});
    }

    const map = isDevPrefix ? client.prefixDev : client.prefixGlobal;
    const cmd = map.get(name);
    if (!cmd) return;

    try {
      await cmd.execute({ client, message, args });
    } catch (err) {
      logger.error(`Erreur prefix ${name}: ${err?.stack || err}`);
      await message.reply("❌ Erreur pendant la commande.").catch(() => {});
    }
  },
};