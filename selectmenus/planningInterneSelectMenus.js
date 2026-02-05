// selectmenus/planningInterneSelectMenus.js

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  RoleSelectMenuBuilder,
} = require("discord.js");

const {
  ensureTables,
  toMysqlDatetimeFromParts,
  getPlanningMessage,
  listEntriesForWeek,
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

function buildTrainingModal(week) {
  const modal = new ModalBuilder().setCustomId(`iplanmodal:add:TRAINING:${week}`).setTitle("Ajouter — Entraînement sécu");

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

function buildAppointmentNameModal(week) {
  const modal = new ModalBuilder().setCustomId(`iplanmodal:add:APPOINTMENT_NAME:${week}`).setTitle("Ajouter — Rendez-vous");

  const lastname = new TextInputBuilder()
    .setCustomId("lastname")
    .setLabel("Nom (personne)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const firstname = new TextInputBuilder()
    .setCustomId("firstname")
    .setLabel("Prénom (personne)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(lastname),
    new ActionRowBuilder().addComponents(firstname)
  );

  return modal;
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



function buildMeetingModal(week) {
  const modal = new ModalBuilder().setCustomId(`iplanmodal:add:MEETING:${week}`).setTitle("Ajouter — Réunion");

  const year = new TextInputBuilder().setCustomId("year").setLabel("Année").setStyle(TextInputStyle.Short).setRequired(true);
  const month = new TextInputBuilder().setCustomId("month").setLabel("Mois (1-12)").setStyle(TextInputStyle.Short).setRequired(true);
  const day = new TextInputBuilder().setCustomId("day").setLabel("Jour (1-31)").setStyle(TextInputStyle.Short).setRequired(true);
  const hour = new TextInputBuilder().setCustomId("hour").setLabel("Heure (0-23)").setStyle(TextInputStyle.Short).setRequired(true);

  const motif = new TextInputBuilder().setCustomId("motif").setLabel("Motif").setStyle(TextInputStyle.Paragraph).setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(year),
    new ActionRowBuilder().addComponents(month),
    new ActionRowBuilder().addComponents(day),
    new ActionRowBuilder().addComponents(hour),
    new ActionRowBuilder().addComponents(motif)
  );

  return modal;
}

function buildOtherModal(week) {
  const modal = new ModalBuilder().setCustomId(`iplanmodal:add:OTHER:${week}`).setTitle("Ajouter — Autre");

  const year = new TextInputBuilder().setCustomId("year").setLabel("Année").setStyle(TextInputStyle.Short).setRequired(true);
  const month = new TextInputBuilder().setCustomId("month").setLabel("Mois (1-12)").setStyle(TextInputStyle.Short).setRequired(true);
  const day = new TextInputBuilder().setCustomId("day").setLabel("Jour (1-31)").setStyle(TextInputStyle.Short).setRequired(true);
  const hour = new TextInputBuilder().setCustomId("hour").setLabel("Heure (0-23)").setStyle(TextInputStyle.Short).setRequired(true);

  const reason = new TextInputBuilder().setCustomId("reason").setLabel("Raison").setStyle(TextInputStyle.Paragraph).setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(year),
    new ActionRowBuilder().addComponents(month),
    new ActionRowBuilder().addComponents(day),
    new ActionRowBuilder().addComponents(hour),
    new ActionRowBuilder().addComponents(reason)
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
  idPrefix: "iplanselect:",

  async execute(interaction) {
    await ensureTables();

    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const parts = String(interaction.customId).split(":");
    const mode = parts[1]; // add|edit|del

    // ---------- ADD: type selection ----------
    if (mode === "add" && parts[2] === "type") {
      const owner = parts[3];
      const week = parts[4];

      if (owner !== userId) return interaction.reply({ content: "❌ Cette action n'est pas à toi.", flags: 64 });

      const picked = interaction.values?.[0];

      if (picked === "TRAINING") return interaction.showModal(buildTrainingModal(week));
      if (picked === "APPOINTMENT") return interaction.showModal(buildAppointmentNameModal(week));
      if (picked === "MEETING") return interaction.showModal(buildMeetingModal(week));
      return interaction.showModal(buildOtherModal(week));
    }

    // ---------- ADD / EDIT: finalize APPOINTMENT users ----------
    if ((mode === "add" || mode === "edit") && parts[2] === "appointment_users") {
      const owner = parts[3];
      if (owner !== userId) return interaction.reply({ content: "❌ Cette action n'est pas à toi.", flags: 64 });

      const d = getDraft(guildId, userId);
      if (!d) return interaction.reply({ content: "❌ Draft introuvable (refais l'action).", flags: 64 });

      const ids = (interaction.values || []).map(String);
      const joined = ids.join(",");

      if (d.mode === "add") {
        await insertEntry({
          guildId,
          weekMonday: d.week,
          type: "APPOINTMENT",
          eventDatetime: d.eventDatetime,
          personFirstname: d.firstname,
          personLastname: d.lastname,
          concernedUserIds: joined,
          createdByUserId: userId,
        });
      } else if (d.mode === "edit") {
        await updateEntry(guildId, d.idEntry, {
          eventDatetime: d.eventDatetime,
          personFirstname: d.firstname,
          personLastname: d.lastname,
          concernedUserIds: joined,
        });
      }

      clearDraft(guildId, userId);
      await refreshPlanningMessage(interaction, guildId);

      return interaction.update({ content: "✅ Enregistré.", components: [] });
    }

    // ---------- ADD / EDIT: finalize MEETING roles ----------
    if ((mode === "add" || mode === "edit") && parts[2] === "meeting_roles") {
      const owner = parts[3];
      if (owner !== userId) return interaction.reply({ content: "❌ Cette action n'est pas à toi.", flags: 64 });

      const d = getDraft(guildId, userId);
      if (!d) return interaction.reply({ content: "❌ Draft introuvable (refais l'action).", flags: 64 });

      const ids = (interaction.values || []).map(String);
      const joined = ids.join(",");

      if (d.mode === "add") {
        await insertEntry({
          guildId,
          weekMonday: d.week,
          type: "MEETING",
          eventDatetime: d.eventDatetime,
          meetingMotif: d.motif,
          concernedRoleIds: joined,
          createdByUserId: userId,
        });
      } else if (d.mode === "edit") {
        await updateEntry(guildId, d.idEntry, {
          eventDatetime: d.eventDatetime,
          meetingMotif: d.motif,
          concernedRoleIds: joined,
        });
      }

      clearDraft(guildId, userId);
      await refreshPlanningMessage(interaction, guildId);

      return interaction.update({ content: "✅ Enregistré.", components: [] });
    }

    // ---------- EDIT / DEL: pick entry ----------
    if (mode === "edit" && parts[2] === "pick") {
      const owner = parts[3];
      if (owner !== userId) return interaction.reply({ content: "❌ Cette action n'est pas à toi.", flags: 64 });

      const idEntry = interaction.values?.[0];
      const entry = await getEntryById(guildId, idEntry);
      if (!entry) return interaction.reply({ content: "❌ Entrée introuvable.", flags: 64 });

      clearDraft(guildId, userId);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`iplan:edit:open:${idEntry}:${userId}`)
          .setLabel("Ouvrir la modification")
          .setStyle(ButtonStyle.Primary)
      );

      return interaction.update({ content: "Clique pour modifier cette entrée :", components: [row] });
    }

    if (mode === "del" && parts[2] === "pick") {
      const owner = parts[3];
      if (owner !== userId) return interaction.reply({ content: "❌ Cette action n'est pas à toi.", flags: 64 });

      const idEntry = interaction.values?.[0];
      const entry = await getEntryById(guildId, idEntry);
      if (!entry) return interaction.reply({ content: "❌ Entrée introuvable.", flags: 64 });

      clearDraft(guildId, userId);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`iplan:del:confirm:${idEntry}:${userId}:yes`)
          .setLabel("✅ Oui supprimer")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`iplan:del:confirm:${idEntry}:${userId}:no`)
          .setLabel("❌ Annuler")
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.update({ content: "⚠️ Confirme la suppression :", components: [row] });
    }
  },
};
