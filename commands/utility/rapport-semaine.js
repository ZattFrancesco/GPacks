// commands/utility/rapport-semaine.js
// Version paginée + recherche par nom (évite les embeds trop gros)

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const { getLastReset, listReports, getReportCount } = require("../../services/rapportJugement.db");
const { mentionify } = require("../../src/utils/rapportJugementFormat");
const { createSession } = require("../../src/utils/rjReportSessions");

function safe(v, fallback = "/") {
  const t = (v ?? "").toString().trim();
  return t.length ? t : fallback;
}

function cut(str, max = 120) {
  const s = safe(str, "/");
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

function clampLen(str, max = 420) {
  const s = String(str ?? "");
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

function yn(v) {
  return v ? "Oui" : "Non";
}

function buildComponents(mode, ownerId, session, page, pages, limit, hasFilter) {
  // IMPORTANT : les custom_id doivent être uniques, même si 2 boutons mènent à la même page.
  // On encode donc une action (first/prev/next/last) + l'état (page/pages) dans le custom_id.

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`rjrep:${mode}:${ownerId}:${session}:first:${page}:${pages}:${limit}`)
      .setLabel("⏮️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId(`rjrep:${mode}:${ownerId}:${session}:prev:${page}:${pages}:${limit}`)
      .setLabel("⬅️")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId(`rjrep:${mode}:${ownerId}:${session}:next:${page}:${pages}:${limit}`)
      .setLabel("➡️")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page >= pages),
    new ButtonBuilder()
      .setCustomId(`rjrep:${mode}:${ownerId}:${session}:last:${page}:${pages}:${limit}`)
      .setLabel("⏭️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= pages),
    new ButtonBuilder()
      .setCustomId(`rjrepgo:${mode}:${ownerId}:${session}:${pages}:${limit}`)
      .setLabel("🔎 Aller")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pages <= 1)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`rjrepsearch:${mode}:${ownerId}:${session}:${limit}`)
      .setLabel("🔎 Nom")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`rjrepclear:${mode}:${ownerId}:${session}:${limit}`)
      .setLabel("♻️ Reset")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasFilter)
  );

  return [row1, row2];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rapport-semaine")
    .setDescription("Rapports depuis le dernier reset (paginés + recherche)")
    .addIntegerOption((opt) =>
      opt
        .setName("limit")
        .setDescription("Nombre max de rapports parcourables (défaut 200, max 500)")
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName("nom")
        .setDescription("Filtre: nom ou prénom du suspect (optionnel)")
        .setRequired(false)
    ),

  async execute(interaction) {
    const ownerId = interaction.user.id;
    const limit = Math.min(Math.max(interaction.options.getInteger("limit") ?? 200, 1), 500);
    const search = (interaction.options.getString("nom") || "").trim() || null;

    const lastReset = await getLastReset(interaction.guildId);
    const sinceDate = lastReset?.reset_at ? new Date(lastReset.reset_at) : null;

    const session = createSession(interaction.guildId, ownerId, { search });

    const perPage = 10;
    const total = await getReportCount(interaction.guildId, sinceDate, search);
    const cappedTotal = Math.min(total, limit);
    const pages = Math.max(1, Math.ceil(cappedTotal / perPage));
    const page = 1;

    const rows = cappedTotal > 0 ? await listReports(interaction.guildId, sinceDate, Math.min(perPage, cappedTotal), 0, search) : [];

    const header = lastReset?.reset_at
      ? `Depuis le reset : <t:${Math.floor(new Date(lastReset.reset_at).getTime() / 1000)}:F>`
      : "Aucun reset : depuis le début.";

    const embed = new EmbedBuilder()
      .setTitle("🧾 Rapports de jugement — Semaine")
      .setDescription(
        `${header}` +
          `${search ? `\n🔎 Filtre : **${safe(search, "/")}**` : ""}` +
          `\n**Total : ${total}** • **Parcourables : ${cappedTotal}** • **Page : ${page}/${pages}**`
      )
      .setColor(0x2b2d31);

    if (!rows.length) {
      embed.addFields({ name: "Rapports", value: "_Aucun rapport._" });
      return interaction.reply({ embeds: [embed], components: buildComponents("week", ownerId, session, page, pages, limit, !!search), flags: 64 });
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

      embed.addFields({ name: `#${idx + 1} • <t:${ts}:d> • ${suspect}`, value });
    });

    return interaction.reply({
      embeds: [embed],
      components: buildComponents("week", ownerId, session, page, pages, limit, !!search),
      flags: 64,
    });
  },
};
