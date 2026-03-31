const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");

const { isOwner } = require("../../src/utils/permissions");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pm")
    .setDescription("Envoyer un message privé à un utilisateur via son ID")
    .addStringOption((option) =>
      option
        .setName("id")
        .setDescription("ID de l'utilisateur")
        .setRequired(true)
    ),

  ownerOnly: true,

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        content: "❌ Cette commande est réservée au propriétaire du bot.",
        flags: 64,
      });
    }

    const userId = interaction.options.getString("id", true).trim();

    if (!/^\d{17,20}$/.test(userId)) {
      return interaction.reply({
        content: "❌ ID utilisateur invalide.",
        flags: 64,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`pm:send:${userId}`)
      .setTitle("Envoyer un message privé");

    const messageInput = new TextInputBuilder()
      .setCustomId("message")
      .setLabel("Message")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(2000)
      .setPlaceholder("Écris ici le message à envoyer...");

    modal.addComponents(
      new ActionRowBuilder().addComponents(messageInput)
    );

    return interaction.showModal(modal);
  },
};