// commands/utility/rapport-semaine.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const { getLastReset, getCountsByJudge } = require("../../services/rapportJugement.db");

function toUnix(date) {
  return Math.floor(new Date(date).getTime() / 1000);
}

function displayName(row) {
  if (row.judge_user_id) return `<@${row.judge_user_id}>`;
  return row.judge_name || "(inconnu)";
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rapport-semaine")
    .setDescription("Stats des rapports de jugement depuis le dernier reset")
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

  async execute(interaction) {
    const guildId = interaction.guildId;
    if (!guildId) return interaction.reply({ content: "❌ Commande utilisable uniquement en serveur.", ephemeral: true });

    await interaction.deferReply({ ephemeral: true });

    const last = await getLastReset(guildId);
    const since = last?.reset_at ? new Date(last.reset_at) : null;

    const rows = await getCountsByJudge(guildId, since);

    const title = "📊 Rapports de jugement (semaine)";
    const desc = since
      ? `Depuis le dernier reset : <t:${toUnix(since)}:F>`
      : "Aucun reset enregistré : stats depuis le début.";

    const embed = new EmbedBuilder().setTitle(title).setDescription(desc);

    if (!rows.length) {
      embed.addFields({ name: "Aucun rapport", value: "Rien à afficher pour la période." });
    } else {
      const lines = rows.slice(0, 25).map((r, i) => `**${i + 1}.** ${displayName(r)} — **${r.cnt}**`);
      embed.addFields({ name: "Classement", value: lines.join("\n") });
      if (rows.length > 25) embed.setFooter({ text: `+${rows.length - 25} autres...` });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
