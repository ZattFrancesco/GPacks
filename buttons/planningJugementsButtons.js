// buttons/planningJugementsButtons.js

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
} = require("../services/judgementPlanning.db");

const { buildWeeklyPlanningMessage } = require("../src/utils/judgementPlanningView");
const { setDraft, clearDraft } = require("../src/utils/judgementPlanningDrafts");

function pad2(n) {
  return String(Number(n)).padStart(2, "0");
}

function toFR(dateObj) {
  const d = dateObj.getDate();
  const m = dateObj.getMonth() + 1;
  const y = dateObj.getFullYear();
  return `${pad2(d)}/${pad2(m)}/${y}`;
}

function toLocalDateFromMysqlDate(mysqlDate) {
  // mysqlDate: "YYYY-MM-DD" (ou null)
  // mysql2 peut renvoyer un Date pour un champ DATE.
  if (mysqlDate instanceof Date) {
    const d = new Date(mysqlDate);
    if (Number.isNaN(d.getTime())) return getWeekMondayLocal();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  if (!mysqlDate || mysqlDate === "null" || mysqlDate === "undefined") {
    return getWeekMondayLocal();
  }
  const d = new Date(`${mysqlDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return getWeekMondayLocal();
  return d;
}

function toLocalFromMysqlDatetime(mysqlDt) {
  if (mysqlDt instanceof Date) return mysqlDt;
  return new Date(String(mysqlDt).replace(" ", "T"));
}

async function refreshPlanningMessage(interaction, guildId) {
  // ✅ Objectif:
  // - Mettre à jour LE message de planning (celui stocké en DB)
  // - MAIS si on est déjà sur ce message, on l'édite directement (sans fetch)
  // - Et surtout: ne jamais crash si le message/salon a été supprimé.

  const rec = await getPlanningMessage(guildId);
  if (!rec) {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({ content: "Planning introuvable. Relance /planning-jugements pour recréer le message.", ephemeral: true });
      } else {
        await interaction.followUp({ content: "Planning introuvable. Relance /planning-jugements pour recréer le message.", ephemeral: true });
      }
    } catch (_) {}
    return false;
  }

  const safeWeek = rec.week_monday || toMysqlDate(getWeekMondayLocal());
  if (!rec.week_monday) {
    try { await setWeekMonday(guildId, safeWeek); } catch (_) {}
  }

  const { embed, components } = await buildWeeklyPlanningMessage({ guildId, weekMondayDate: safeWeek });
  const payload = { embeds: [embed], components };

  // 1) Si l'interaction vient du message de planning, on édite DIRECTEMENT.
  try {
    const msg = interaction?.message;
    if (msg && String(msg.id) === String(rec.message_id) && String(msg.channelId) === String(rec.channel_id)) {
      await msg.edit(payload);
      return true;
    }
  } catch (_) {
    // On ignore et on tente la méthode DB.
  }

  // 2) Sinon (ex: suppression via message éphémère), on édite le message stocké en DB.
  try {
    const ch = await interaction.client.channels.fetch(String(rec.channel_id));
    if (!ch || !ch.isTextBased?.()) throw new Error("Planning channel not text-based");
    const planningMsg = await ch.messages.fetch(String(rec.message_id));
    await planningMsg.edit(payload);
    return true;
  } catch (err) {
    // 10003 = Unknown Channel, 10008 = Unknown Message
    if (err?.code === 10003 || err?.code === 10008 || err?.status === 404) {
      try {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.reply({
            content: "Le message du planning est introuvable (supprimé ou salon inaccessible). Relance /planning-jugements pour le recréer.",
            ephemeral: true,
          });
        } else {
          await interaction.followUp({
            content: "Le message du planning est introuvable (supprimé ou salon inaccessible). Relance /planning-jugements pour le recréer.",
            ephemeral: true,
          });
        }
      } catch (_) {}
      return false;
    }
    throw err;
  }
}

function buildAddModalStep1() {
  const modal = new ModalBuilder().setCustomId("jplanmodal:add:step1").setTitle("Ajouter — Identité");

  const lastname = new TextInputBuilder()
    .setCustomId("lastname")
    .setLabel("Nom")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const firstname = new TextInputBuilder()
    .setCustomId("firstname")
    .setLabel("Prénom")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const accusedId = new TextInputBuilder()
    .setCustomId("accused_id")
    .setLabel("ID accusé")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const ticket = new TextInputBuilder()
    .setCustomId("ticket_url")
    .setLabel("Lien ticket Discord (https://...)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(lastname),
    new ActionRowBuilder().addComponents(firstname),
    new ActionRowBuilder().addComponents(accusedId),
    new ActionRowBuilder().addComponents(ticket)
  );

  return modal;
}

function buildDateModal(customId, title, defaults = {}) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);

  const year = new TextInputBuilder()
    .setCustomId("year")
    .setLabel("Année (YYYY)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(defaults.year || "");

  const month = new TextInputBuilder()
    .setCustomId("month")
    .setLabel("Mois (1-12)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(defaults.month || "");

  const day = new TextInputBuilder()
    .setCustomId("day")
    .setLabel("Jour (1-31)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(defaults.day || "");

  const hour = new TextInputBuilder()
    .setCustomId("hour")
    .setLabel("Heure (HH:MM) ex: 18:00")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(defaults.hour || "");

  modal.addComponents(
    new ActionRowBuilder().addComponents(year),
    new ActionRowBuilder().addComponents(month),
    new ActionRowBuilder().addComponents(day),
    new ActionRowBuilder().addComponents(hour)
  );

  return modal;
}

function buildEditModalStep1(entry) {
  const modal = new ModalBuilder()
    .setCustomId(`jplanmodal:edit:step1:${entry.id_judge}`)
    .setTitle("Modifier — Identité");

  const lastname = new TextInputBuilder()
    .setCustomId("lastname")
    .setLabel("Nom")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(String(entry.accused_lastname || ""));

  const firstname = new TextInputBuilder()
    .setCustomId("firstname")
    .setLabel("Prénom")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(String(entry.accused_firstname || ""));

  const accusedId = new TextInputBuilder()
    .setCustomId("accused_id")
    .setLabel("ID accusé")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(String(entry.accused_id || ""));

  const ticket = new TextInputBuilder()
    .setCustomId("ticket_url")
    .setLabel("Lien ticket Discord (https://...)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(String(entry.ticket_url || ""));

  modal.addComponents(
    new ActionRowBuilder().addComponents(lastname),
    new ActionRowBuilder().addComponents(firstname),
    new ActionRowBuilder().addComponents(accusedId),
    new ActionRowBuilder().addComponents(ticket)
  );

  return modal;
}

module.exports = {
  idPrefix: "jplan:",

  async execute(interaction) {
    await ensureTables();

    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    // --- ADD ---
    if (interaction.customId === "jplan:add:start") {
      clearDraft(guildId, userId);
      return interaction.showModal(buildAddModalStep1());
    }

    if (interaction.customId.startsWith("jplan:add:step2:")) {
      const ownerId = interaction.customId.split(":")[3];
      if (ownerId !== userId) {
        return interaction.reply({ content: "❌ Ce bouton ne t'est pas destiné.", ephemeral: true });
      }
      // modal date/heure
      return interaction.showModal(buildDateModal("jplanmodal:add:step2", "Ajouter — Date/Heure"));
    }

    // --- EDIT ---
    if (interaction.customId === "jplan:edit:start") {
      const rec = await getPlanningMessage(guildId);
      if (!rec) return interaction.reply({ content: "❌ Aucun planning configuré. Lance /planning-jugements.", ephemeral: true });

      const entries = await listEntriesForWeek(guildId, rec.week_monday);
      if (!entries.length) {
        return interaction.reply({ content: "❌ Rien à modifier cette semaine.", ephemeral: true });
      }

      const options = entries.slice(0, 25).map((e) => {
        const dt = toLocalFromMysqlDatetime(e.judgement_datetime);
        const label = `${toFR(dt)} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())} - ${e.accused_lastname} ${e.accused_firstname} (${e.accused_id})`;
        return { label: label.slice(0, 100), value: String(e.id_judge) };
      });

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`jplanselect:edit:pick:${userId}`)
          .setPlaceholder("Choisir une entrée à modifier")
          .addOptions(options)
      );

      return interaction.reply({ content: "Choisis l'entrée à modifier :", components: [row], ephemeral: true });
    }

    if (interaction.customId.startsWith("jplan:edit:open:")) {
      // format: jplan:edit:open:<idJudge>:<ownerId>
      const parts = interaction.customId.split(":");
      const idJudge = Number(parts[3]);
      const ownerId = parts[4];

      if (ownerId !== userId) {
        return interaction.reply({ content: "❌ Ce bouton ne t'est pas destiné.", ephemeral: true });
      }

      const entry = await getEntryById(guildId, idJudge);
      if (!entry) return interaction.reply({ content: "❌ Entrée introuvable.", ephemeral: true });

      clearDraft(guildId, userId);

      return interaction.showModal(buildEditModalStep1(entry));
    }


    if (interaction.customId.startsWith("jplan:edit:step2:")) {
      // format: jplan:edit:step2:<idJudge>:<ownerId>
      const parts = interaction.customId.split(":");
      const idJudge = Number(parts[3]);
      const ownerId = parts[4];
      if (ownerId !== userId) return interaction.reply({ content: "❌ Ce bouton ne t'est pas destiné.", ephemeral: true });

      const entry = await getEntryById(guildId, idJudge);
      if (!entry) return interaction.reply({ content: "❌ Entrée introuvable.", ephemeral: true });

      const dt = toLocalFromMysqlDatetime(entry.judgement_datetime);
      const defaults = {
        year: String(dt.getFullYear()),
        month: String(dt.getMonth() + 1),
        day: String(dt.getDate()),
        hour: `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`,
      };

      return interaction.showModal(buildDateModal(`jplanmodal:edit:step2:${idJudge}`, "Modifier — Date/Heure", defaults));
    }

    // --- DELETE ---
    if (interaction.customId === "jplan:del:start") {
      const rec = await getPlanningMessage(guildId);
      if (!rec) return interaction.reply({ content: "❌ Aucun planning configuré. Lance /planning-jugements.", ephemeral: true });

      const entries = await listEntriesForWeek(guildId, rec.week_monday);
      if (!entries.length) {
        return interaction.reply({ content: "❌ Rien à supprimer cette semaine.", ephemeral: true });
      }

      const options = entries.slice(0, 25).map((e) => {
        const dt = toLocalFromMysqlDatetime(e.judgement_datetime);
        const label = `${toFR(dt)} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())} - ${e.accused_lastname} ${e.accused_firstname} (${e.accused_id})`;
        return { label: label.slice(0, 100), value: String(e.id_judge) };
      });

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`jplanselect:del:pick:${userId}`)
          .setPlaceholder("Choisir une entrée à supprimer")
          .addOptions(options)
      );

      return interaction.reply({ content: "Choisis l'entrée à supprimer :", components: [row], ephemeral: true });
    }

    if (interaction.customId.startsWith("jplan:del:confirm:")) {
      // format: jplan:del:confirm:<idJudge>:<ownerId>:yes|no
      const parts = interaction.customId.split(":");
      const idJudge = Number(parts[3]);
      const ownerId = parts[4];
      const choice = parts[5];

      if (ownerId !== userId) return interaction.reply({ content: "❌ Ce bouton ne t'est pas destiné.", ephemeral: true });

      if (choice === "no") {
        return interaction.update({ content: "✅ Suppression annulée.", components: [] });
      }

      await deleteEntry(guildId, idJudge);

      // Ce bouton est sur un message éphémère (le menu de suppression),
      // donc on confirme d'abord ici...
      await interaction.update({ content: "✅ Entrée supprimée. Je mets à jour le planning…", components: [] });

      // ...puis on met à jour LE message de planning (stocké en DB).
      await refreshPlanningMessage(interaction, guildId);

      return;
    }

    // --- WEEK NAV ---
    if (interaction.customId === "jplan:week:prev" || interaction.customId === "jplan:week:next") {
      const rec = await getPlanningMessage(guildId);
      if (!rec) return interaction.reply({ content: "❌ Aucun planning configuré. Lance /planning-jugements.", ephemeral: true });

      const monday = toLocalDateFromMysqlDate(rec.week_monday);
      monday.setDate(monday.getDate() + (interaction.customId === "jplan:week:prev" ? -7 : 7));
      // Sécurité: si date invalide, on retombe sur la semaine actuelle
      const base = Number.isNaN(monday.getTime()) ? getWeekMondayLocal() : monday;
      const newWeek = toMysqlDate(base);

      await setWeekMonday(guildId, newWeek);
      await refreshPlanningMessage(interaction, guildId);

      // pas de spam: on répond juste en ephemeral
      return interaction.reply({ content: `✅ Semaine affichée: ${toFR(monday)}`, ephemeral: true });
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate();
    }
  },
};
