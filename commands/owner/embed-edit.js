const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");

const { isOwner } = require("../../src/utils/permissions");
const { getEmbed } = require("../../services/customEmbeds.db");
const { colorToHex } = require("../../src/utils/customEmbedHelpers");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("embed-edit")
    .setDescription("Modifier un embed existant via l'ID du message (owner)")
    .addStringOption((option) =>
      option
        .setName("message_id")
        .setDescription("ID du message contenant l'embed")
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

    const messageId = interaction.options.getString("message_id", true).trim();
    if (!/^\d{17,20}$/.test(messageId)) {
      return interaction.reply({
        content: "❌ ID de message invalide.",
        flags: 64,
      });
    }

    const data = await getEmbed(messageId);
    if (!data) {
      return interaction.reply({
        content: "❌ Aucun embed trouvé en base pour ce message. Seuls les embeds créés via `/embed` sont éditables.",
        flags: 64,
      });
    }

    // On préserve la couleur d'origine dans le customId pour la conserver
    // si l'utilisateur ne touche à rien (les modals ne portent pas de champ couleur).
    const colorPart = data.color == null ? "none" : String(data.color);
    const modal = new ModalBuilder()
      .setCustomId(`embed:edit:${data.messageId}:${colorPart}`)
      .setTitle("Modifier l'embed");

    const titleInput = new TextInputBuilder()
      .setCustomId("title")
      .setLabel("Titre")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(256);
    if (data.title) titleInput.setValue(data.title.slice(0, 256));

    const descInput = new TextInputBuilder()
      .setCustomId("description")
      .setLabel("Description")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(4000);
    if (data.description) descInput.setValue(data.description.slice(0, 4000));

    // Le footer affiche aussi la couleur actuelle en placeholder (info)
    const footerInput = new TextInputBuilder()
      .setCustomId("footer")
      .setLabel("Footer")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(2048);
    if (data.footer) footerInput.setValue(data.footer.slice(0, 2048));
    const hex = colorToHex(data.color);
    if (hex) {
      footerInput.setPlaceholder(`Couleur actuelle : ${hex} (inchangeable ici, relance /embed pour la changer)`);
    }

    const thumbInput = new TextInputBuilder()
      .setCustomId("thumbnail")
      .setLabel("Logo (thumbnail, en haut à droite)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(1024)
      .setPlaceholder("Vide = supprimer. URL = remplacer.");
    if (data.thumbnail) thumbInput.setValue(data.thumbnail.slice(0, 1024));

    const imageInput = new TextInputBuilder()
      .setCustomId("image")
      .setLabel("Image / background (grande image)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(1024)
      .setPlaceholder("Vide = supprimer. URL = remplacer.");
    if (data.image) imageInput.setValue(data.image.slice(0, 1024));

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(descInput),
      new ActionRowBuilder().addComponents(footerInput),
      new ActionRowBuilder().addComponents(thumbInput),
      new ActionRowBuilder().addComponents(imageInput),
    );

    return interaction.showModal(modal);
  },
};
