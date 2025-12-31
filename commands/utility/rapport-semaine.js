// commands/utility/rapport-semaine.js

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getLastReset, listReports, getReportCount } = require("../../services/rapportJugement.db");

function safe(v, fallback = "/") {
  const t = (v ?? "").toString().trim();
  return t.length ? t : fallback;
}

// split lignes en fields (Discord limite value)
function chunkLinesIntoFields(lines, maxValueLen = 950) {
  const fields = [];
  let current = "";

  for (const line of lines) {
    // +1 pour \n
    if ((current + (current ? "\n" : "") + line).length > maxValueLen) {
      fields.push(current);
      current = line;
    } else {
      current = current ? current + "\n" + line : line;
    }
  }
  if (current) fields.push(current);
  return fields;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rapport-semaine")
    .setDescription("Affiche la liste des rapports depuis le dernier reset (format paie)")
    .addIntegerOption(opt =>
      opt.setName("limit")
        .setDescription("Nombre max de rapports à afficher (défaut 50, max 200)")
        .setRequired(false)
    ),

  async execute(interaction) {
    const limit = Math.min(Math.max(interaction.options.getInteger("limit") ?? 50, 1), 200);

    // récupère dernier reset
    const lastReset = await getLastReset(interaction.guildId);
    const sinceDate = lastReset?.reset_at ? new Date(lastReset.reset_at) : null;

    const total = await getReportCount(interaction.guildId, sinceDate);
    const rows = await listReports(interaction.guildId, sinceDate, limit);

    // récupère les noms des reporters (en batch simple)
    const uniqueReporterIds = [...new Set(rows.map(r => String(r.reporter_user_id)).filter(Boolean))];

    const reporterNameMap = new Map();
    await Promise.allSettled(
      uniqueReporterIds.map(async (id) => {
        try {
          const u = await interaction.client.users.fetch(id);
          reporterNameMap.set(id, u?.username || `<@${id}>`);
        } catch {
          reporterNameMap.set(id, `<@${id}>`);
        }
      })
    );

    const header = lastReset?.reset_at
      ? `Stats depuis le dernier reset : <t:${Math.floor(new Date(lastReset.reset_at).getTime() / 1000)}:F>`
      : "Aucun reset enregistré : stats depuis le début.";

    const embed = new EmbedBuilder()
      .setTitle("📋 Rapports de jugement (semaine)")
      .setDescription(`${header}\n\n**Total période : ${total}** • **Affichés : ${rows.length}/${limit}**`)
      .setColor(0x2b2d31);

    if (!rows.length) {
      embed.addFields({ name: "Field 1", value: "_Aucun rapport sur la période._" });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const lines = rows.map((r) => {
      const ts = r.date_jugement_unix
        ? Number(r.date_jugement_unix)
        : Math.floor(new Date(r.created_at).getTime() / 1000);

      const datePart = `*<t:${ts}:d>*`;
      const ident = `*${safe(r.nom)} ${safe(r.prenom)}*`;
      const juge = `*${safe(r.judge_name)}*`;
      const proc = `*${safe(r.procureur)}*`;
      const by = reporterNameMap.get(String(r.reporter_user_id)) || `<@${r.reporter_user_id}>`;

      return `${datePart} - ${ident} - ${juge} - ${proc} - Enregistré par *${by}*`;
    });

    const chunks = chunkLinesIntoFields(lines);

    chunks.forEach((value, idx) => {
      embed.addFields({
        name: `Field ${idx + 1}`,
        value,
      });
    });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};