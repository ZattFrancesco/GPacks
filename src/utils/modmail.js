const {
  ChannelType,
  ThreadAutoArchiveDuration,
  PermissionFlagsBits,
} = require('discord.js');

const WEBHOOK_NAME = 'GPacks Modmail';

// Cache du webhook par parent channel id, pour éviter de refetch à chaque message.
const webhookCache = new Map();

function sanitizeThreadNamePart(value) {
  return String(value || 'unknown')
    .replace(/[\n\r\t]/g, ' ')
    .replace(/[\\/:*?"<>|#]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildThreadName(user) {
  const username = sanitizeThreadNamePart(user?.username || user?.tag || 'user');
  return `${username} - ${user.id}`.slice(0, 100);
}

/**
 * Format d'affichage du nom dans le webhook : "username [ID: 123...]"
 * Limite Discord pour username webhook : 80 chars.
 */
function buildWebhookUsername(user) {
  const base = sanitizeThreadNamePart(user?.username || user?.tag || 'user');
  const suffix = ` [ID: ${user.id}]`;
  const maxBase = 80 - suffix.length;
  const trimmed = base.length > maxBase ? base.slice(0, maxBase - 1) + '…' : base;
  return `${trimmed}${suffix}`;
}

/**
 * Extrait l'ID utilisateur d'un nom de thread modmail.
 * Threads créés par ce module : `username - 123456789012345678`.
 */
function extractUserIdFromThreadName(threadName) {
  if (!threadName) return null;
  const match = String(threadName).match(/(\d{17,20})\s*$/);
  return match ? match[1] : null;
}

function isModmailThread(channel) {
  if (!channel || !channel.isThread?.()) return false;
  const parentId = process.env.MODMAIL_CHANNEL_ID;
  if (!parentId) return false;
  return channel.parentId === parentId;
}

/**
 * Récupère (ou crée) le webhook utilisé pour poster dans les threads modmail.
 * Cache en mémoire pour ne pas refetch à chaque message.
 * Retourne null si impossible (permissions manquantes, etc.).
 */
async function getOrCreateModmailWebhook(client) {
  const parentId = process.env.MODMAIL_CHANNEL_ID;
  if (!parentId) return null;

  if (webhookCache.has(parentId)) {
    return webhookCache.get(parentId);
  }

  const parentChannel = await client.channels.fetch(parentId).catch(() => null);
  if (!parentChannel || parentChannel.type !== ChannelType.GuildText) return null;

  // Vérifie qu'on a la perm.
  const me = parentChannel.guild?.members?.me;
  if (me && !parentChannel.permissionsFor(me)?.has(PermissionFlagsBits.ManageWebhooks)) {
    return null;
  }

  let webhook = null;
  try {
    const hooks = await parentChannel.fetchWebhooks();
    webhook = hooks.find((h) => h.owner?.id === client.user.id && h.name === WEBHOOK_NAME) || null;
  } catch {
    return null;
  }

  if (!webhook) {
    try {
      webhook = await parentChannel.createWebhook({
        name: WEBHOOK_NAME,
        avatar: client.user.displayAvatarURL({ size: 256, extension: 'png' }),
        reason: 'Webhook modmail (relai DM ↔ thread)',
      });
    } catch {
      return null;
    }
  }

  webhookCache.set(parentId, webhook);
  return webhook;
}

async function fetchExistingThread(parentChannel, userId) {
  const active = await parentChannel.threads.fetchActive().catch(() => null);
  let thread = active?.threads?.find((t) => t.name.endsWith(`- ${userId}`) || t.name.endsWith(userId));
  if (thread) return thread;

  const archived = await parentChannel.threads.fetchArchived().catch(() => null);
  thread = archived?.threads?.find((t) => t.name.endsWith(`- ${userId}`) || t.name.endsWith(userId));
  return thread || null;
}

async function getOrCreateModmailThread(client, user) {
  const parentId = process.env.MODMAIL_CHANNEL_ID;
  if (!parentId) return null;

  const parentChannel = await client.channels.fetch(parentId).catch(() => null);
  if (!parentChannel) return null;
  if (parentChannel.type !== ChannelType.GuildText) return null;

  let thread = await fetchExistingThread(parentChannel, user.id);

  if (!thread) {
    thread = await parentChannel.threads.create({
      name: buildThreadName(user),
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      reason: `Modmail auto créé pour ${user.tag} (${user.id})`,
    });

    await thread.send({
      content:
        `📩 **Nouveau fil DM**\n` +
        `**Utilisateur :** ${user.tag}\n` +
        `**ID :** \`${user.id}\``,
    }).catch(() => {});
  } else if (thread.archived) {
    await thread.setArchived(false, 'Réouverture automatique du fil modmail').catch(() => {});
  }

  return thread;
}

/**
 * Poste un message dans un thread via webhook, en se faisant passer pour `asUser`.
 * Fallback en envoi normal (thread.send) si le webhook n'est pas disponible.
 */
async function postViaWebhook(client, thread, { asUser, content, files = [] }) {
  const webhook = await getOrCreateModmailWebhook(client);

  if (webhook) {
    try {
      await webhook.send({
        threadId: thread.id,
        username: buildWebhookUsername(asUser),
        avatarURL: asUser.displayAvatarURL({ size: 256, forceStatic: false }),
        content: content || undefined,
        files,
        allowedMentions: { parse: [] },
      });
      return true;
    } catch {
      // Webhook invalidé (supprimé manuellement) → on vide le cache et on retentera plus tard.
      webhookCache.delete(process.env.MODMAIL_CHANNEL_ID);
    }
  }

  // Fallback : envoi standard en indiquant qui parle.
  await thread.send({
    content: `**${asUser.tag}** : ${content || '*(aucun contenu)*'}`,
    files,
    allowedMentions: { parse: [] },
  }).catch(() => {});
  return false;
}

/**
 * Relai d'un DM entrant (user → bot) vers le thread modmail, via webhook.
 */
async function forwardDmToThread(client, message) {
  const thread = await getOrCreateModmailThread(client, message.author);
  if (!thread) return false;

  const files = message.attachments.map((a) => ({ attachment: a.url, name: a.name || undefined }));

  await postViaWebhook(client, thread, {
    asUser: message.author,
    content: message.content,
    files,
  });

  return true;
}

/**
 * Envoie un DM à `userId` au nom du bot, et poste un miroir dans le thread modmail
 * en se faisant passer pour `senderUser` (toi) via webhook.
 *
 * Codes d'erreur : invalid_id, empty, user_not_found, dm_failed.
 */
async function sendOwnerMessageToUser(client, {
  userId,
  senderUser,        // l'utilisateur Discord qui envoie (l'owner) — utilisé pour le webhook
  content = '',
  attachments = [],
  archiveInThread = true,
}) {
  if (!userId || !/^\d{17,20}$/.test(String(userId))) {
    return { ok: false, code: 'invalid_id' };
  }

  const text = String(content || '').trim();
  const hasFiles = Array.isArray(attachments) && attachments.length > 0;

  if (!text && !hasFiles) {
    return { ok: false, code: 'empty' };
  }

  let user;
  try {
    user = await client.users.fetch(userId);
  } catch (error) {
    return { ok: false, code: 'user_not_found', error };
  }
  if (!user) return { ok: false, code: 'user_not_found' };

  const files = hasFiles
    ? attachments.map((a) => ({ attachment: a.url || a.attachment, name: a.name || undefined }))
    : [];

  try {
    await user.send({
      content: text || undefined,
      files,
    });
  } catch (error) {
    return { ok: false, code: 'dm_failed', error, user };
  }

  let thread = null;
  if (archiveInThread && senderUser) {
    thread = await getOrCreateModmailThread(client, user).catch(() => null);
    if (thread) {
      await postViaWebhook(client, thread, {
        asUser: senderUser,
        content: text,
        files,
      });
    }
  }

  return { ok: true, user, thread };
}

module.exports = {
  getOrCreateModmailThread,
  getOrCreateModmailWebhook,
  forwardDmToThread,
  sendOwnerMessageToUser,
  extractUserIdFromThreadName,
  isModmailThread,
};
