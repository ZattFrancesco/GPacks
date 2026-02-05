// buttons/planningInterneButtons.js

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
} = require("discord.js");

const {
  ensureTables,
  getPlanningMessage,
  setWeekMonday,
  toMysqlDate,
  getWeekMondayLocal,
  listEntriesForWeek,
  getEntryById,
  deleteEntry,
} = require("../services/internalPlanning.db");

const { buildWeeklyPlanningMessage } = require("../src/utils/internalPlanningView");
const { clearDraft } = require("../src/utils/internalPlanningDrafts");

function pad2(n) {
  return String(Number(n)).padStart(2, "0");
}

function toLocalDateFromMysqlDate(mysqlDate) {
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

function addDaysMysql(week, deltaDays) {
  const d = toLocalDateFromMysqlDate(week);
  d.setDate(d.getDate() + deltaDays);
  return toMysqlDate(d);
}

function toLocalFromMysqlDatetime(mysqlDatetime) {
  if (mysqlDatetime instanceof Date) {
    const d = new Date(mysqlDatetime);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }
  const s = String(mysqlDatetime || "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [_, yy, mm, dd, hh, mi, ss] = m;
  return new Date(Number(yy), Number(mm) - 1, Number(dd), Number(hh), Number(mi), Number(ss));
}

function toFR(d) {
  if (!d) return "??/??/????";
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function typeLabel(t) {
  switch (String(t || "").toUpperCase()) {
    case "TRAINING":
      return "Entraînement sécu";
    case "APPOINTMENT":
      return "Rendez-vous";
    case "MEETING":
      return "Réunion";
    case "OTHER":
      return "Autre";
    default:
      return "Évènement";
  }
}

function shortEntryLabel(e) {
  const t = typeLabel(e.type);
  if (String(e.type || "").toUpperCase() === "APPOINTMENT") {
    const name = [e.person_lastname, e.person_firstname].filter(Boolean).join(" ").trim();
    return `${t}${name ? ` — ${name}` : ""}`;
  }
  if (String(e.type || "").toUpperCase() === "MEETING") {
    const motif = String(e.meeting_motif || "").trim();
    return `${t}${motif ? ` — ${motif}` : ""}`;
  }
  if (String(e.type || "").toUpperCase() === "OTHER") {
    const r = String(e.other_reason || "").trim();
    return `${t}${r ? ` — ${r}` : ""}`;
  }
  return t;
}

function buildTypeSelect(userId, week) {
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`iplanselect:add:type:${userId}:${week}`)
      .setPlaceholder("Choisis le type…")
      .addOptions(
        { label: "Entrainement Sécu", value: "TRAINING", emoji: "🛡️" },
        { label: "Rendez Vous", value: "APPOINTMENT", emoji: "📍" },
        { label: "Réunion", value: "MEETING", emoji: "👥" },
        { label: "Autre", value: "OTHER", emoji: "📝" }
      )
  );

  return row;
}

function buildAppointmentDateModal(week) {
  const modal = new ModalBuilder().setCustomId(`iplanmodal:add:APPOINTMENT_DATE:${week}`).setTitle("Rendez-vous — Date & heure");

  const year = new TextInputBuilder().setCustomId("year").setLabel("Année").setStyle(TextInputStyle.Short).setRequired(true);
  const month = new TextInputBuilder().setCustomId("month").setLabel("Mois (1-12)").setStyle(TextInputStyle.Short).setRequired(true);
  const day = new TextInputBuilder().setCustomId("day").setLabel("Jour (1-31)").setStyle(TextInputStyle.Short).setRequired(true);
  const hour = new TextInputBuilder().setCustomId("hour").setLabel("Heure (0-23)").setStyle(TextInputStyle.Short).setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(year),
    new ActionRowBuilder().addComponents(month),
    new ActionRowBuilder().addComponents(day),
    new ActionRowBuilder().addComponents(hour)
  );

  return modal;
}

