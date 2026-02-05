// modals/rjEditValueModal.js
// Modal submit : applique la modification sur un rapport puis refresh la liste.

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require("discord.js");

const { getSession } = require("../src/utils/rjReportSessions");
const { auditLog } = require("../src/utils/auditLog");
const { listReports, getReportCount, updateReportById } = require("../services/rapportJugement.db");
const { mentionify } = require("../src/utils/rapportJugementFormat");

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

function parseDateToUnixSeconds(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;

  // unix seconds
  if (/^\d{9,11}$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n) && n > 0) return n;
  }

  // dd/mm/yyyy
  let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = Number(m[3]);
    const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
    if (!Number.isNaN(dt.getTime())) return Math.floor(dt.getTime() / 1000);
  }

  // yyyy-mm-dd
  m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
    if (!Number.isNaN(dt.getTime())) return Math.floor(dt.getTime() / 1000);
  }

  return null;
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

const FIELD_LABELS = {
  date_jugement_unix: "Date du jugement",
  judge_name: "Juge",
  procureur: "Procureur",
  avocat: "Avocat",
  peine: "Peine",
  amende: "Amende",
  tig: "TIG",
  tig_entreprise: "Entreprise TIG",
  observation: "Observation",
};

module.exports = {
  idPrefix: "rjeditvalueModal:",

  async execute(interaction) {
    // rjeditvalueModal:<ownerId>:<session>:<reportId>:<fieldKey>:<page>:<limit>
    const parts = String(interaction.customId || "").split(":");
    const ownerId = parts[1];
    const session = parts[2];
    const reportId = parts[3];
    const fieldKey = parts[4];
    const page = Number(parts[5] || 1);
    const limit = Number(parts[6] || 200);

    if (!ownerId || interaction.user.id !== ownerId) {
      return interaction.reply({ content: "❌ Ce panneau ne t'appartient pas.", ephemeral: true });
    }

    const sess = getSession(interaction.guildId, ownerId, session);
    if (!sess || !sess.search) {
      return interaction.reply({ content: "⏱️ Session expirée. Relance /rapport-modifier.", ephemeral: true });
    }

    const raw = (interaction.fields.getTextInputValue("value") || "").trim();
    if (!raw) {
      return interaction.reply({ content: "❌ Valeur vide.", ephemeral: true });
    }

    const patch = {};
    if (fieldKey === "date_jugement_unix") {
      const unix = parseDateToUnixSeconds(raw);
      if (!unix) {
        return interaction.reply({
          content: "❌ Date invalide. Utilise JJ/MM/AAAA, AAAA-MM-JJ, ou un unix timestamp.",
          ephemeral: true,
        });
      }
      patch.date_jugement_unix = unix;
    } else if (fieldKey === "tig") {
      const s = raw.toLowerCase();
      if (!["oui", "non", "1", "0", "true", "false"].includes(s)) {
        return interaction.reply({ content: "❌ TIG: tape Oui ou Non.", ephemeral: true });
      }
      patch.tig = s === "oui" || s === "1" || s === "true";
    } else {
      patch[fieldKey] = raw;
    }

    const ok = await updateReportById(interaction.guildId, reportId, patch);

    if (ok) {
      await auditLog(interaction.client, interaction.guildId, {
        module: "RAPPORTS",
        action: "UPDATE",
        level: "INFO",
        userId: interaction.user.id,
        sourceChannelId: interaction.channelId,
        message: `Rapport #${reportId} modifié (${fieldKey}).`,
        meta: { reportId, field: fieldKey, value: raw },
      });
    }

    // Refresh du panneau (même page) si possible
    try {
      const search = sess.search;
      const perPage = 10;
      const total = await getReportCount(interaction.guildId, null, search);
      const cappedTotal = Math.min(total, limit);
      const pages = Math.max(1, Math.ceil(cappedTotal / perPage));
      const safePage = Math.min(Math.max(page, 1), pages);
      const offset = (safePage - 1) * perPage;
      const fetchLimit = Math.min(perPage, Math.max(0, cappedTotal - offset));
      const rows = fetchLimit > 0 ? await listReports(interaction.guildId, null, fetchLimit, offset, search) : [];

      const embed = buildEmbed(search, total, cappedTotal, safePage, pages, rows, offset);
      const components = buildEditComponents(ownerId, session, safePage, pages, limit, rows);

      if (interaction.message && interaction.message.edit) {
        await interaction.message.edit({ embeds: [embed], components }).catch(() => null);
      }
    } catch (_) {
      // ignore
    }

    const label = FIELD_LABELS[fieldKey] || fieldKey;
    return interaction.reply({
      content: `✅ Rapport **#${reportId}** mis à jour : **${label}**.`,
      ephemeral: true,
    });
  },
};
