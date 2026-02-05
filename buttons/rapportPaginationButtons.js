// buttons/rapportPaginationButtons.js
// Pagination pour /rapport-semaine et /rapport-alltime

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");

const { getLastReset, listReports, getReportCount } = require("../services/rapportJugement.db");
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

// Discord limite un embed à 6000 caractères.
// Avec 10 rapports/page, on tronque fort pour éviter MAX_EMBED_SIZE_EXCEEDED.
function clampLen(str, max = 420) {
  const s = String(str ?? "");
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

function yn(v) {
  return v ? "Oui" : "Non";
}

function buildComponents(mode, ownerId, session, page, pages, limit, hasFilter) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      // IMPORTANT: custom_id must be unique for every component in a message (even if target page is the same)
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
  idPrefix: "rjrep:",

  async execute(interaction) {
    const parts = String(interaction.customId || "").split(":");
    // rjrep:<mode>:<ownerId>:<session>:<action>:<currentPage>:<pages>:<limit>
    const mode = parts[1];
    const ownerId = parts[2];
    const session = parts[3];
    const action = parts[4];
    const currentPageRaw = Number(parts[5]);
    const pagesRaw = Number(parts[6]);
    const limitRaw = Number(parts[7]);

    if (!ownerId || interaction.user.id !== ownerId) {
      return interaction.reply({ content: "❌ Ce panneau ne t'appartient pas.", flags: 64 });
    }
    if (!session) {
      return interaction.reply({ content: "❌ Session de pagination invalide.", flags: 64 });
    }

    const sess = getSession(interaction.guildId, ownerId, session);
    if (!sess) {
      return interaction.reply({ content: "⏱️ Session expirée (15 min). Relance la commande.", flags: 64 });
    }

    const perPage = 10;
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 30;

    let sinceDate = null;
    let header = "Historique complet.";
    let title = "📚 Rapports de jugement — Alltime";

    if (mode === "week") {
      const lastReset = await getLastReset(interaction.guildId);
      sinceDate = lastReset?.reset_at ? new Date(lastReset.reset_at) : null;

      header = lastReset?.reset_at
        ? `Depuis le reset : <t:${Math.floor(new Date(lastReset.reset_at).getTime() / 1000)}:F>`
        : "Aucun reset : depuis le début.";
      title = "🧾 Rapports de jugement — Semaine";
    } else if (mode !== "all") {
      return interaction.reply({ content: "❌ Pagination inconnue.", flags: 64 });
    }

    const search = sess.search || null;

    const total = await getReportCount(interaction.guildId, sinceDate, search);
    const cappedTotal = Math.min(total, limit);
    const pages = Math.max(1, Math.ceil(cappedTotal / perPage));

    let currentPage = Number.isFinite(currentPageRaw) ? currentPageRaw : 1;
    currentPage = Math.min(Math.max(currentPage, 1), pages);

    // Calcule la page cible selon l'action (et garde un custom_id unique même si la page cible est identique)
    let page = currentPage;
    switch (action) {
      case "first":
        page = 1;
        break;
      case "prev":
        page = Math.max(1, currentPage - 1);
        break;
      case "next":
        page = Math.min(pages, currentPage + 1);
        break;
      case "last":
        page = pages;
        break;
      default:
        // compat: si jamais un ancien custom_id envoie un numéro
        if (Number.isFinite(Number(action))) page = Number(action);
        break;
    }
    page = Math.min(Math.max(page, 1), pages);

    const offset = (page - 1) * perPage;
    const fetchLimit = Math.min(perPage, Math.max(0, cappedTotal - offset));
    const rows = fetchLimit > 0 ? await listReports(interaction.guildId, sinceDate, fetchLimit, offset, search) : [];

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(
        `${header}` +
          `${search ? `\n🔎 Filtre : **${safe(search, "/")}**` : ""}` +
          `\n**Total : ${total}** • **Parcourables : ${cappedTotal}** • **Page : ${page}/${pages}**`
      )
      .setColor(0x2b2d31);

    if (!rows.length) {
      embed.addFields({ name: "Rapports", value: "_Aucun rapport._" });
      return interaction.update({
        embeds: [embed],
        components: buildComponents(mode, ownerId, session, page, pages, limit, !!search),
      });
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

    return interaction.update({
      embeds: [embed],
      components: buildComponents(mode, ownerId, session, page, pages, limit, !!search),
    });
  },
};