function buildEditOpenModal(entry) {
  const type = String(entry.type || "").toUpperCase();
  if (type === "TRAINING") {
    const dt = toLocalFromMysqlDatetime(entry.event_datetime);
    const y = dt ? String(dt.getFullYear()) : "";
    const m = dt ? String(dt.getMonth() + 1) : "";
    const d = dt ? String(dt.getDate()) : "";
    const h = dt ? String(dt.getHours()) : "";

    const modal = new ModalBuilder()
      .setCustomId(`iplanmodal:edit:TRAINING:${entry.id_entry}`)
      .setTitle("Modifier — Entraînement sécu");

    const year = new TextInputBuilder().setCustomId("year").setLabel("Année").setStyle(TextInputStyle.Short).setRequired(true).setValue(y);
    const month = new TextInputBuilder().setCustomId("month").setLabel("Mois (1-12)").setStyle(TextInputStyle.Short).setRequired(true).setValue(m);
    const day = new TextInputBuilder().setCustomId("day").setLabel("Jour (1-31)").setStyle(TextInputStyle.Short).setRequired(true).setValue(d);
    const hour = new TextInputBuilder().setCustomId("hour").setLabel("Heure (0-23)").setStyle(TextInputStyle.Short).setRequired(true).setValue(h);

    modal.addComponents(
      new ActionRowBuilder().addComponents(year),
      new ActionRowBuilder().addComponents(month),
      new ActionRowBuilder().addComponents(day),
      new ActionRowBuilder().addComponents(hour)
    );
    return modal;
  }

    if (type === "APPOINTMENT") {
    const dt = toLocalFromMysqlDatetime(entry.event_datetime);
    const dateStr = dt ? `${pad2(dt.getDate())}/${pad2(dt.getMonth() + 1)}/${dt.getFullYear()}` : "";
    const h = dt ? String(dt.getHours()) : "";

    const modal = new ModalBuilder()
      .setCustomId(`iplanmodal:edit:APPOINTMENT:${entry.id_entry}`)
      .setTitle("Modifier — Rendez-vous");

    const date = new TextInputBuilder()
      .setCustomId("date")
      .setLabel("Date (JJ/MM/AAAA)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setValue(dateStr);

    const hour = new TextInputBuilder()
      .setCustomId("hour")
      .setLabel("Heure (0-23)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setValue(h);

    const lastname = new TextInputBuilder()
      .setCustomId("lastname")
      .setLabel("Nom (personne)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setValue(String(entry.person_lastname || ""));

    const firstname = new TextInputBuilder()
      .setCustomId("firstname")
      .setLabel("Prénom (personne)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setValue(String(entry.person_firstname || ""));

    modal.addComponents(
      new ActionRowBuilder().addComponents(date),
      new ActionRowBuilder().addComponents(hour),
      new ActionRowBuilder().addComponents(lastname),
      new ActionRowBuilder().addComponents(firstname)
    );
    return modal;
  }


  if (type === "MEETING") {
    const dt = toLocalFromMysqlDatetime(entry.event_datetime);
    const y = dt ? String(dt.getFullYear()) : "";
    const m = dt ? String(dt.getMonth() + 1) : "";
    const d = dt ? String(dt.getDate()) : "";
    const h = dt ? String(dt.getHours()) : "";

    const modal = new ModalBuilder()
      .setCustomId(`iplanmodal:edit:MEETING:${entry.id_entry}`)
      .setTitle("Modifier — Réunion");

    const year = new TextInputBuilder().setCustomId("year").setLabel("Année").setStyle(TextInputStyle.Short).setRequired(true).setValue(y);
    const month = new TextInputBuilder().setCustomId("month").setLabel("Mois (1-12)").setStyle(TextInputStyle.Short).setRequired(true).setValue(m);
    const day = new TextInputBuilder().setCustomId("day").setLabel("Jour (1-31)").setStyle(TextInputStyle.Short).setRequired(true).setValue(d);
    const hour = new TextInputBuilder().setCustomId("hour").setLabel("Heure (0-23)").setStyle(TextInputStyle.Short).setRequired(true).setValue(h);

    const motif = new TextInputBuilder()
      .setCustomId("motif")
      .setLabel("Motif")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setValue(String(entry.meeting_motif || ""));

    modal.addComponents(
      new ActionRowBuilder().addComponents(year),
      new ActionRowBuilder().addComponents(month),
      new ActionRowBuilder().addComponents(day),
      new ActionRowBuilder().addComponents(hour),
      new ActionRowBuilder().addComponents(motif)
    );
    return modal;
  }

  // OTHER
  const modal = new ModalBuilder()
    .setCustomId(`iplanmodal:edit:OTHER:${entry.id_entry}`)
    .setTitle("Modifier — Autre");

  const dt = toLocalFromMysqlDatetime(entry.event_datetime);
  const y = dt ? String(dt.getFullYear()) : "";
  const m = dt ? String(dt.getMonth() + 1) : "";
  const d = dt ? String(dt.getDate()) : "";
  const h = dt ? String(dt.getHours()) : "";

  const year = new TextInputBuilder().setCustomId("year").setLabel("Année").setStyle(TextInputStyle.Short).setRequired(true).setValue(y);
  const month = new TextInputBuilder().setCustomId("month").setLabel("Mois (1-12)").setStyle(TextInputStyle.Short).setRequired(true).setValue(m);
  const day = new TextInputBuilder().setCustomId("day").setLabel("Jour (1-31)").setStyle(TextInputStyle.Short).setRequired(true).setValue(d);
  const hour = new TextInputBuilder().setCustomId("hour").setLabel("Heure (0-23)").setStyle(TextInputStyle.Short).setRequired(true).setValue(h);

  const reason = new TextInputBuilder()
    .setCustomId("reason")
    .setLabel("Raison")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setValue(String(entry.other_reason || ""));

  modal.addComponents(
    new ActionRowBuilder().addComponents(year),
    new ActionRowBuilder().addComponents(month),
    new ActionRowBuilder().addComponents(day),
    new ActionRowBuilder().addComponents(hour),
    new ActionRowBuilder().addComponents(reason)
  );
  return modal;
}

module.exports = {
  idPrefix: "iplan:",

  async execute(interaction) {
    await ensureTables();

    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    // --- RENDEZ-VOUS: étape 2 (ouvrir le modal date/heure) ---
    if (interaction.customId.startsWith("iplan:appt:date:")) {
      const parts = interaction.customId.split(":");
      const week = parts[3];
      const owner = parts[4];
      if (owner !== userId) return interaction.reply({ content: "❌ Cette action n'est pas à toi.", flags: 64 });
      return interaction.showModal(buildAppointmentDateModal(week));
    }

    // --- NAVIGATION ---
    if (interaction.customId.startsWith("iplan:nav:")) {
      const parts = interaction.customId.split(":");
      const dir = parts[2]; // prev|next
      const week = parts[3];

      const delta = dir === "prev" ? -7 : 7;
      const newWeek = addDaysMysql(week, delta);

      // sauver la semaine affichée
      await setWeekMonday(guildId, newWeek);

      const rec = await getPlanningMessage(guildId);
      if (!rec) return interaction.reply({ content: "❌ Planning introuvable en DB.", flags: 64 });

      const ch = await interaction.guild.channels.fetch(String(rec.channel_id));
      if (!ch?.isTextBased?.()) return interaction.reply({ content: "❌ Channel du planning introuvable.", flags: 64 });

      const msg = await ch.messages.fetch(String(rec.message_id));
      const { embed, components } = await buildWeeklyPlanningMessage({ guildId, weekMondayDate: newWeek });
      await msg.edit({ embeds: [embed], components });

      return interaction.deferUpdate();
    }

    // --- ADD START: ouvre le select type ---
    if (interaction.customId.startsWith("iplan:add:start:")) {
      const week = interaction.customId.split(":")[3];
      clearDraft(guildId, userId);

      const row = buildTypeSelect(userId, week);
      return interaction.reply({
        content: "Choisis le type d'entrée à ajouter :",
        components: [row],
        flags: 64,
      });
    }

    // --- EDIT START: select une entrée ---
    if (interaction.customId.startsWith("iplan:edit:start:")) {
      const week = interaction.customId.split(":")[3];
      const entries = await listEntriesForWeek(guildId, week);

      if (!entries.length) {
        return interaction.reply({ content: "❌ Rien à modifier cette semaine.", flags: 64 });
      }

      const options = entries.slice(0, 25).map((e) => {
        const dt = toLocalFromMysqlDatetime(e.event_datetime);
        const label = `${dt ? `${toFR(dt)} ${pad2(dt.getHours())}h` : "Sans date"} — ${shortEntryLabel(e)}`;
        return { label: label.slice(0, 100), value: String(e.id_entry) };
      });

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`iplanselect:edit:pick:${userId}`)
          .setPlaceholder("Choisis l'entrée à modifier…")
          .addOptions(options)
      );

      clearDraft(guildId, userId);
      return interaction.reply({ content: "Quelle entrée veux-tu modifier ?", components: [row], flags: 64 });
    }

    // --- DEL START: select une entrée ---
    if (interaction.customId.startsWith("iplan:del:start:")) {
      const week = interaction.customId.split(":")[3];
      const entries = await listEntriesForWeek(guildId, week);

      if (!entries.length) {
        return interaction.reply({ content: "❌ Rien à supprimer cette semaine.", flags: 64 });
      }

      const options = entries.slice(0, 25).map((e) => {
        const dt = toLocalFromMysqlDatetime(e.event_datetime);
        const label = `${dt ? `${toFR(dt)} ${pad2(dt.getHours())}h` : "Sans date"} — ${shortEntryLabel(e)}`;
        return { label: label.slice(0, 100), value: String(e.id_entry) };
      });

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`iplanselect:del:pick:${userId}`)
          .setPlaceholder("Choisis l'entrée à supprimer…")
          .addOptions(options)
      );

      clearDraft(guildId, userId);
      return interaction.reply({ content: "Quelle entrée veux-tu supprimer ?", components: [row], flags: 64 });
    }

    // --- OPEN EDIT MODAL ---
    if (interaction.customId.startsWith("iplan:edit:open:")) {
      const parts = interaction.customId.split(":");
      const idEntry = parts[3];
      const owner = parts[4];

      if (owner !== userId) return interaction.reply({ content: "❌ Cette action n'est pas à toi.", flags: 64 });

      const entry = await getEntryById(guildId, idEntry);
      if (!entry) return interaction.reply({ content: "❌ Entrée introuvable.", flags: 64 });

      clearDraft(guildId, userId);
      return interaction.showModal(buildEditOpenModal(entry));
    }

    // --- DELETE CONFIRM ---
    if (interaction.customId.startsWith("iplan:del:confirm:")) {
      const parts = interaction.customId.split(":");
      const idEntry = parts[3];
      const owner = parts[4];
      const choice = parts[5]; // yes|no

      if (owner !== userId) return interaction.reply({ content: "❌ Cette action n'est pas à toi.", flags: 64 });

      if (choice === "no") {
        return interaction.update({ content: "✅ Annulé.", components: [] });
      }

      await deleteEntry(guildId, idEntry);

      // refresh message
      const rec = await getPlanningMessage(guildId);
      if (rec) {
        const week = rec.week_monday;
        try {
          const ch = await interaction.guild.channels.fetch(String(rec.channel_id));
          if (ch?.isTextBased?.()) {
            const msg = await ch.messages.fetch(String(rec.message_id));
            const { embed, components } = await buildWeeklyPlanningMessage({ guildId, weekMondayDate: week });
            await msg.edit({ embeds: [embed], components });
          }
        } catch (_) {}
      }

      return interaction.update({ content: "🗑️ Supprimé.", components: [] });
    }
  },
};
