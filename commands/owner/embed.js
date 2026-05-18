const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ChannelType,
  PermissionFlagsBits,
} = require("discord.js");

const { isOwner } = require("../../src/utils/permissions");
const { parseColor } = require("../../src/utils/customEmbedHelpers");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("embed")
    .setDescription("Créer un embed personnalisé (owner)")
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Salon de destination (par défaut : salon actuel)")
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement,
          ChannelType.PublicThread,
          ChannelType.PrivateThread,
          ChannelType.AnnouncementThread,
        )
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("color")
        .setDescription("Couleur hex (#5865F2, blurple, red, green...)")
        .setRequired(false)
    ),

  ownerOnly: true,

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        content: "❌ Cette commande est réservée au propriétaire du bot.",
        flags: 64,
      });
    }

    const channel = interaction.options.getChannel("channel") || interaction.channel;
    if (!channel) {
      return interaction.reply({
        content: "❌ Impossible de déterminer le salon de destination.",
        flags: 64,
      });
    }

    // Vérifie les perms du bot dans ce salon
    const me = interaction.guild?.members?.me;
    if (me) {
      const perms = channel.permissionsFor(me);
      if (!perms?.has(PermissionFlagsBits.ViewChannel) ||
          !perms?.has(PermissionFlagsBits.SendMessages) ||
          !perms?.has(PermissionFlagsBits.EmbedLinks)) {
        return interaction.reply({
          content: `❌ Il me manque la permission **Voir / Envoyer des messages / Joindre des liens** dans ${channel}.`,
          flags: 64,
        });
      }
    }

    // Couleur : valide en amont mais ne bloque pas si vide
    const rawColor = interaction.options.getString("color");
    let color = null;
    if (rawColor) {
      color = parseColor(rawColor);
      if (color == null) {
        return interaction.reply({
          content: "❌ Couleur invalide. Utilise un hex (`#5865F2`) ou un nom (`red`, `blue`, `blurple`...).",
          flags: 64,
        });
      }
    }

    // customId : embed:create:<channelId>:<color|none>
    const colorPart = color == null ? "none" : String(color);
    const modal = new ModalBuilder()
      .setCustomId(`embed:create:${channel.id}:${colorPart}`)
      .setTitle("Créer un embed");

    const titleInput = new TextInputBuilder()
      .setCustomId("title")
      .setLabel("Titre")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(256)
      .setPlaceholder("Titre de l'embed (optionnel)");

    const descInput = new TextInputBuilder()
      .setCustomId("description")
      .setLabel("Description")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(4000)
      .setPlaceholder("Markdown + \\n pour retour ligne. Variables : {user} {server} {membercount}");

    const footerInput = new TextInputBuilder()
      .setCustomId("footer")
      .setLabel("Footer")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(2048)
      .setPlaceholder("Texte du pied de page (optionnel)");

    const thumbInput = new TextInputBuilder()
      .setCustomId("thumbnail")
      .setLabel("Logo (thumbnail, en haut à droite)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(1024)
      .setPlaceholder("https://...png (optionnel)");

    const imageInput = new TextInputBuilder()
      .setCustomId("image")
      .setLabel("Image / background (grande image)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(1024)
      .setPlaceholder("https://...png (optionnel)");

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
