const logger = require("../src/utils/logger");
const { isOwner } = require("../src/utils/permissions");
const { isBlacklisted } = require("../services/blacklist.db");
const { isSilentMuted } = require("../services/silentMute.db");
const { sendLog, DEFAULT_COLORS, lines, userLabel, channelLabel, trim } = require("../src/utils/discordLogs");
const {
  forwardDmToThread,
  isModmailThread,
  extractUserIdFromThreadName,
  sendOwnerMessageToUser,
  buildReplyQuote,
} = require("../src/utils/modmail");
const { saveMapping, getByThreadMsg } = require("../services/modmailMap.db");

module.exports = {
  name: "messageCreate",
  once: false,
  async execute(client, message) {
    if (!message || message.author?.bot) return;
    if (message.webhookId) return; // anti-boucle webhook

    // ---- DM entrant (user → bot)
    if (!message.guildId) {
      const result = await forwardDmToThread(client, message).catch((err) => {
        logger.error(`Modmail DM forward error: ${err?.stack || err}`);
        return null;
      });
      if (!result) {
        await message.reply("📭 Ce bot ne prend pas en charge les messages privés pour le moment.").catch(() => {});
        return;
      }
      // Sauvegarde du mapping pour pouvoir éditer/supprimer/réagir plus tard.
      await saveMapping({
        threadId: result.threadId,
        threadMsgId: result.threadMsgId,
        dmChannelId: result.dmChannelId,
        dmMsgId: result.dmMsgId,
        userId: result.userId,
        direction: 'incoming',
        webhookId: result.webhookId,
      });
      return;
    }

    // ---- Message owner dans un thread modmail (server → DM)
    if (isModmailThread(message.channel) && isOwner(message.author.id)) {
      const targetUserId = extractUserIdFromThreadName(message.channel.name);
      if (targetUserId) {
        // Si reply à un message du thread, on tente de retrouver le DM correspondant
        // pour faire un VRAI reply côté DM (et reconstruire la quote côté thread).
        let replyToDmMsgId = null;
        let replyQuoteForThread = null;
        if (message.reference?.messageId) {
          const refMap = await getByThreadMsg(message.reference.messageId);
          if (refMap?.dm_msg_id) replyToDmMsgId = refMap.dm_msg_id;

          // Construire la quote pour le miroir côté thread.
          const refMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
          if (refMsg) replyQuoteForThread = buildReplyQuote(refMsg);
        }

        const result = await sendOwnerMessageToUser(client, {
          userId: targetUserId,
          senderUser: message.author,
          content: message.content,
          attachments: [...message.attachments.values()],
          archiveInThread: false, // le message original sert d'archive
          replyToDmMsgId,
          replyQuoteForThread, // ignoré car archiveInThread:false, mais on garde la signature propre
        }).catch((err) => {
          logger.error(`Modmail relay error: ${err?.stack || err}`);
          return { ok: false, code: 'exception', error: err };
        });

        if (result?.ok) {
          // On mappe le message ORIGINAL (celui que l'owner a tapé) avec le DM envoyé.
          await saveMapping({
            threadId: message.channel.id,
            threadMsgId: message.id,
            dmChannelId: result.dmChannelId,
            dmMsgId: result.dmMsgId,
            userId: targetUserId,
            direction: 'outgoing',
            webhookId: null, // message tapé directement, pas via webhook
          });
          await message.react("✅").catch(() => {});
        } else {
          const reasonByCode = {
            invalid_id: "❌ ID utilisateur invalide dans le nom du fil.",
            empty: "❌ Message vide, rien à envoyer.",
            user_not_found: "❌ Utilisateur introuvable.",
            dm_failed: "❌ Impossible d'envoyer le DM (DM fermés, blocage, etc.).",
          };
          await message.reply({
            content: reasonByCode[result?.code] || "❌ Échec de l'envoi du DM.",
            allowedMentions: { repliedUser: false },
          }).catch(() => {});
        }
        return;
      }
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
