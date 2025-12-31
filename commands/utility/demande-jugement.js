const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("demande-jugement")
    .setDescription("Ouvrir un dossier de demande de jugement"),

  async execute(interaction) {
    const customId = `doj:main:${interaction.user.id}`;

    const modal = new ModalBuilder()
      .setCustomId(customId)
      .setTitle("Demande de jugement (1/2)");

    const suspect = new TextInputBuilder()
      .setCustomId("suspect")
      .setLabel("Nom prénom du suspect")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(80);

    const ppa = new TextInputBuilder()
      .setCustomId("ppa")
      .setLabel("PPA (ex: Sans PPA / Avec PPA)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(40);

    const faits = new TextInputBuilder()
      .setCustomId("faits")
      .setLabel("Faits reprochés (séparés par virgules)")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);

    const agents = new TextInputBuilder()
      .setCustomId("agents")
      .setLabel("Agent(s) présent(s) (mentions ou texte)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(500);

    const rapport = new TextInputBuilder()
      .setCustomId("rapport")
      .setLabel("Rapport d'arrestation")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1500);

    modal.addComponents(
      new ActionRowBuilder().addComponents(suspect),
      new ActionRowBuilder().addComponents(ppa),
      new ActionRowBuilder().addComponents(faits),
      new ActionRowBuilder().addComponents(agents),
      new ActionRowBuilder().addComponents(rapport)
    );

    return interaction.showModal(modal);
  },
};
