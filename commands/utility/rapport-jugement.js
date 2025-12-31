// commands/utility/rapport-jugement.js

const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rapport-jugement")
    .setDescription("Créer un rapport de jugement"),

  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId(`rj:step1:${interaction.user.id}`)
      .setTitle("Rapport jugement - Étape 1/3");

    const nom = new TextInputBuilder()
      .setCustomId("nom")
      .setLabel("Nom")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const prenom = new TextInputBuilder()
      .setCustomId("prenom")
      .setLabel("Prénom")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const dateJugement = new TextInputBuilder()
      .setCustomId("dateJugement")
      .setLabel("Date jugement (timestamp ou date)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setPlaceholder("ex: 1735689600 ou 2025-12-31 18:00");

    modal.addComponents(
      new ActionRowBuilder().addComponents(nom),
      new ActionRowBuilder().addComponents(prenom),
      new ActionRowBuilder().addComponents(dateJugement)
    );

    await interaction.showModal(modal);
  },
};