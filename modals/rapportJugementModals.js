// modals/rapportJugementModals.js

const { updateDraft, getDraft, clearDraft } = require("../src/utils/rjDrafts");
const { panel } = require("../buttons/rapportJugementButtons");
const { parseJudgementDate, formatRapportJugement } = require("../src/utils/rapportJugementFormat");
const { ensureTables, insertReport } = require("../services/rapportJugement.db");

function safeVal(interaction, id) {
  try {
    return interaction.fields.getTextInputValue(id);
  } catch {
    return null;
  }
}

module.exports = {
  idPrefix: "rj:",

  async execute(interaction) {
    const [, step, userId] = interaction.customId.split(":");

    if (interaction.user.id !== userId) {
      return interaction.reply({ content: "❌ Pas ton formulaire.", ephemeral: true });
    }

    await ensureTables();

    // STEP 1
    if (step === "step1") {
      updateDraft(interaction.guildId, userId, {
        nom: safeVal(interaction, "nom"),
        prenom: safeVal(interaction, "prenom"),
        dateJugementRaw: safeVal(interaction, "dateJugement"),
      });

      return interaction.reply({
        content: "✅ Étape 1 enregistrée. Clique pour continuer.",
        ephemeral: true,
        components: panel(userId, 1),
      });
    }

    // STEP 2
    if (step === "step2") {
      updateDraft(interaction.guildId, userId, {
        juge: safeVal(interaction, "juge"),
        procureur: safeVal(interaction, "procureur"),
        avocat: safeVal(interaction, "avocat"),
      });

      return interaction.reply({
        content: "✅ Étape 2 enregistrée. Clique pour continuer.",
        ephemeral: true,
        components: panel(userId, 2),
      });
    }

    // STEP 3 FINAL
    if (step === "step3") {
      const draft = getDraft(interaction.guildId, userId);
      if (!draft) {
        return interaction.reply({
          content: "⏱️ Rapport expiré. Relance /rapport-jugement.",
          ephemeral: true,
        });
      }

      const tigRaw = safeVal(interaction, "tig") || "";
      const tigBool = ["oui", "o", "yes", "y"].includes(tigRaw.toLowerCase().trim());

      const payload = {
        guildId: interaction.guildId,
        reporterUserId: interaction.user.id,

        nom: draft.nom,
        prenom: draft.prenom,
        dateJugement: parseJudgementDate(draft.dateJugementRaw),

        juge: draft.juge,
        procureur: draft.procureur,
        avocat: draft.avocat,

        peine: safeVal(interaction, "peine"),
        amende: safeVal(interaction, "amende"),
        tig: tigBool ? 1 : 0,
        tigEntreprise: safeVal(interaction, "tigEntreprise") || "/",
        observation: safeVal(interaction, "observation"),
      };

      await interaction.reply({ content: formatRapportJugement(payload) });
      await insertReport(payload);
      clearDraft(interaction.guildId, userId);
    }
  },
};