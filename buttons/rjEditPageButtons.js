// buttons/rjEditPageButtons.js
// Pagination du panneau /rapport-modifier

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require("discord.js");

const { listReports, getReportCount } = require("../services/rapportJugement.db");
const { mentionify } = require("../src/utils/rapportJugementFormat");
const { getSession } = require("../src/utils/rjReportSessions");

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

function buildEditComponents(ownerId, session, page, pages, limit, rows) {
  const rowNav = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`rjeditpage:${ownerId}:${session}:prev:${page}:${pages}:${limit}`)
      .setLabel("⬅️")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId(`rjeditpage:${ownerId}:${session}:next:${page}:${pages}:${limit}`)
      .setLabel("➡️")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page >= pages),
    new ButtonBuilder()
      .setCustomId(`rjeditnewsearch:${ownerId}:${session}:${limit}`)
      .setLabel("🔎 Nouvelle recherche")
      .setStyle(ButtonStyle.Secondary)
  );

  const options = (rows || []).slice(0, 10).map((r, idx) => {
    const ts = r.date_jugement_unix
      ? Number(r.date_jugement_unix)
      : Math.floor(new Date(r.created_at).getTime() / 1000);
    const suspect = `${safe(r.nom)} ${safe(r.prenom)}`.trim();
    const label = `#${idx + 1} • ${suspect}`.slice(0, 100);
    const description = `t:${ts}:d • Juge: ${cut(mentionify(r.judge_name), 40)}`.slice(0, 100);
    return { label, description, value: String(r.id) };
  });

  const rowPick = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`rjeditpick:${ownerId}:${session}:${page}:${limit}`)
      .setPlaceholder("Choisir le rapport à modifier…")
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(options.length ? options : [{ label: "Aucun résultat", value: "none" }])
      .setDisabled(options.length === 0)
  );

  return [rowPick, rowNav];
}

function buildEmbed(search, total, cappedTotal, page, pages, rows, offset) {
  const embed = new EmbedBuilder()
    .setTitle("✏️ Modifier un rapport de jugement")
    .setDescription(
      `🔎 Filtre : **${safe(search, "/")}**` +
        `\n**Total : ${total}** • **Parcourables : ${cappedTotal}** • **Page : ${page}/${pages}**` +
        `\nSélectionne un rapport dans le menu ci-dessous.`
    )
    .setColor(0x2b2d31);

  if (!rows.length) {
    embed.addFields({ name: "Rapports", value: "_Aucun rapport._" });
    return embed;
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

    embed.addFields({ name: `#${offset + idx + 1} • <t:${ts}:d> • ${suspect}`, value });
  });

  return embed;
}

module.exports = {
  idPrefix: "rjeditpage:",

  async execute(interaction) {
    // rjeditpage:<ownerId>:<session>:<action>:<page>:<pages>:<limit>
    const parts = String(interaction.customId || "").split(":");
    const ownerId = parts[1];
    const session = parts[2];
    const action = parts[3];
    const currentPageRaw = Number(parts[4]);
    const pagesRaw = Number(parts[5]);
    const limitRaw = Number(parts[6]);

    if (!ownerId || interaction.user.id !== ownerId) {
      return interaction.reply({ content: "❌ Ce panneau ne t'appartient pas.", ephemeral: true });
    }

    const sess = getSession(interaction.guildId, ownerId, session);
    if (!sess || !sess.search) {
      return interaction.reply({ content: "⏱️ Session expirée. Relance /rapport-modifier.", ephemeral: true });
    }

    const search = sess.search;
    const perPage = 10;
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 200;

    const total = await getReportCount(interaction.guildId, null, search);
    const cappedTotal = Math.min(total, limit);
    const pages = Math.max(1, Math.ceil(cappedTotal / perPage));

    let currentPage = Number.isFinite(currentPageRaw) ? currentPageRaw : 1;
    currentPage = Math.min(Math.max(currentPage, 1), pages);

    let page = currentPage;
    if (action === "prev") page = Math.max(1, currentPage - 1);
    if (action === "next") page = Math.min(pages, currentPage + 1);
    // compat si jamais
    if (Number.isFinite(Number(action))) page = Number(action);
    page = Math.min(Math.max(page, 1), pages);

    const offset = (page - 1) * perPage;
    const fetchLimit = Math.min(perPage, Math.max(0, cappedTotal - offset));
    const rows = fetchLimit > 0 ? await listReports(interaction.guildId, null, fetchLimit, offset, search) : [];

    const embed = buildEmbed(search, total, cappedTotal, page, pages, rows, offset);
    const components = buildEditComponents(ownerId, session, page, pages, limit, rows);

    return interaction.update({ embeds: [embed], components });
  },
};
