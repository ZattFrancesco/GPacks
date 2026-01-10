// src/utils/internalPlanningView.js

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { listEntriesForWeek, getWeekMondayLocal, toMysqlDate } = require("../../services/internalPlanning.db");

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function pad2(n) {
  return String(Number(n)).padStart(2, "0");
}

function formatFRDate(d) {
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function toLocalDateFromMysqlDate(mysqlDate) {
  // mysqlDate: "YYYY-MM-DD" (ou Date)
  if (mysqlDate instanceof Date) {
    const d = new Date(mysqlDate);
    if (Number.isNaN(d.getTime())) return getWeekMondayLocal();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const s = String(mysqlDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return getWeekMondayLocal();
  const [y, m, d] = s.split("-").map(Number);
  const out = new Date(y, (m || 1) - 1, d || 1);
  out.setHours(0, 0, 0, 0);
  return out;
}

function toLocalFromMysqlDatetime(mysqlDatetime) {
  if (mysqlDatetime instanceof Date) {
    const d = new Date(mysqlDatetime);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }
  const s = String(mysqlDatetime || "").trim();
  if (!s) return null;
  // "YYYY-MM-DD HH:mm:ss"
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [_, yy, mm, dd, hh, mi, ss] = m;
  return new Date(Number(yy), Number(mm) - 1, Number(dd), Number(hh), Number(mi), Number(ss));
}

function typeLabel(t) {
  switch (String(t || "").toUpperCase()) {
    case "TRAINING":
      return "🛡️ Entraînement sécu";
    case "APPOINTMENT":
      return "📍 Rendez-vous";
    case "MEETING":
      return "👥 Réunion";
    case "OTHER":
      return "📝 Autre";
    default:
      return "📌 Évènement";
  }
}

function buildLine(e) {
  const t = String(e.type || "").toUpperCase();
  if (t === "TRAINING") return `🛡️ **Entraînement sécu**`;
  if (t === "APPOINTMENT") {
    const name = [e.person_lastname, e.person_firstname].filter(Boolean).join(" ").trim();
    const who = (e.concerned_user_ids || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 8)
      .map((id) => `<@${id}>`)
      .join(" ");
    return `📍 **Rendez-vous**${name ? ` — ${name}` : ""}${who ? ` • ${who}` : ""}`;
  }
  if (t === "MEETING") {
    const motif = String(e.meeting_motif || "").trim();
    const roles = (e.concerned_role_ids || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 8)
      .map((id) => `<@&${id}>`)
      .join(" ");
    return `👥 **Réunion**${motif ? ` — ${motif}` : ""}${roles ? ` • ${roles}` : ""}`;
  }
  const reason = String(e.other_reason || "").trim();
  return `📝 **Autre**${reason ? ` — ${reason}` : ""}`;
}

function buildComponents(weekMondayStr) {
  const w = String(weekMondayStr || "").trim();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`iplan:nav:prev:${w}`).setLabel("⬅️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`iplan:nav:next:${w}`).setLabel("➡️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`iplan:add:start:${w}`).setLabel("➕ Ajouter").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`iplan:edit:start:${w}`).setLabel("✏️ Modifier").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`iplan:del:start:${w}`).setLabel("🗑️ Supprimer").setStyle(ButtonStyle.Danger)
  );

  return [row];
}

async function buildWeeklyPlanningMessage({ guildId, weekMondayDate }) {
    let safeWeek;
  if (weekMondayDate instanceof Date) {
    // mysql2 peut renvoyer les DATE en objet Date -> on le re-formate en YYYY-MM-DD
    safeWeek = toMysqlDate(weekMondayDate);
  } else {
    const t = String(weekMondayDate || "").trim();
    safeWeek = /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : toMysqlDate(getWeekMondayLocal(new Date()));
  }
  const monday = toLocalDateFromMysqlDate(safeWeek);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);

  const entries = await listEntriesForWeek(guildId, safeWeek);

  const byDay = Array.from({ length: 7 }, () => []);
  const others = [];

  for (const e of entries) {
    if (!e.event_datetime) {
      others.push(e);
      continue;
    }
    const dt = toLocalFromMysqlDatetime(e.event_datetime);
    if (!dt) {
      others.push(e);
      continue;
    }
    const idx = Math.floor((dt.setHours(0,0,0,0) - monday.getTime()) / (24 * 3600 * 1000));
    const idxSafe = idx >= 0 && idx <= 6 ? idx : 0;
    byDay[idxSafe].push({ dt: toLocalFromMysqlDatetime(e.event_datetime), e });
  }

  // tri par heure
  for (const dayList of byDay) dayList.sort((a, b) => (a.dt?.getTime() || 0) - (b.dt?.getTime() || 0));

  const embed = new EmbedBuilder()
    .setTitle(`📅 Planning interne — Semaine du ${formatFRDate(monday)} → ${formatFRDate(sunday)}`)
    .setDescription("Utilise les boutons dessous pour **ajouter / modifier / supprimer**. Navigation: ⬅️ ➡️")
    .setColor(0x2b2d31);

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(monday);
    dayDate.setDate(dayDate.getDate() + i);

    const title = `${DAYS[i]} ${formatFRDate(dayDate)}`;
    const list = byDay[i];

    if (!list.length) {
      embed.addFields({ name: title, value: "—", inline: false });
      continue;
    }

    const lines = list.map(({ dt, e }) => {
      const hh = dt ? pad2(dt.getHours()) : "??";
      return `• **${hh}h** — ${buildLine(e)}`;
    });

    let value = lines.join("\n");
    if (value.length > 1024) {
      const cut = [];
      let total = 0;
      for (const line of lines) {
        if (total + line.length + 1 > 950) break;
        cut.push(line);
        total += line.length + 1;
      }
      const rest = lines.length - cut.length;
      value = cut.join("\n") + (rest > 0 ? `\n… +${rest} autre(s)` : "");
    }

    embed.addFields({ name: title, value, inline: false });
  }

  if (others.length) {
    const lines = others.slice(0, 20).map((e) => `• ${buildLine(e)}`);
    embed.addFields({
      name: "📝 Autres (sans date)",
      value: lines.join("\n") + (others.length > 20 ? `\n… +${others.length - 20} autre(s)` : ""),
      inline: false,
    });
  }

  embed.setFooter({ text: "Planning DOJHelper — interne" });

  const components = buildComponents(safeWeek);
  return { embed, components };
}

module.exports = { buildWeeklyPlanningMessage, toLocalDateFromMysqlDate };
