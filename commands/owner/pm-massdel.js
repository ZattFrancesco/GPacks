const {
  SlashCommandBuilder,
  ChannelType,
  EmbedBuilder,
} = require("discord.js");

const { isOwner } = require("../../src/utils/permissions");
const { extractUserIdFromThreadName } = require("../../src/utils/modmail");

/**
 * Supprime tous les messages que le bot peut supprimer (= ses propres messages)
 * dans le DM avec un utilisateur. Parcourt TOUT l'historique par batchs de 100.
 *
 * Limite Discord :
 *  - Le bot ne peut supprimer QUE ses propres messages en DM.
 *  - Pas de bulk delete en DM → suppressions une par une, rate-limit ~5/s.
 *
 * Retourne { deleted, scanned, errors }.
 */
async function purgeBotMessagesInDm(client, userId) {
  const stats = { deleted: 0, scanned: 0, errors: 0 };

  let user;
  try {
    user = await client.users.fetch(userId);
  } catch {
    return { ...stats, fatal: "user_not_found" };
  }
  if (!user) return { ...stats, fatal: "user_not_found" };

  let dm;
  try {
    dm = await user.createDM();
  } catch {
    return { ...stats, fatal: "dm_unavailable" };
  }
  if (!dm) return { ...stats, fatal: "dm_unavailable" };

  let before = undefined;
  const botId = client.user.id;

  // Pagination : Discord renvoie 100 messages max par appel.
  while (true) {
    let batch;
    try {
      batch = await dm.messages.fetch({ limit: 100, before });
    } catch (err) {
      stats.errors++;
      break;
    }
    if (!batch || batch.size === 0) break;

    stats.scanned += batch.size;

    // On note le plus ancien pour la pagination AVANT de supprimer.
    const oldest = batch.last();
    before = oldest?.id;

    // On filtre les messages du bot, on tente de supprimer chacun.
    const mine = batch.filter((m) => m.author?.id === botId);
    for (const msg of mine.values()) {
      try {
        await msg.delete();
        stats.deleted++;
      } catch {
        stats.errors++;
      }
    }

    // Si on a moins de 100, c'est le dernier batch.
    if (batch.size < 100) break;
  }

  return { ...stats, user };
}

/**
 * Liste tous les threads (actifs + archivés) du salon modmail et retourne
 * la liste des userIds extraits du nom de chaque thread.
 */
async function collectModmailUserIds(client) {
  const parentId = process.env.MODMAIL_CHANNEL_ID;
  if (!parentId) return { ids: [], reason: "no_env" };

  const parentChannel = await client.channels.fetch(parentId).catch(() => null);
  if (!parentChannel) return { ids: [], reason: "channel_not_found" };
  if (parentChannel.type !== ChannelType.GuildText) {
    return { ids: [], reason: "wrong_channel_type" };
  }

  const seen = new Set();

  const active = await parentChannel.threads.fetchActive().catch(() => null);
  active?.threads?.forEach((t) => {
    const id = extractUserIdFromThreadName(t.name);
    if (id) seen.add(id);
  });

  const archived = await parentChannel.threads.fetchArchived().catch(() => null);
  archived?.threads?.forEach((t) => {
    const id = extractUserIdFromThreadName(t.name);
    if (id) seen.add(id);
  });

  return { ids: [...seen] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pm-massdel")
    .setDescription("Supprime tous les messages du bot dans les DMs (ses propres messages uniquement)")
    .addStringOption((option) =>
      option
        .setName("id")
        .setDescription("ID d'un utilisateur précis (sinon : tous les threads modmail)")
        .setRequired(false)
    ),

  ownerOnly: true,

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        content: "❌ Cette commande est réservée au propriétaire du bot.",
        flags: 64,
      });
    }

    const client = interaction.client;
    const targetId = interaction.options.getString("id")?.trim() || null;

    if (targetId && !/^\d{17,20}$/.test(targetId)) {
      return interaction.reply({
        content: "❌ ID utilisateur invalide.",
        flags: 64,
      });
    }

    // Defer car l'opération peut être très longue (tout l'historique).
    await interaction.deferReply({ flags: 64 });

    // Détermination de la cible.
    let userIds;
    if (targetId) {
      userIds = [targetId];
    } else {
      const collected = await collectModmailUserIds(client);
      if (collected.reason === "no_env") {
        return interaction.editReply({
          content: "❌ `MODMAIL_CHANNEL_ID` n'est pas défini dans le `.env`.",
        });
      }
      if (collected.reason === "channel_not_found") {
        return interaction.editReply({
          content: "❌ Salon modmail introuvable (vérifie `MODMAIL_CHANNEL_ID`).",
        });
      }
      if (collected.reason === "wrong_channel_type") {
        return interaction.editReply({
          content: "❌ `MODMAIL_CHANNEL_ID` ne pointe pas vers un salon texte.",
        });
      }
      userIds = collected.ids;
    }

    if (userIds.length === 0) {
      return interaction.editReply({
        content: "ℹ️ Aucun DM à purger (aucun thread modmail trouvé).",
      });
    }

    // Petit accusé de réception avant le gros travail.
    await interaction.editReply({
      content: `🧹 Purge lancée sur **${userIds.length}** DM(s)… cela peut prendre un moment.`,
    });

    const startedAt = Date.now();
    let totalDeleted = 0;
    let totalScanned = 0;
    let totalErrors = 0;
    const perUserLines = [];
    const failures = [];

    for (const uid of userIds) {
      const result = await purgeBotMessagesInDm(client, uid);

      if (result.fatal) {
        failures.push(`\`${uid}\` — ${result.fatal}`);
        continue;
      }

      totalDeleted += result.deleted;
      totalScanned += result.scanned;
      totalErrors += result.errors;

      const tag = result.user?.tag || "?";
      perUserLines.push(`• **${tag}** (\`${uid}\`) — ${result.deleted} supprimés / ${result.scanned} scannés${result.errors ? ` • ${result.errors} erreurs` : ""}`);
    }

    const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);

    const embed = new EmbedBuilder()
      .setTitle("🧹 Purge DM terminée")
      .setColor(0x57f287)
      .setDescription([
        `**Cibles** : ${userIds.length} DM(s)`,
        `**Messages scannés** : ${totalScanned}`,
        `**Messages supprimés** : ${totalDeleted}`,
        `**Erreurs** : ${totalErrors}`,
        `**Durée** : ${elapsedSec}s`,
      ].join("\n"))
      .setTimestamp(new Date());

    // Détail par user, tronqué si trop long.
    if (perUserLines.length) {
      const joined = perUserLines.join("\n");
      embed.addFields({
        name: "Détail",
        value: joined.length > 1024 ? joined.slice(0, 1010) + "\n…(tronqué)" : joined,
      });
    }

    if (failures.length) {
      const joined = failures.join("\n");
      embed.addFields({
        name: "Échecs",
        value: joined.length > 1024 ? joined.slice(0, 1010) + "\n…(tronqué)" : joined,
      });
    }

    return interaction.editReply({
      content: null,
      embeds: [embed],
    });
  },
};
