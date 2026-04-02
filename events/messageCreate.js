/**
 * Prefix commands (optionnel)
 * - GLOBAL: PREFIX_GLOBAL (ex: !)
 * - DEV: PREFIX_DEV (ex: !!)
 */
const logger = require("../src/utils/logger");
const { isOwner } = require("../src/utils/permissions");
const { isBlacklisted } = require("../services/blacklist.db");
const { isSilentMuted } = require("../services/silentMute.db");
const { sendLog, DEFAULT_COLORS, lines, userLabel, channelLabel, trim } = require("../src/utils/discordLogs");
const { forwardDmToThread } = require("../src/utils/modmail");

module.exports = {
  name: "messageCreate",
  once: false,
  async execute(client, message) {
    if (!message || message.author?.bot) return;

    if (!message.guildId) {
      const forwarded = await forwardDmToThread(client, message).catch((err) => {
        logger.error(`Modmail DM forward error: ${err?.stack || err}`);
        return false;
      });
      if (!forwarded) {
        await message.reply("📭 Ce bot ne prend pas en charge les messages privés pour le moment.").catch(() => {});
      }
      return;
    }

    if (message.guildId && (await isSilentMuted(message.guildId, message.author.id))) {
      await sendLog(client, message.guildId, {
        color: DEFAULT_COLORS.danger,
        type: 'silent_mute',
        title: "🔕 Silent-mute message bloqué",
        description: lines([
          `**Auteur** : ${userLabel(message.author)}`,
          `**Salon** : ${channelLabel(message.channel)}`,
        ]),
        fields: [{ name: "Contenu", value: trim(message.content || "*Aucun contenu texte*", 1024) }],
      }).catch(() => {});
      await message.delete().catch(() => {});
      return;
    }

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
      await sendLog(client, message.guildId, {
        color: DEFAULT_COLORS.info,
        title: "⌨️ Commande préfixe exécutée",
        description: lines([
          `**Auteur** : ${userLabel(message.author)}`,
          `**Commande** : \`${usedPrefix}${name}\``,
          `**Salon** : ${channelLabel(message.channel)}`,
        ]),
      }).catch(() => {});
      await cmd.execute({ client, message, args });
    } catch (err) {
      await sendLog(client, message.guildId, {
        color: DEFAULT_COLORS.danger,
        title: "❌ Erreur commande préfixe",
        description: lines([
          `**Auteur** : ${userLabel(message.author)}`,
          `**Commande** : \`${usedPrefix}${name}\``,
          `**Erreur** : \`${(err?.message || String(err)).slice(0, 900)}\``,
        ]),
      }).catch(() => {});
      logger.error(`Erreur prefix ${name}: ${err?.stack || err}`);
      await message.reply("❌ Erreur pendant la commande.").catch(() => {});
    }
  },
};