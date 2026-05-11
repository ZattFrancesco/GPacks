const {
  ChannelType,
  ThreadAutoArchiveDuration,
  PermissionFlagsBits,
} = require('discord.js');

const WEBHOOK_NAME = 'GPacks Modmail';

// Cache du webhook par parent channel id.
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

function buildWebhookUsername(user) {
  const base = sanitizeThreadNamePart(user?.username || user?.tag || 'user');
  const suffix = ` [ID: ${user.id}]`;
  const maxBase = 80 - suffix.length;
  const trimmed = base.length > maxBase ? base.slice(0, maxBase - 1) + '…' : base;
  return `${trimmed}${suffix}`;
}

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

async function getOrCreateModmailWebhook(client) {
  const parentId = process.env.MODMAIL_CHANNEL_ID;
  if (!parentId) return null;

  if (webhookCache.has(parentId)) return webhookCache.get(parentId);

  const parentChannel = await client.channels.fetch(parentId).catch(() => null);
  if (!parentChannel || parentChannel.type !== ChannelType.GuildText) return null;

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
 * Construit le bloc "reply" en markdown : citation visuelle du message d'origine.
 * Quand on ne peut pas faire un vrai messageReference (DM ↔ webhook), on simule.
 */
function buildReplyQuote(referencedMsg, maxLen = 80) {
  if (!referencedMsg) return '';
  const author = referencedMsg.author?.username || referencedMsg.author?.tag || 'inconnu';
  let text = String(referencedMsg.content || '').replace(/\n/g, ' ').trim();
  if (!text) text = '*(pièce jointe / embed)*';
  if (text.length > maxLen) text = text.slice(0, maxLen - 1) + '…';
  return `> **↪ ${author}** : ${text}\n`;
}

/**
 * Poste un message dans un thread via webhook, en se faisant passer pour `asUser`.
 * Retourne le message créé (utile pour récupérer son ID), ou null si fallback.
 */
async function postViaWebhook(client, thread, { asUser, content, files = [] }) {
  const webhook = await getOrCreateModmailWebhook(client);

  if (webhook) {
    try {
      const sent = await webhook.send({
        threadId: thread.id,
        username: buildWebhookUsername(asUser),
        avatarURL: asUser.displayAvatarURL({ size: 256, forceStatic: false }),
        content: content || undefined,
        files,
        allowedMentions: { parse: [] },
      });
      return { message: sent, webhookId: webhook.id, viaWebhook: true };
    } catch {
      webhookCache.delete(process.env.MODMAIL_CHANNEL_ID);
    }
  }

  // Fallback : envoi standard.
  const sent = await thread.send({
    content: `**${asUser.tag}** : ${content || '*(aucun contenu)*'}`,
    files,
    allowedMentions: { parse: [] },
  }).catch(() => null);
  return sent ? { message: sent, webhookId: null, viaWebhook: false } : null;
}

/**
 * Édite un message déjà posté via webhook.
 * Retourne true si succès, false sinon.
 */
async function editWebhookMessage(client, { threadId, messageId, content }) {
  const webhook = await getOrCreateModmailWebhook(client);
  if (!webhook) return false;
  try {
    await webhook.editMessage(messageId, {
      content: content || ' ', // Discord n'aime pas le contenu vide
      threadId,
      allowedMentions: { parse: [] },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Édite un message DM (côté user) via le DMChannel.
 * Note : le bot ne peut éditer que SES propres messages.
 */
async function editDmMessage(client, { dmChannelId, dmMsgId, content }) {
  try {
    const channel = await client.channels.fetch(dmChannelId).catch(() => null);
    if (!channel) return false;
    const msg = await channel.messages.fetch(dmMsgId).catch(() => null);
    if (!msg) return false;
    if (msg.author?.id !== client.user.id) return false; // pas notre msg → impossible
    await msg.edit({
      content: content || ' ',
      allowedMentions: { parse: [] },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Ajoute ou retire une réaction sur un message webhook (dans le thread)
 * OU sur un message DM (côté user). Le webhookId n'est pas nécessaire ici :
 * une réaction sur un message webhook se fait comme sur n'importe quel autre message.
 */
async function reactToMessage(client, { channelId, messageId, emoji, add = true }) {
  try {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return false;
    const msg = await channel.messages.fetch(messageId).catch(() => null);
    if (!msg) return false;
    if (add) {
      await msg.react(emoji);
    } else {
      const reaction = msg.reactions.cache.find(
        (r) => r.emoji?.name === emoji || r.emoji?.id === emoji || r.emoji?.toString() === emoji
      );
      if (reaction) {
        await reaction.users.remove(client.user.id).catch(() => {});
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Épingle / désépingle un message côté DM.
 */
async function setPinDmMessage(client, { dmChannelId, dmMsgId, pin }) {
  try {
    const channel = await client.channels.fetch(dmChannelId).catch(() => null);
    if (!channel) return false;
    const msg = await channel.messages.fetch(dmMsgId).catch(() => null);
    if (!msg) return false;
    if (pin) await msg.pin().catch(() => {});
    else await msg.unpin().catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/**
 * Relai d'un DM entrant via webhook, avec support des replies (citation visuelle).
 * Retourne { threadMsgId, webhookId, dmMsgId, dmChannelId } si succès.
 */
async function forwardDmToThread(client, message) {
  const thread = await getOrCreateModmailThread(client, message.author);
  if (!thread) return null;

  const files = message.attachments.map((a) => ({ attachment: a.url, name: a.name || undefined }));

  // Si c'est une reply dans le DM, on récupère le message cité pour reconstruire la quote.
  let quote = '';
  if (message.reference?.messageId) {
    const referenced = await message.channel.messages
      .fetch(message.reference.messageId)
      .catch(() => null);
    if (referenced) quote = buildReplyQuote(referenced);
  }

  const finalContent = quote + (message.content || '');

  const result = await postViaWebhook(client, thread, {
    asUser: message.author,
    content: finalContent,
    files,
  });

  if (!result) return null;

  return {
    threadId: thread.id,
    threadMsgId: result.message.id,
    webhookId: result.webhookId,
    dmChannelId: message.channel.id,
    dmMsgId: message.id,
    userId: message.author.id,
  };
}

/**
 * Envoie un DM à un user au nom du bot + miroir dans le thread via webhook.
 * Supporte les replies : si `replyToDmMsgId` est fourni, le DM sera envoyé en reply.
 */
async function sendOwnerMessageToUser(client, {
  userId,
  senderUser,
  content = '',
  attachments = [],
  archiveInThread = true,
  replyToDmMsgId = null,         // si on veut que le DM soit une vraie reply
  replyQuoteForThread = null,    // contenu de quote visuel à préfixer côté thread
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

  let dmSent;
  try {
    const dmPayload = {
      content: text || undefined,
      files,
    };
    if (replyToDmMsgId) {
      dmPayload.reply = { messageReference: replyToDmMsgId, failIfNotExists: false };
    }
    dmSent = await user.send(dmPayload);
  } catch (error) {
    return { ok: false, code: 'dm_failed', error, user };
  }

  let thread = null;
  let threadMsgId = null;
  let webhookId = null;

  if (archiveInThread && senderUser) {
    thread = await getOrCreateModmailThread(client, user).catch(() => null);
    if (thread) {
      const finalContent = (replyQuoteForThread || '') + text;
      const posted = await postViaWebhook(client, thread, {
        asUser: senderUser,
        content: finalContent,
        files,
      });
      if (posted) {
        threadMsgId = posted.message.id;
        webhookId = posted.webhookId;
      }
    }
  }

  return {
    ok: true,
    user,
    thread,
    threadMsgId,
    webhookId,
    dmMsgId: dmSent.id,
    dmChannelId: dmSent.channel?.id || dmSent.channelId,
  };
}

module.exports = {
  // existants
  getOrCreateModmailThread,
  getOrCreateModmailWebhook,
  forwardDmToThread,
  sendOwnerMessageToUser,
  extractUserIdFromThreadName,
  isModmailThread,
  // nouveaux helpers
  editWebhookMessage,
  editDmMessage,
  reactToMessage,
  setPinDmMessage,
  buildReplyQuote,
};
