// commands/utility/rapport-semaine.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getLastReset, listReports, getReportCount } = require("../../services/rapportJugement.db");
const { mentionify } = require("../../src/utils/rapportJugementFormat");

function safe(v, fallback = "/") {
  const t = (v ?? "").toString().trim();
  return t.length ? t : fallback;
}

function cut(str, max = 120) {
  const s = safe(str, "/");
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

function chunkBlocksIntoFields(blocks, maxLen = 950) {
  const fields = [];
  let current = "";

  for (const b of blocks) {
    const next = current ? current + "\n\n" + b : b;
    if (next.length > maxLen) {
      if (current) fields.push(current);
      current = b;
    } else {
      current = next;
    }
  }
  if (current) fields.push(current);
  return fields;
}

function yn(v) {
  return v ? "Oui" : "Non";
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rapport-semaine")
    .setDescription("Liste détaillée des rapports depuis le dernier reset (format paie)")
    .addIntegerOption((opt) =>
      opt
        .setName("limit")
        .setDescription("Nombre max de rapports (défaut 30, max 120)")
        .setRequired(false)
    ),

  async execute(interaction) {
    const limit = Math.min(Math.max(interaction.options.getInteger("limit") ?? 30, 1), 120);

    const lastReset = await getLastReset(interaction.guildId);
    const sinceDate = lastReset?.reset_at ? new Date(lastReset.reset_at) : null;

    const total = await getReportCount(interaction.guildId, sinceDate);
    const rows = await listReports(interaction.guildId, sinceDate, limit);

    const header = lastReset?.reset_at
      ? `Depuis le reset : <t:${Math.floor(new Date(lastReset.reset_at).getTime() / 1000)}:F>`
      : "Aucun reset : depuis le début.";

    const embed = new EmbedBuilder()
      .setTitle("🧾 Rapports de jugement — Paie semaine")
      .setDescription(`${header}\n**Total période : ${total}** • **Affichés : ${rows.length}/${limit}**`)
      .setColor(0x2b2d31);

    if (!rows.length) {
      embed.addFields({ name: "Rapports", value: "_Aucun rapport sur la période._" });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const blocks = rows.map((r) => {
      const ts = r.date_jugement_unix
        ? Number(r.date_jugement_unix)
        : Math.floor(new Date(r.created_at).getTime() / 1000);

      const suspect = `${safe(r.nom)} ${safe(r.prenom)}`;

      // ✅ mentions si possible
      const juge = mentionify(r.judge_name);
      const proc = mentionify(r.procureur);
      const avocat = mentionify(r.avocat);

      const peine = cut(r.peine, 80);
      const amende = cut(r.amende, 40);

      const tigOui = Number(r.tig) === 1;
      const tigEnt = tigOui ? safe(r.tig_entreprise) : "/";

      const obs = cut(r.observation, 140);

      // ✅ Enregistré par = mention direct
      const by = r.reporter_user_id ? `<@${r.reporter_user_id}>` : "/";

      return [
        `🗓️ **Date**: <t:${ts}:d> • 👤 **Suspect**: **${suspect}**`,
        `⚖️ **Juge**: ${juge} • 🧑‍⚖️ **Proc**: ${proc} • 🧑‍💼 **Avocat**: ${avocat}`,
        `💰 **Peine**: ${peine} • **Amende**: ${amende} • **TIG**: ${yn(tigOui)}${tigOui ? ` (**${tigEnt}**)` : ""}`,
        `📝 **Obs**: ${obs}`,
        `✍️ **Enregistré par**: ${by}`,
      ].join("\n");
    });

    const fields = chunkBlocksIntoFields(blocks);

    fields.forEach((value, idx) => {
      embed.addFields({
        name: `Rapports (${idx + 1}/${fields.length})`,
        value,
      });
    });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};