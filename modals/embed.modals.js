const { isOwner } = require('../src/utils/permissions');
const { saveEmbed, getEmbed } = require('../services/customEmbeds.db');
const { buildEmbed, isValidImageUrl } = require('../src/utils/customEmbedHelpers');
const logger = require('../src/utils/logger');

/**
 * Lit et nettoie les champs communs à create et edit.
 * Retourne null si AUCUN contenu visible (titre + description + footer + image + thumb vides)
 * → on refuse la création d'un embed totalement vide.
 */
function readFields(interaction) {
  const title = (interaction.fields.getTextInputValue('title') || '').trim();
  const description = (interaction.fields.getTextInputValue('description') || '').trim();
  const footer = (interaction.fields.getTextInputValue('footer') || '').trim();
  const thumbnailRaw = (interaction.fields.getTextInputValue('thumbnail') || '').trim();
  const imageRaw = (interaction.fields.getTextInputValue('image') || '').trim();

  // Valide les URLs (si non-vide mais invalide → erreur)
  if (thumbnailRaw && !isValidImageUrl(thumbnailRaw)) {
    return { error: '❌ URL du logo invalide (doit commencer par http(s)://).' };
  }
  if (imageRaw && !isValidImageUrl(imageRaw)) {
    return { error: '❌ URL de l\'image invalide (doit commencer par http(s)://).' };
  }

  // Vérifie qu'il reste au moins quelque chose à afficher
  const hasContent =
    title || description || footer || thumbnailRaw || imageRaw;
  if (!hasContent) {
    return { error: '❌ L\'embed est vide. Remplis au moins un champ.' };
  }

  return {
    data: {
      title: title || null,
      description: description || null,
      footer: footer || null,
      thumbnail: thumbnailRaw || null,
      image: imageRaw || null,
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// CREATE : embed:create:<channelId>:<color|none>
// ──────────────────────────────────────────────────────────────────────────
const modalCreate = {
  idPrefix: 'embed:create:',

  async execute(interaction, client) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        content: '❌ Cette action est réservée au propriétaire du bot.',
        flags: 64,
      });
    }

    const parts = interaction.customId.split(':');
    // [0]embed [1]create [2]channelId [3]color
    const channelId = parts[2];
    const colorPart = parts[3];
    const color = colorPart === 'none' ? null : Number(colorPart);

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased?.()) {
      return interaction.reply({
        content: '❌ Salon introuvable ou non textuel.',
        flags: 64,
      });
    }

    const read = readFields(interaction);
    if (read.error) {
      return interaction.reply({ content: read.error, flags: 64 });
    }

    const embedData = {
      ...read.data,
      color,
    };

    const embed = buildEmbed(embedData, {
      user: interaction.user,
      guild: interaction.guild,
    });

    let sent;
    try {
      sent = await channel.send({ embeds: [embed] });
    } catch (err) {
      logger.warn(`embed.modal create send: ${err?.message || err}`);
      return interaction.reply({
        content: `❌ Impossible d'envoyer le message dans ${channel}. (${err?.code || err?.message || 'erreur inconnue'})`,
        flags: 64,
      });
    }

    const saved = await saveEmbed({
      messageId: sent.id,
      channelId: channel.id,
      guildId: interaction.guildId || null,
      title: embedData.title,
      description: embedData.description,
      footer: embedData.footer,
      thumbnail: embedData.thumbnail,
      image: embedData.image,
      color: embedData.color,
      createdBy: interaction.user.id,
    });

    if (!saved.ok) {
      // Le message est envoyé mais pas en DB → on prévient pour éviter
      // de croire qu'on pourra l'éditer plus tard.
      return interaction.reply({
        content: `⚠️ Embed envoyé (${sent.url}) mais **non enregistré en base** : il ne pourra pas être édité via /embed-edit.`,
        flags: 64,
      });
    }

    return interaction.reply({
      content: `✅ Embed créé dans ${channel} → ${sent.url}\n📌 ID : \`${sent.id}\` (utilise-le avec \`/embed-edit\`)`,
      flags: 64,
    });
  },
};

// ──────────────────────────────────────────────────────────────────────────
// EDIT : embed:edit:<messageId>:<color|none>
// ──────────────────────────────────────────────────────────────────────────
const modalEdit = {
  idPrefix: 'embed:edit:',

  async execute(interaction, client) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        content: '❌ Cette action est réservée au propriétaire du bot.',
        flags: 64,
      });
    }

    const parts = interaction.customId.split(':');
    // [0]embed [1]edit [2]messageId [3]color
    const messageId = parts[2];
    const colorPart = parts[3];
    const color = colorPart === 'none' ? null : Number(colorPart);

    // On relit la DB pour avoir le channelId (et pas se baser sur le client-state)
    const existing = await getEmbed(messageId);
    if (!existing) {
      return interaction.reply({
        content: '❌ Cet embed n\'existe plus en base.',
        flags: 64,
      });
    }

    const channel = await client.channels.fetch(existing.channelId).catch(() => null);
    if (!channel || !channel.isTextBased?.()) {
      return interaction.reply({
        content: '❌ Salon d\'origine introuvable.',
        flags: 64,
      });
    }

    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) {
      return interaction.reply({
        content: '❌ Message original introuvable (supprimé ?). Recrée-le avec `/embed`.',
        flags: 64,
      });
    }

    if (message.author?.id !== client.user.id) {
      return interaction.reply({
        content: '❌ Ce message n\'a pas été envoyé par le bot, impossible de l\'éditer.',
        flags: 64,
      });
    }

    const read = readFields(interaction);
    if (read.error) {
      return interaction.reply({ content: read.error, flags: 64 });
    }

    const embedData = {
      ...read.data,
      color,
    };

    const embed = buildEmbed(embedData, {
      user: interaction.user,
      guild: interaction.guild,
    });

    try {
      await message.edit({ embeds: [embed] });
    } catch (err) {
      logger.warn(`embed.modal edit message: ${err?.message || err}`);
      return interaction.reply({
        content: `❌ Échec de l'édition du message. (${err?.code || err?.message || 'erreur inconnue'})`,
        flags: 64,
      });
    }

    const saved = await saveEmbed({
      messageId: existing.messageId,
      channelId: existing.channelId,
      guildId: existing.guildId,
      title: embedData.title,
      description: embedData.description,
      footer: embedData.footer,
      thumbnail: embedData.thumbnail,
      image: embedData.image,
      color: embedData.color,
      createdBy: existing.createdBy,
    });

    if (!saved.ok) {
      return interaction.reply({
        content: `⚠️ Embed édité (${message.url}) mais **mise à jour DB échouée**. Les prochaines éditions afficheront les anciennes valeurs.`,
        flags: 64,
      });
    }

    return interaction.reply({
      content: `✅ Embed mis à jour → ${message.url}`,
      flags: 64,
    });
  },
};

module.exports = [modalCreate, modalEdit];
