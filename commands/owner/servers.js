const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");

const { isOwner } = require("../../src/utils/permissions");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("servers")
    .setDescription("Liste tous les serveurs où le bot est présent"),

  ownerOnly: true,

  async execute(interaction, client) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        content: "❌ Cette commande est réservée au propriétaire du bot.",
        flags: 64,
      });
    }

    const guilds = client.guilds.cache;

    if (!guilds.size) {
      return interaction.reply({
        content: "❌ Le bot n'est sur aucun serveur.",
        flags: 64,
      });
    }

    // Build description list
    const lines = guilds.map((g, _id, _col) => {
      const memberCount = g.memberCount || "?";
      return `🔹 **${g.name}** — \`${g.id}\` (${memberCount} membres)`;
    });

    const embed = new EmbedBuilder()
      .setTitle("🌐 Serveurs du bot")
      .setDescription(lines.join("\n").slice(0, 4000))
      .setColor(0x5865f2)
      .setFooter({ text: `Total : ${guilds.size} serveur(s)` })
      .setTimestamp();

    // Build select menu (max 25 options)
    const options = guilds.first(25).map((g) => ({
      label: g.name.slice(0, 100),
      description: `${g.memberCount || "?"} membres — ${g.id}`,
      value: g.id,
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("servers:invite")
      .setPlaceholder("📩 Sélectionne un serveur pour recevoir une invitation")
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    return interaction.reply({
      embeds: [embed],
      components: [row],
      flags: 64,
    });
  },
};
