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

module.exports = {
  getOrCreateModmailThread,
  forwardDmToThread,
};
