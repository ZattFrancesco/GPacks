// commands/utility/rapport-jugement.js
const {
  SlashCommandBuilder,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rapport-jugement")
    .setDescription("Créer un rapport de jugement (wizard)")
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

  async execute(interaction) {
    const userId = interaction.user.id;

    const modal = new ModalBuilder()
      .setCustomId(`rj:step1:${userId}`)
      .setTitle("Rapport jugement (1/3)");

    const nom = new TextInputBuilder()
      .setCustomId("nom")
      .setLabel("Nom")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(80);

    const prenom = new TextInputBuilder()
      .setCustomId("prenom")
      .setLabel("Prénom")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(80);

    const dateJugement = new TextInputBuilder()
      .setCustomId("dateJugement")
      .setLabel("Date de jugement (timestamp / date, vide = maintenant)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(60);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nom),
      new ActionRowBuilder().addComponents(prenom),
      new ActionRowBuilder().addComponents(dateJugement)
    );

    await interaction.showModal(modal);
  },
};
