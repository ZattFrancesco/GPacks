const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');

const { isOwner } = require('../../src/utils/permissions');
const { getWelcomeMessage } = require('../../services/welcomeMessage.db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcome-message')
    .setDescription('Configurer le message privé de bienvenue envoyé aux nouveaux membres')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction) {
    // Owner OU membre avec Manage Guild
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
    if (!isAdmin && !isOwner(interaction.user.id)) {
      return interaction.reply({
        content: "❌ Tu dois avoir la permission `Gérer le serveur` (ou être owner du bot).",
        flags: 64,
      });
    }

    // Pré-remplir avec la valeur existante si elle existe.
    const existing = await getWelcomeMessage(interaction.guildId);

    const modal = new ModalBuilder()
      .setCustomId(`welcome-message:save:${interaction.guildId}`)
      .setTitle('Message privé de bienvenue');

    const titleInput = new TextInputBuilder()
      .setCustomId('title')
      .setLabel('Titre de l\'embed (optionnel)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(256)
      .setPlaceholder('Bienvenue sur {server} !');
    if (existing?.title) titleInput.setValue(existing.title);

    const messageInput = new TextInputBuilder()
      .setCustomId('message')
      .setLabel('Message (vide = désactivation)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(2000)
      .setPlaceholder('Variables : {user}, {username}, {server}, {membercount}');
    if (existing?.message) messageInput.setValue(existing.message);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(messageInput),
    );

    return interaction.showModal(modal);
  },
};
