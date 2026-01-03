const { SlashCommandBuilder, EmbedBuilder, REST, Routes } = require("discord.js");

// .env attendu (comme ton exemple)
const OWNER_ID = process.env.OWNER_ID;
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

module.exports = {
  category: "dev",

  data: new SlashCommandBuilder()
    .setName("ownerrefresh")
    .setDescription("Dev Only : Purger les commandes locales (GUILD) du serveur"),

  // si ton projet a déjà un guard ownerOnly dans interactionCreate
  ownerOnly: true,

  async execute(interaction) {
    // 1) sécurité owner
    if (!OWNER_ID || interaction.user.id !== OWNER_ID) {
      return interaction.reply({
        content: "❌ Cette commande est réservée au propriétaire du bot.",
        ephemeral: true,
      });
    }

    // 2) check env
    if (!TOKEN || !CLIENT_ID) {
      return interaction.reply({
        content: "❌ DISCORD_TOKEN ou CLIENT_ID manquant dans le .env.",
        ephemeral: true,
      });
    }

    // 3) check guild
    const guildId = interaction.guildId;
    if (!guildId) {
      return interaction.reply({
        content: "❌ Cette commande doit être utilisée dans un serveur.",
        ephemeral: true,
      });
    }

    await interaction.reply({
      content: `♻️ Nettoyage des commandes **locales (GUILD)** pour ce serveur (\`${guildId}\`)…`,
      ephemeral: true,
    });

    try {
      const rest = new REST({ version: "10" }).setToken(TOKEN);

      // purge commandes guild uniquement
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guildId), {
        body: [],
      });

      const embed = new EmbedBuilder()
        .setTitle("✅ Nettoyage terminé")
        .setDescription(
          [
            "Toutes les **commandes GUILD** de ce serveur ont été supprimées.",
            "",
            "• Les **commandes GLOBAL** restent intactes.",
            "• Discord peut mettre un petit moment à resynchroniser les commandes.",
          ].join("\n")
        )
        .setColor(0x57f287)
        .setTimestamp();

      await interaction.editReply({
        content: "",
        embeds: [embed],
      });
    } catch (error) {
      console.error("[ownerrefresh]", error);
      await interaction.editReply({
        content:
          "❌ Une erreur est survenue lors de la suppression des commandes locales.",
      });
    }
  },
};