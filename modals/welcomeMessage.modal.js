const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { isOwner } = require('../src/utils/permissions');
const {
  setWelcomeMessage,
  clearWelcomeMessage,
  applyVariables,
} = require('../services/welcomeMessage.db');

module.exports = {
  idPrefix: 'welcome-message:save:',

  async execute(interaction) {
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
    if (!isAdmin && !isOwner(interaction.user.id)) {
      return interaction.reply({
        content: "❌ Tu dois avoir la permission `Gérer le serveur` (ou être owner du bot).",
        flags: 64,
      });
    }

    const guildId = interaction.guildId;
    if (!guildId) {
      return interaction.reply({ content: '❌ Cette action doit se faire sur un serveur.', flags: 64 });
    }

    const title = (interaction.fields.getTextInputValue('title') || '').trim();
    const message = (interaction.fields.getTextInputValue('message') || '').trim();

    // ---- Champ message vide → désactivation
    if (!message) {
      const result = await clearWelcomeMessage(guildId);
      if (!result.ok) {
        return interaction.reply({
          content: '❌ Erreur lors de la suppression. Réessaie plus tard.',
          flags: 64,
        });
      }
      return interaction.reply({
        content: result.removed
          ? '🗑️ Message de bienvenue supprimé. Les nouveaux membres ne recevront plus de DM.'
          : 'ℹ️ Aucun message de bienvenue configuré, rien à supprimer.',
        flags: 64,
      });
    }

    // ---- Sauvegarde
    const saved = await setWelcomeMessage({
      guildId,
      title: title || null,
      message,
      updatedBy: interaction.user.id,
    });

    if (!saved.ok) {
      return interaction.reply({
        content: '❌ Erreur lors de la sauvegarde. Réessaie plus tard.',
        flags: 64,
      });
    }

    // Aperçu : on simule l'envoi avec l'auteur de la commande comme membre.
    const previewMember = {
      user: interaction.user,
    };
    const renderedTitle = title ? applyVariables(title, { member: previewMember, guild: interaction.guild }) : null;
    const renderedMessage = applyVariables(message, { member: previewMember, guild: interaction.guild });

    const color = interaction.guild?.members?.me?.displayColor || 0x5865f2;

    const previewEmbed = new EmbedBuilder()
      .setColor(color)
      .setDescription(renderedMessage.slice(0, 4096));
    if (renderedTitle) previewEmbed.setTitle(renderedTitle.slice(0, 256));
    if (interaction.guild?.iconURL?.()) previewEmbed.setThumbnail(interaction.guild.iconURL());
    previewEmbed.setFooter({ text: `${interaction.guild?.name || ''}` });

    return interaction.reply({
      content: '✅ Message de bienvenue enregistré. Aperçu ci-dessous :',
      embeds: [previewEmbed],
      flags: 64,
    });
  },
};
