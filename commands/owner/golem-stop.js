const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const { isOwner } = require("../../src/utils/permissions");
const { leaveGolem, getGolemChannelId } = require("../../src/utils/golemVoice");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("golem-stop")
    .setDescription("Fait quitter le bot du salon vocal (propriétaire uniquement)."),

  ownerOnly: true,

  async execute(interaction, client) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        content: "❌ Cette commande est réservée au propriétaire du bot.",
        flags: 64,
      });
    }

    if (!interaction.guild) {
      return interaction.reply({
        content: "❌ Cette commande doit être utilisée dans un serveur.",
        flags: 64,
      });
    }

    const channelId = getGolemChannelId(interaction.guild.id);
    const left = leaveGolem(interaction.guild.id);

    if (!left) {
      return interaction.reply({
        content: "ℹ️ Je ne suis connecté à aucun salon vocal sur ce serveur.",
        flags: 64,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle("🗿 Golem désactivé")
      .setDescription(
        channelId
          ? `J'ai quitté <#${channelId}>.`
          : "J'ai quitté le salon vocal."
      )
      .setColor(0xed4245)
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: 64 });
  },
};
