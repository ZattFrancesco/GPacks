// commands/utility/rapport-semaine.js
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
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

// Discord limite un embed à 6000 caractères.
// Avec 10 rapports/page, on doit TRONQUER fort pour éviter l'erreur MAX_EMBED_SIZE_EXCEEDED.
function clampLen(str, max = 420) {
  const s = String(str ?? "");
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
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
    const perPage = 10;
    const limit = Math.min(Math.max(interaction.options.getInteger("limit") ?? 30, 1), 500);
    const page = 1;

    const lastReset = await getLastReset(interaction.guildId);
    const sinceDate = lastReset?.reset_at ? new Date(lastReset.reset_at) : null;

    const total = await getReportCount(interaction.guildId, sinceDate);
    const cappedTotal = Math.min(total, limit);
    const pages = Math.max(1, Math.ceil(cappedTotal / perPage));

    const offset = (page - 1) * perPage;
    const fetchLimit = Math.min(perPage, Math.max(0, cappedTotal - offset));
    const rows = fetchLimit > 0 ? await listReports(interaction.guildId, sinceDate, fetchLimit, offset) : [];

    const header = lastReset?.reset_at
      ? `Depuis le reset : <t:${Math.floor(new Date(lastReset.reset_at).getTime() / 1000)}:F>`
      : "Aucun reset : depuis le début.";

    const embed = new EmbedBuilder()
      .setTitle("🧾 Rapports de jugement — Semaine")
      .setDescription(
        `${header}\n**Total période : ${total}** • **Parcourables : ${cappedTotal}** • **Page : ${page}/${pages}**`
      )
      .setColor(0x2b2d31);

    if (!rows.length) {
      embed.addFields({ name: "Rapports", value: "_Aucun rapport sur la période._" });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    rows.forEach((r, idx) => {
      const ts = r.date_jugement_unix
        ? Number(r.date_jugement_unix)
        : Math.floor(new Date(r.created_at).getTime() / 1000);

      const suspect = `${safe(r.nom)} ${safe(r.prenom)}`;

      const juge = mentionify(r.judge_name);
      const proc = mentionify(r.procureur);
      const avocat = mentionify(r.avocat);

      const peine = cut(r.peine, 80);
      const amende = cut(r.amende, 40);

      const tigOui = Number(r.tig) === 1;
      const tigEnt = tigOui ? safe(r.tig_entreprise) : "/";

      // "observation" est souvent le champ le plus long : on le coupe plus fort.
      const obs = cut(r.observation, 110);
      const by = r.reporter_user_id ? `<@${r.reporter_user_id}>` : "/";

      const value = clampLen(
        [
          `⚖️ **Juge**: ${juge} • 🧑‍⚖️ **Proc**: ${proc} • 🧑‍💼 **Avocat**: ${avocat}`,
          `💰 **Peine**: ${peine} • **Amende**: ${amende} • **TIG**: ${yn(tigOui)}${tigOui ? ` (**${tigEnt}**)` : ""}`,
          `📝 **Obs**: ${obs}`,
          `✍️ **Enregistré par**: ${by}`,
        ].join("\n")
      );

      embed.addFields({
        name: `#${offset + idx + 1} • <t:${ts}:d> • ${suspect}`,
        value,
      });
    });

    const ownerId = interaction.user.id;
    // "session" rend les custom_id uniques et évite les erreurs COMPONENT_CUSTOM_ID_DUPLICATED
    // même si plusieurs panneaux existent en même temps.
    const session = interaction.id;
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`rjrep:week:${ownerId}:${session}:1:${limit}`)
        .setLabel("⏮️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 1),
      new ButtonBuilder()
        .setCustomId(`rjrep:week:${ownerId}:${session}:${page - 1}:${limit}`)
        .setLabel("⬅️")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page <= 1),
      new ButtonBuilder()
        .setCustomId(`rjrep:week:${ownerId}:${session}:${page + 1}:${limit}`)
        .setLabel("➡️")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page >= pages),
      new ButtonBuilder()
        .setCustomId(`rjrep:week:${ownerId}:${session}:${pages}:${limit}`)
        .setLabel("⏭️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= pages),
      new ButtonBuilder()
        .setCustomId(`rjrepgo:week:${ownerId}:${session}:${pages}:${limit}`)
        .setLabel("🔎 Aller")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pages <= 1)
    );

    return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  },
};