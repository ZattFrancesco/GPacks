const { getDraft, updateDraft, clearDraft } = require("../src/utils/rjDrafts");
const { parseJudgementDate, formatRapportJugement } = require("../src/utils/rapportJugementFormat");
const { ensureTables, insertReport } = require("../services/rapportJugement.db");

const { panel } = require("../buttons/rapportJugementButtons");

// petit helper pour éviter les crash si champ absent
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
    const [prefix, step, userId] = interaction.customId.split(":");

    if (interaction.user.id !== userId) {
      return interaction.reply({ content: "❌ Ce formulaire ne t'appartient pas.", ephemeral: true });
    }

    await ensureTables();

    // STEP 1 -> on stocke puis on affiche bouton "Étape 2"
    if (step === "step1") {
      const nom = safeVal(interaction, "nom");
      const prenom = safeVal(interaction, "prenom");
      const dateJugementRaw = safeVal(interaction, "dateJugement");

      updateDraft(userId, { nom, prenom, dateJugementRaw });

      return interaction.reply({
        content: "✅ Étape 1 enregistrée. Clique pour continuer.",
        ephemeral: true,
        components: panel(userId, 1),
      });
    }

    // STEP 2 -> on stocke puis on affiche bouton "Étape 3"
    if (step === "step2") {
      const juge = safeVal(interaction, "juge");
      const procureur = safeVal(interaction, "procureur");
      const avocat = safeVal(interaction, "avocat");

      updateDraft(userId, { juge, procureur, avocat });

      return interaction.reply({
        content: "✅ Étape 2 enregistrée. Clique pour continuer.",
        ephemeral: true,
        components: panel(userId, 2),
      });
    }

    // STEP 3 -> final
    if (step === "step3") {
      const peine = safeVal(interaction, "peine");
      const amende = safeVal(interaction, "amende");
      const tigRaw = safeVal(interaction, "tig");
      const tigEntreprise = safeVal(interaction, "tigEntreprise");
      const observation = safeVal(interaction, "observation");

      const draft = getDraft(userId);
      if (!draft) {
        return interaction.reply({
          content: "⏱️ Ton rapport a expiré (15 min). Relance `/rapport-jugement`.",
          ephemeral: true,
        });
      }

      const tig = (tigRaw || "").trim().toLowerCase();
      const tigBool = tig === "oui" || tig === "o" || tig === "yes" || tig === "y";

      const dateJugement = parseJudgementDate(draft.dateJugementRaw);

      const payload = {
        guildId: interaction.guildId,
        reporterUserId: interaction.user.id,

        nom: draft.nom,
        prenom: draft.prenom,
        dateJugement,

        juge: draft.juge,
        procureur: draft.procureur,
        avocat: draft.avocat,

        peine,
        amende,
        tig: tigBool ? 1 : 0,
        tigEntreprise: tigEntreprise || "/",
        observation,
      };

      const content = formatRapportJugement(payload);

      // 1) Envoi dans le salon (public)
      await interaction.reply({ content });

      // 2) Save DB
      await insertReport(payload);

      // 3) Clear draft
      clearDraft(userId);

      return;
    }
  },
};