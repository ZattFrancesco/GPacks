// src/utils/judgementPlanningView.js

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { listEntriesForWeek } = require("../../services/judgementPlanning.db");

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
  // mysqlDate: YYYY-MM-DD
  return new Date(`${mysqlDate}T00:00:00`);
}

function toLocalFromMysqlDatetime(mysqlDt) {
  // mysqlDt can be Date or string depending mysql2 config; handle both
  if (mysqlDt instanceof Date) return mysqlDt;
  // 'YYYY-MM-DD HH:MM:SS'
  const s = String(mysqlDt).replace(" ", "T");
  return new Date(s);
}

function ticketMarkdown(url) {
  const u = String(url || "").trim();
  if (!u) return "";
  return `[Ticket](${u})`;
}

function buildComponents() {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("jplan:add:start").setLabel("➕ Ajouter").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("jplan:edit:start").setLabel("✏️ Modifier").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("jplan:del:start").setLabel("🗑️ Supprimer").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("jplan:week:prev").setLabel("⬅️").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("jplan:week:next").setLabel("➡️").setStyle(ButtonStyle.Primary)
  );
  return [row];
}

async function buildWeeklyPlanningMessage({ guildId, weekMondayDate }) {
  const monday = toLocalDateFromMysqlDate(weekMondayDate);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);

  const entries = await listEntriesForWeek(guildId, weekMondayDate);

  // group by day index 0..6
  const byDay = Array.from({ length: 7 }, () => []);
  for (const e of entries) {
    const dt = toLocalFromMysqlDatetime(e.judgement_datetime);
    const dayIdx = Math.floor((dt - monday) / (24 * 3600 * 1000));
    if (dayIdx >= 0 && dayIdx < 7) byDay[dayIdx].push({ ...e, _dt: dt });
  }

  const embed = new EmbedBuilder()
    .setTitle(`📅 Planning des jugements — Semaine du ${formatFRDate(monday)} → ${formatFRDate(sunday)}`)
    .setDescription("Utilise les boutons dessous pour **ajouter / modifier / supprimer**. Navigation: ⬅️ ➡️")
    .setColor(0x2b2d31);

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(monday);
    dayDate.setDate(dayDate.getDate() + i);

    const title = `${DAYS[i]} ${formatFRDate(dayDate)}`;
    const list = byDay[i];

    if (!list.length) {
      embed.addFields({ name: title, value: "— Aucun jugement —", inline: false });
      continue;
    }

    const lines = list.map((e) => {
      const hh = pad2(e._dt.getHours());
      const mm = pad2(e._dt.getMinutes());
      const who = `**${e.accused_lastname} ${e.accused_firstname}**`;
      const aid = `ID: \`${e.accused_id}\``;
      const t = ticketMarkdown(e.ticket_url);
      return `\`${hh}:${mm}\` • ${who} (${aid}) • ${t}`;
    });

    // Discord field limit 1024 chars, be safe
    let value = lines.join("\n");
    if (value.length > 1000) {
      // crude cut
      const cut = [];
      let acc = 0;
      for (const line of lines) {
        if (acc + line.length + 1 > 980) break;
        cut.push(line);
        acc += line.length + 1;
      }
      const rest = lines.length - cut.length;
      value = cut.join("\n") + (rest > 0 ? `\n… +${rest} autre(s)` : "");
    }

    embed.addFields({ name: title, value, inline: false });
  }

  embed.setFooter({ text: "Planning DOJHelper — 1 entrée = 1 créneau" });

  const components = buildComponents();
  return { embed, components };
}

module.exports = { buildWeeklyPlanningMessage, toLocalDateFromMysqlDate };
