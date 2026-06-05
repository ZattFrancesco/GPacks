const {
  SlashCommandBuilder,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");

const { joinGolem } = require("../../src/utils/golemVoice");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("golem")
    .setDescription("Pour les golems")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((opt) =>
      opt
        .setName("salon")
        .setDescription("Le salon vocal à rejoindre")
        .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
        .setRequired(true)
    ),

  // Accessible aux administrateurs du serveur (pas owner-only).
  ownerOnly: false,

  async execute(interaction, client) {
    // Garde-fou : admin requis (en plus de la restriction Discord côté commande)
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: "❌ Cette commande est réservée aux administrateurs du serveur.",
        flags: 64,
      });
    }

    const channel = interaction.options.getChannel("salon");

    if (!interaction.guild) {
      return interaction.reply({
        content: "❌ Cette commande doit être utilisée dans un serveur.",
        flags: 64,
      });
    }

    if (
      !channel ||
      (channel.type !== ChannelType.GuildVoice &&
        channel.type !== ChannelType.GuildStageVoice)
    ) {
      return interaction.reply({
        content: "❌ Tu dois sélectionner un salon **vocal**.",
        flags: 64,
      });
    }

    // Vérifie les permissions du bot sur le salon
    const me = interaction.guild.members.me;
    const perms = channel.permissionsFor(me);
    if (!perms?.has("Connect")) {
      return interaction.reply({
        content: `❌ Je n'ai pas la permission de me connecter à ${channel}.`,
        flags: 64,
      });
    }

    try {
      joinGolem(channel);
    } catch (err) {
      return interaction.reply({
        content: `❌ Impossible de rejoindre le salon : ${err?.message || err}`,
        flags: 64,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle("🗿 Golem activé")
      .setDescription(
        [
          `Je me suis connecté à ${channel}.`,
          "",
          "Je resterai dans ce salon **indéfiniment**.",
          "Je ne partirai que si :",
          "• un utilisateur me **kick / déconnecte** de la vocale,",
          "• le propriétaire utilise `/golem-stop`.",
        ].join("\n")
      )
      .setColor(0x5865f2)
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: 64 });
  },
};
