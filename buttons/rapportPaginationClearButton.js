// buttons/rapportPaginationClearButton.js
// Bouton "Reset" : enlève le filtre de recherche (nom) et revient page 1

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");

const { getLastReset, listReports, getReportCount } = require("../services/rapportJugement.db");
const { mentionify } = require("../src/utils/rapportJugementFormat");
const { getSession, updateSession } = require("../src/utils/rjReportSessions");

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
  idPrefix: "rjrepclear:",

  async execute(interaction) {
    // rjrepclear:<mode>:<ownerId>:<session>:<limit>
    const parts = String(interaction.customId || "").split(":");
    const mode = parts[1];
    const ownerId = parts[2];
    const session = parts[3];
    const limitRaw = Number(parts[4]);

    if (!ownerId || interaction.user.id !== ownerId) {
      return interaction.reply({ content: "❌ Ce panneau ne t'appartient pas.", ephemeral: true });
    }
    if (mode !== "week" && mode !== "all") {
      return interaction.reply({ content: "❌ Pagination inconnue.", ephemeral: true });
    }

    const sess = getSession(interaction.guildId, ownerId, session);
    if (!sess) {
      return interaction.reply({ content: "⏱️ Session expirée (15 min). Relance la commande.", ephemeral: true });
    }

    // On enlève le filtre
    updateSession(interaction.guildId, ownerId, session, { search: null });

    const perPage = 10;
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 30;
    const page = 1;

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
    }

    const total = await getReportCount(interaction.guildId, sinceDate, null);
    const cappedTotal = Math.min(total, limit);
    const pages = Math.max(1, Math.ceil(cappedTotal / perPage));

    const offset = 0;
    const fetchLimit = Math.min(perPage, Math.max(0, cappedTotal));
    const rows = fetchLimit > 0 ? await listReports(interaction.guildId, sinceDate, fetchLimit, offset, null) : [];

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(`${header}\n**Total : ${total}** • **Parcourables : ${cappedTotal}** • **Page : 1/${pages}**`)
      .setColor(0x2b2d31);

    if (!rows.length) {
      embed.addFields({ name: "Rapports", value: "_Aucun rapport._" });
      return interaction.update({
        embeds: [embed],
        components: buildComponents(mode, ownerId, session, 1, pages, limit, false),
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
      components: buildComponents(mode, ownerId, session, 1, pages, limit, false),
    });
  },
};
