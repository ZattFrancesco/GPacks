// commands/utility/visa-creation.js

const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("visa-creation")
    .setDescription("Créer un visa (brouillon puis enregistrement)"),

  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId(`visa:step1:${interaction.user.id}`)
      .setTitle("Visa - Identité");

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

    const identityId = new TextInputBuilder()
      .setCustomId("identityId")
      .setLabel("ID")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("ex: 12345 / Matricule / Dossier");

    modal.addComponents(
      new ActionRowBuilder().addComponents(nom),
      new ActionRowBuilder().addComponents(prenom),
      new ActionRowBuilder().addComponents(identityId)
    );

    return interaction.showModal(modal);
  },
};
