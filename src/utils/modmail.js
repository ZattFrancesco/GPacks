const {
  ChannelType,
  EmbedBuilder,
  ThreadAutoArchiveDuration,
} = require('discord.js');

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
 * Extrait l'ID utilisateur d'un nom de thread modmail.
 * Les threads créés par ce module ont la forme `username - 123456789012345678`.
 * Retourne l'ID si trouvé, sinon null.
 */
function extractUserIdFromThreadName(threadName) {
  if (!threadName) return null;
  const match = String(threadName).match(/(\d{17,20})\s*$/);
  return match ? match[1] : null;
}

/**
 * Détermine si un thread est un thread modmail (enfant du salon MODMAIL_CHANNEL_ID).
 */
function isModmailThread(channel) {
  if (!channel || !channel.isThread?.()) return false;
  const parentId = process.env.MODMAIL_CHANNEL_ID;
  if (!parentId) return false;
  return channel.parentId === parentId;
}

function buildMessageEmbed(message) {
  const hasText = Boolean(String(message.content || '').trim());
  const attachmentLines = message.attachments.size
    ? message.attachments.map((a) => `• [${a.name || 'fichier'}](${a.url})`).join('\n')
    : null;

  const embed = new EmbedBuilder()
    .setAuthor({
      name: `${message.author.tag} (${message.author.id})`,
      iconURL: message.author.displayAvatarURL({ forceStatic: false }),
    })
    .setDescription(hasText ? message.content.slice(0, 4096) : '*Aucun contenu texte*')
    .setFooter({ text: `DM reçu • User ID: ${message.author.id}` })
    .setTimestamp(message.createdAt || new Date());

  if (attachmentLines) {
    embed.addFields({
      name: 'Pièces jointes',
      value: attachmentLines.slice(0, 1024),
    });
  }

  return embed;
}

/**
 * Embed pour les messages que l'owner envoie depuis le serveur vers le user.
 * Différencié visuellement des messages reçus (couleur + footer).
 */
function buildOutgoingEmbed(message, targetUser) {
  const hasText = Boolean(String(message.content || '').trim());
  const attachmentLines = message.attachments?.size
    ? message.attachments.map((a) => `• [${a.name || 'fichier'}](${a.url})`).join('\n')
    : null;

  const embed = new EmbedBuilder()
    .setAuthor({
      name: `${message.author.tag} (${message.author.id})`,
      iconURL: message.author.displayAvatarURL({ forceStatic: false }),
    })
    .setColor(0x57f287)
    .setDescription(hasText ? message.content.slice(0, 4096) : '*Aucun contenu texte*')
    .setFooter({ text: `DM envoyé → ${targetUser.tag} (${targetUser.id})` })
    .setTimestamp(message.createdAt || new Date());

  if (attachmentLines) {
    embed.addFields({
      name: 'Pièces jointes',
      value: attachmentLines.slice(0, 1024),
    });
  }

  return embed;
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

async function forwardDmToThread(client, message) {
  const thread = await getOrCreateModmailThread(client, message.author);
  if (!thread) return false;

  const files = message.attachments.map((a) => ({ attachment: a.url, name: a.name || undefined }));

  await thread.send({
    embeds: [buildMessageEmbed(message)],
    files,
    allowedMentions: { parse: [] },
  });

  return true;
}

/**
 * Envoie un DM à l'utilisateur cible et archive un récap dans le thread modmail.
 * Utilisé à la fois par le modal `/pm` et par l'auto-relai des messages écrits
 * directement dans un thread modmail.
 *
 * Retourne { ok: true, user, thread } en cas de succès,
 * ou { ok: false, code, error } en cas d'échec :
 *   - 'invalid_id'    : userId non valide
 *   - 'empty'         : contenu vide ET aucune pièce jointe
 *   - 'user_not_found': fetch utilisateur impossible
 *   - 'dm_failed'     : envoi du DM rejeté par Discord (DM fermés, blocage, etc.)
 */
async function sendOwnerMessageToUser(client, {
  userId,
  content = '',
  attachments = [],
  authorMessage = null, // facultatif : message Discord d'origine pour l'embed récap
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
  if (archiveInThread) {
    thread = await getOrCreateModmailThread(client, user).catch(() => null);
    if (thread && authorMessage) {
      await thread.send({
        embeds: [buildOutgoingEmbed(authorMessage, user)],
        files,
        allowedMentions: { parse: [] },
      }).catch(() => {});
    }
  }

  return { ok: true, user, thread };
}

module.exports = {
  getOrCreateModmailThread,
  forwardDmToThread,
  sendOwnerMessageToUser,
  extractUserIdFromThreadName,
  isModmailThread,
};
