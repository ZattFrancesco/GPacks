// commands/utility/rapport-alltime.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const { getCountsByJudge } = require("../../services/rapportJugement.db");

function displayName(row) {
  if (row.judge_user_id) return `<@${row.judge_user_id}>`;
  return row.judge_name || "(inconnu)";
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rapport-alltime")
    .setDescription("Stats des rapports de jugement sur tout l'historique")
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

  async execute(interaction) {
    const guildId = interaction.guildId;
    if (!guildId) return interaction.reply({ content: "❌ Commande utilisable uniquement en serveur.", ephemeral: true });

    await interaction.deferReply({ ephemeral: true });

    const rows = await getCountsByJudge(guildId, null);

    const embed = new EmbedBuilder()
      .setTitle("🏆 Rapports de jugement (all-time)")
      .setDescription("Classement sur tout l'historique (aucune suppression).");

    if (!rows.length) {
      embed.addFields({ name: "Aucun rapport", value: "Rien à afficher." });
    } else {
      const lines = rows.slice(0, 25).map((r, i) => `**${i + 1}.** ${displayName(r)} — **${r.cnt}**`);
      embed.addFields({ name: "Classement", value: lines.join("\n") });
      if (rows.length > 25) embed.setFooter({ text: `+${rows.length - 25} autres...` });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
