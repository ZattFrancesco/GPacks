// modals/planningInterneModals.js

const {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const {
  ensureTables,
  toMysqlDatetimeFromParts,
  getPlanningMessage,
  insertEntry,
  updateEntry,
  getEntryById,
} = require("../services/internalPlanning.db");

const { buildWeeklyPlanningMessage } = require("../src/utils/internalPlanningView");
const { setDraft, getDraft, clearDraft } = require("../src/utils/internalPlanningDrafts");

function safeVal(interaction, id) {
  try {
    return interaction.fields.getTextInputValue(id);
  } catch {
    return null;
  }
}


function parseDateFR(str) {
  const s = String(str || "").trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return null;
  if (yyyy < 2000 || yyyy > 2100) return null;
  if (mm < 1 || mm > 12) return null;
  if (dd < 1 || dd > 31) return null;
  return { year: yyyy, month: mm, day: dd };
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


async function refreshPlanningMessage(interaction, guildId) {
  const rec = await getPlanningMessage(guildId);
  if (!rec) return;

  try {
    const ch = await interaction.guild.channels.fetch(String(rec.channel_id));
    if (!ch?.isTextBased?.()) return;
    const msg = await ch.messages.fetch(String(rec.message_id));
    const { embed, components } = await buildWeeklyPlanningMessage({ guildId, weekMondayDate: rec.week_monday });
    await msg.edit({ embeds: [embed], components });
  } catch (_) {
    // ignore
  }
}

module.exports = {
  idPrefix: "iplanmodal:",

  async execute(interaction) {
    await ensureTables();

    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const parts = String(interaction.customId).split(":");
    // patterns:
    // iplanmodal:add:<TYPE>:<week>
    // iplanmodal:edit:<TYPE>:<idEntry>

    const action = parts[1]; // add|edit
    const type = String(parts[2] || "").toUpperCase();

        // ---------- ADD ----------
    if (action === "add") {
      const week = parts[3];

      if (type === "OTHER") {
        const year = safeVal(interaction, "year");
        const month = safeVal(interaction, "month");
        const day = safeVal(interaction, "day");
        const hour = safeVal(interaction, "hour");
        const dt = toMysqlDatetimeFromParts({ year, month, day, hour });
        if (!dt) return interaction.reply({ content: "❌ Date/heure invalide.", flags: 64 });

        const reason = String(safeVal(interaction, "reason") || "").trim();
        if (!reason) return interaction.reply({ content: "❌ Raison vide.", flags: 64 });

        const entryId = await insertEntry({
          guildId,
          weekMonday: week,
          type: "OTHER",
          eventDatetime: dt,
          otherReason: reason,
          createdByUserId: userId,
        });

        await auditLog(interaction.client, interaction.guildId, {
          module: "PLANNING",
          action: "CREATE_ENTRY",
          level: "INFO",
          userId: interaction.user.id,
          sourceChannelId: interaction.channelId,
          message: `Planning interne : entrée ajoutée.`,
          meta: { entryId, week },
        });

        await refreshPlanningMessage(interaction, guildId);
        clearDraft(guildId, userId);
        return interaction.reply({ content: "✅ Ajouté.", flags: 64 });
      }


      if (type === "APPOINTMENT_NAME") {
        const lastname = String(safeVal(interaction, "lastname") || "").trim();
        const firstname = String(safeVal(interaction, "firstname") || "").trim();
        if (!lastname || !firstname) return interaction.reply({ content: "❌ Nom / prénom manquant.", flags: 64 });

        // IMPORTANT: Discord n'autorise pas de chaîner un modal depuis un ModalSubmit.
        // On stocke l'identité, puis on propose un bouton pour ouvrir le 2e modal (date/heure).
        setDraft(guildId, userId, { mode: "add", type: "APPOINTMENT", week, lastname, firstname });

        const row = new ActionRowBuilder().addComponents(
          // handled dans buttons/planningInterneButtons.js
          new ButtonBuilder()
            .setCustomId(`iplan:appt:date:${week}:${userId}`)
            .setLabel("Continuer → Date & heure")
            .setStyle(ButtonStyle.Primary)
        );

        return interaction.reply({
          content: "✅ Nom enregistré. Clique pour renseigner la **date & l'heure** :",
          components: [row],
          flags: 64,
        });
      }

      if (type === "APPOINTMENT_DATE") {
        const draft = getDraft(guildId, userId);
        if (!draft || draft.mode !== "add" || draft.type !== "APPOINTMENT") {
          return interaction.reply({ content: "❌ Brouillon manquant. Recommence avec ➕ Ajouter.", flags: 64 });
        }

        const year = safeVal(interaction, "year");
        const month = safeVal(interaction, "month");
        const day = safeVal(interaction, "day");
        const hour = safeVal(interaction, "hour");

        const dt = toMysqlDatetimeFromParts({ year, month, day, hour });
        if (!dt) return interaction.reply({ content: "❌ Date/heure invalide.", flags: 64 });

        setDraft(guildId, userId, { ...draft, eventDatetime: dt });

        const row = new ActionRowBuilder().addComponents(
          new UserSelectMenuBuilder()
            .setCustomId(`iplanselect:add:appointment_users:${userId}`)
            .setPlaceholder("Sélectionne les personnes concernées…")
            .setMinValues(0)
            .setMaxValues(25)
        );

        return interaction.reply({
          content: "Maintenant sélectionne les **personnes concernées** (optionnel) :",
          components: [row],
          flags: 64,
        });
      }


      // TRAINING / MEETING: date & heure obligatoires via 4 champs
      const year = safeVal(interaction, "year");
      const month = safeVal(interaction, "month");
      const day = safeVal(interaction, "day");
      const hour = safeVal(interaction, "hour");

      const dt = toMysqlDatetimeFromParts({ year, month, day, hour });
      if (!dt) return interaction.reply({ content: "❌ Date/heure invalide.", flags: 64 });

      if (type === "TRAINING") {
        const entryId = await insertEntry({
          guildId,
          weekMonday: week,
          type: "TRAINING",
          eventDatetime: dt,
          createdByUserId: userId,
        });

        await auditLog(interaction.client, interaction.guildId, {
          module: "PLANNING",
          action: "CREATE_ENTRY",
          level: "INFO",
          userId: interaction.user.id,
          sourceChannelId: interaction.channelId,
          message: `Planning interne : entrée ajoutée.`,
          meta: { entryId, week },
        });

        await refreshPlanningMessage(interaction, guildId);
        clearDraft(guildId, userId);
        return interaction.reply({ content: "✅ Ajouté.", flags: 64 });
      }

      if (type === "MEETING") {
        const motif = String(safeVal(interaction, "motif") || "").trim();
        if (!motif) return interaction.reply({ content: "❌ Motif manquant.", flags: 64 });

        setDraft(guildId, userId, { mode: "add", type: "MEETING", week, eventDatetime: dt, motif });

        const row = new ActionRowBuilder().addComponents(
          new RoleSelectMenuBuilder()
            .setCustomId(`iplanselect:add:meeting_roles:${userId}`)
            .setPlaceholder("Sélectionne les rôles concernés…")
            .setMinValues(0)
            .setMaxValues(25)
        );

        return interaction.reply({
          content: "Maintenant sélectionne les **rôles concernés** (optionnel) :",
          components: [row],
          flags: 64,
        });
      }

      return interaction.reply({ content: "❌ Type inconnu.", flags: 64 });
    }

    // ---------- EDIT ----------
    if (action === "edit") {
      const idEntry = parts[3];

      const existing = await getEntryById(guildId, idEntry);
      if (!existing) return interaction.reply({ content: "❌ Entrée introuvable.", flags: 64 });

      if (type === "OTHER") {
        const year = safeVal(interaction, "year");
        const month = safeVal(interaction, "month");
        const day = safeVal(interaction, "day");
        const hour = safeVal(interaction, "hour");
        const dt = toMysqlDatetimeFromParts({ year, month, day, hour });
        if (!dt) return interaction.reply({ content: "❌ Date/heure invalide.", flags: 64 });

        const reason = String(safeVal(interaction, "reason") || "").trim();
        if (!reason) return interaction.reply({ content: "❌ Raison vide.", flags: 64 });

        await updateEntry(guildId, idEntry, { eventDatetime: dt, otherReason: reason });
        await refreshPlanningMessage(interaction, guildId);
        clearDraft(guildId, userId);
        return interaction.reply({ content: "✅ Modifié.", flags: 64 });
      }

      if (type === "APPOINTMENT") {
        // Édition en 2 étapes : modal (date/heure + nom/prénom) puis select users.
        const dateStr = String(safeVal(interaction, "date") || "").trim();
        const hourStr = String(safeVal(interaction, "hour") || "").trim();
        const lastname = String(safeVal(interaction, "lastname") || "").trim();
        const firstname = String(safeVal(interaction, "firstname") || "").trim();
        if (!lastname || !firstname) return interaction.reply({ content: "❌ Nom / prénom manquant.", flags: 64 });

        const p = parseDateFR(dateStr);
        const dt = p ? toMysqlDatetimeFromParts({ year: p.year, month: p.month, day: p.day, hour: hourStr }) : null;
        if (!dt) return interaction.reply({ content: "❌ Date/heure invalide.", flags: 64 });

        setDraft(guildId, userId, { mode: "edit", type: "APPOINTMENT", idEntry, eventDatetime: dt, lastname, firstname });

        const row = new ActionRowBuilder().addComponents(
          new UserSelectMenuBuilder()
            .setCustomId(`iplanselect:edit:appointment_users:${userId}`)
            .setPlaceholder("Sélectionne les personnes concernées…")
            .setMinValues(0)
            .setMaxValues(25)
        );

        return interaction.reply({
          content: "Maintenant sélectionne les **personnes concernées** (optionnel) :",
          components: [row],
          flags: 64,
        });
      }


      // TRAINING / MEETING
      const year = safeVal(interaction, "year");
      const month = safeVal(interaction, "month");
      const day = safeVal(interaction, "day");
      const hour = safeVal(interaction, "hour");

      const dt = toMysqlDatetimeFromParts({ year, month, day, hour });
      if (!dt) return interaction.reply({ content: "❌ Date/heure invalide.", flags: 64 });

      if (type === "TRAINING") {
        await updateEntry(guildId, idEntry, { eventDatetime: dt });

        await refreshPlanningMessage(interaction, guildId);
        clearDraft(guildId, userId);
        return interaction.reply({ content: "✅ Modifié.", flags: 64 });
      }

      if (type === "MEETING") {
        const motif = String(safeVal(interaction, "motif") || "").trim();
        if (!motif) return interaction.reply({ content: "❌ Motif manquant.", flags: 64 });

        setDraft(guildId, userId, { mode: "edit", type: "MEETING", idEntry, eventDatetime: dt, motif });

        const row = new ActionRowBuilder().addComponents(
          new RoleSelectMenuBuilder()
            .setCustomId(`iplanselect:edit:meeting_roles:${userId}`)
            .setPlaceholder("Sélectionne les rôles concernés…")
            .setMinValues(0)
            .setMaxValues(25)
        );

        return interaction.reply({
          content: "Sélectionne les **rôles concernés** (optionnel) :",
          components: [row],
          flags: 64,
        });
      }

      return interaction.reply({ content: "❌ Type inconnu.", flags: 64 });
    }

  },
};
