// commands/utility/demande-jugement.js
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
    .setName("demande-jugement")
    .setDescription("Ouvrir une demande de jugement (assistant)")
    // tu peux retirer si tu veux le rendre public
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

  async execute(interaction) {
    const userId = interaction.user.id;

    const modal = new ModalBuilder()
      .setCustomId(`doj:main:${userId}`)
      .setTitle("Demande de jugement (1/1)");

    const suspect = new TextInputBuilder()
      .setCustomId("suspect")
      .setLabel("Nom prénom du suspect")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(60);

    const ppa = new TextInputBuilder()
      .setCustomId("ppa")
      .setLabel("PPA (ex: Sans PPA / PPA 4)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(40);

    const faits = new TextInputBuilder()
      .setCustomId("faits")
      .setLabel("Faits reprochés (sépare par des virgules)")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(900);

    const agentsPresents = new TextInputBuilder()
      .setCustomId("agentsPresents")
      .setLabel("Agent(s) présent(s) (mentions ou noms)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(150);

    const rapport = new TextInputBuilder()
      .setCustomId("rapport")
      .setLabel("Rapport d'arrestation")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(900);

    modal.addComponents(
      new ActionRowBuilder().addComponents(suspect),
      new ActionRowBuilder().addComponents(ppa),
      new ActionRowBuilder().addComponents(faits),
      new ActionRowBuilder().addComponents(agentsPresents),
      new ActionRowBuilder().addComponents(rapport),
    );

    await interaction.showModal(modal);
  },
};