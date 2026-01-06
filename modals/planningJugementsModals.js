// modals/planningJugementsModals.js

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const {
  ensureTables,
  toMysqlDatetimeFromParts,
  getPlanningMessage,
  listEntriesForWeek,
  insertEntry,
  updateEntry,
} = require("../services/judgementPlanning.db");
const { buildWeeklyPlanningMessage } = require("../src/utils/judgementPlanningView");
const { setDraft, getDraft, clearDraft } = require("../src/utils/judgementPlanningDrafts");

function normalizeName(str, max = 100) {
  const s = String(str || "").trim();
  if (!s) return null;
  return s.slice(0, max);
}

function normalizeTicket(url) {
  const s = String(url || "").trim();
  if (!s) return null;
  // accept any URL-ish string; keep it simple
  if (!/^https?:\/\//i.test(s)) return null;
  return s;
}

async function refreshPlanningMessage(guild, guildId) {
  const rec = await getPlanningMessage(guildId);
  if (!rec) return false;

  try {
    // On tente d'éditer le message stocké en DB.
    // (modal submit = message éphémère, donc on ne peut pas se baser sur interaction.message)
    const ch = await guild.channels.fetch(String(rec.channel_id));
    if (!ch || !ch.isTextBased?.()) return false;
    const msg = await ch.messages.fetch(String(rec.message_id));
    if (!msg) return false;

    const { embed, components } = await buildWeeklyPlanningMessage({
      guildId,
      weekMondayDate: rec.week_monday,
    });

    await msg.edit({ embeds: [embed], components });
    return true;
  } catch (err) {
    // 10003 = Unknown Channel, 10008 = Unknown Message
    if (err?.code === 10003 || err?.code === 10008 || err?.status === 404) return false;
    return false;
  }
}

module.exports = {
  idPrefix: "jplanmodal:",

  async execute(interaction) {
    await ensureTables();

    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const [prefix, action, step, maybeId] = String(interaction.customId).split(":");
    // customId patterns:
    // jplanmodal:add:step1
    // jplanmodal:add:step2
    // jplanmodal:edit:step1:<idJudge>
    // jplanmodal:edit:step2:<idJudge>

    if (action === "add" && step === "step1") {
      const lastname = normalizeName(interaction.fields.getTextInputValue("lastname"));
      const firstname = normalizeName(interaction.fields.getTextInputValue("firstname"));
      const accusedId = normalizeName(interaction.fields.getTextInputValue("accused_id"), 50);
      const ticket = normalizeTicket(interaction.fields.getTextInputValue("ticket_url"));

      if (!lastname || !firstname || !accusedId || !ticket) {
        return interaction.reply({
          content: "❌ Champs invalides. Vérifie Nom / Prénom / ID / Lien ticket (doit commencer par http).",
          ephemeral: true,
        });
      }

      setDraft(guildId, userId, {
        mode: "add",
        accused_lastname: lastname,
        accused_firstname: firstname,
        accused_id: accusedId,
        ticket_url: ticket,
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`jplan:add:step2:${userId}`).setLabel("Continuer (date/heure)").setStyle(ButtonStyle.Primary)
      );

      return interaction.reply({ content: "✅ Identité enregistrée. Clique pour continuer.", components: [row], ephemeral: true });
    }

    if (action === "add" && step === "step2") {
      const year = interaction.fields.getTextInputValue("year");
      const month = interaction.fields.getTextInputValue("month");
      const day = interaction.fields.getTextInputValue("day");
      const hour = interaction.fields.getTextInputValue("hour");

      const dtStr = toMysqlDatetimeFromParts(year, month, day, hour);
      if (!dtStr) {
        return interaction.reply({ content: "❌ Date/heure invalide. Exemple heure: 18:00", ephemeral: true });
      }

      const draft = getDraft(guildId, userId);
      if (!draft || draft.mode !== "add") {
        return interaction.reply({ content: "❌ Brouillon introuvable. Recommence avec ➕ Ajouter.", ephemeral: true });
      }

      // anti doublon simple sur la semaine: même datetime + accused_id
      const rec = await getPlanningMessage(guildId);
      if (rec) {
        const weekEntries = await listEntriesForWeek(guildId, rec.week_monday);
        const dup = weekEntries.find(
          (e) => String(e.judgement_datetime).startsWith(dtStr.slice(0, 16)) && String(e.accused_id) === String(draft.accused_id)
        );
        if (dup) {
          return interaction.reply({ content: "❌ Doublon: même date/heure et même ID accusé déjà présent.", ephemeral: true });
        }
      }

      await insertEntry(guildId, {
        ...draft,
        judgement_datetime: dtStr,
        created_by_user_id: userId,
      });

      clearDraft(guildId, userId);

      const ok = await refreshPlanningMessage(interaction.guild, guildId);
      if (!ok) {
        return interaction.reply({
          content: "✅ Entrée ajoutée. ⚠️ Je n'ai pas réussi à mettre à jour l'embed du planning (message supprimé ou salon inaccessible). Relance /planning-jugements pour le recréer.",
          ephemeral: true,
        });
      }

      return interaction.reply({ content: "✅ Entrée ajoutée + planning mis à jour.", ephemeral: true });
    }

    if (action === "edit" && step === "step1") {
      const idJudge = Number(maybeId);
      if (!idJudge) return interaction.reply({ content: "❌ Entrée invalide.", ephemeral: true });

      const lastname = normalizeName(interaction.fields.getTextInputValue("lastname"));
      const firstname = normalizeName(interaction.fields.getTextInputValue("firstname"));
      const accusedId = normalizeName(interaction.fields.getTextInputValue("accused_id"), 50);
      const ticket = normalizeTicket(interaction.fields.getTextInputValue("ticket_url"));

      if (!lastname || !firstname || !accusedId || !ticket) {
        return interaction.reply({
          content: "❌ Champs invalides. Vérifie Nom / Prénom / ID / Lien ticket (doit commencer par http).",
          ephemeral: true,
        });
      }

      setDraft(guildId, userId, {
        mode: "edit",
        id_judge: idJudge,
        accused_lastname: lastname,
        accused_firstname: firstname,
        accused_id: accusedId,
        ticket_url: ticket,
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`jplan:edit:step2:${idJudge}:${userId}`).setLabel("Continuer (date/heure)").setStyle(ButtonStyle.Primary)
      );

      return interaction.reply({ content: "✅ Infos enregistrées. Clique pour continuer.", components: [row], ephemeral: true });
    }

    if (action === "edit" && step === "step2") {
      const idJudge = Number(maybeId);
      if (!idJudge) return interaction.reply({ content: "❌ Entrée invalide.", ephemeral: true });

      const year = interaction.fields.getTextInputValue("year");
      const month = interaction.fields.getTextInputValue("month");
      const day = interaction.fields.getTextInputValue("day");
      const hour = interaction.fields.getTextInputValue("hour");

      const dtStr = toMysqlDatetimeFromParts(year, month, day, hour);
      if (!dtStr) {
        return interaction.reply({ content: "❌ Date/heure invalide. Exemple heure: 18:00", ephemeral: true });
      }

      const draft = getDraft(guildId, userId);
      if (!draft || draft.mode !== "edit" || Number(draft.id_judge) !== idJudge) {
        return interaction.reply({ content: "❌ Brouillon introuvable. Recommence avec ✏️ Modifier.", ephemeral: true });
      }

      await updateEntry(guildId, idJudge, {
        accused_firstname: draft.accused_firstname,
        accused_lastname: draft.accused_lastname,
        accused_id: draft.accused_id,
        ticket_url: draft.ticket_url,
        judgement_datetime: dtStr,
      });

      clearDraft(guildId, userId);

      const ok = await refreshPlanningMessage(interaction.guild, guildId);
      if (!ok) {
        return interaction.reply({
          content: "✅ Entrée modifiée. ⚠️ Je n'ai pas réussi à mettre à jour l'embed du planning (message supprimé ou salon inaccessible). Relance /planning-jugements pour le recréer.",
          ephemeral: true,
        });
      }

      return interaction.reply({ content: "✅ Entrée modifiée + planning mis à jour.", ephemeral: true });
    }

    return interaction.reply({ content: "❌ Action modal inconnue.", ephemeral: true });
  },
};
