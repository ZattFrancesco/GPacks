// modals/dojModals.js
const { setDraft, getDraft, updateDraft } = require("../src/utils/dojDrafts");
const { buildJugementEmbed } = require("../src/utils/jugementEmbed");
const { wizardComponents } = require("../buttons/dojButtons");

/**
 * Lecture safe d’un champ modal :
 * - si le champ n'existe pas => ""
 * - évite les crashs si customId différent
 */
function safeVal(interaction, customId) {
  try {
    const v = interaction.fields.getTextInputValue(customId);
    return (v ?? "").trim();
  } catch {
    return "";
  }
}

module.exports = {
  idPrefix: "doj:",

  async execute(interaction) {
    const parts = interaction.customId.split(":");
    // ex: doj:main:123 / doj:nbcasiers:123
    const prefix = parts[0];
    const action = parts[1];
    const ownerId = parts[2];

    if (prefix !== "doj") return;

    if (ownerId && interaction.user.id !== ownerId) {
      return interaction.reply({ content: "❌ Ce formulaire ne t'appartient pas.", ephemeral: true });
    }

    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    // Modal principal
    if (action === "main") {
      // IDs attendus (match la commande /demande-jugement)
      const suspect = safeVal(interaction, "suspect");
      const ppa = safeVal(interaction, "ppa");
      const faits = safeVal(interaction, "faits");
      const agentsPresents = safeVal(interaction, "agentsPresents");
      const rapport = safeVal(interaction, "rapport");

      const draft = {
        openedAt: new Date().toISOString(),
        agentCharge: `<@${userId}>`,

        suspect,
        ppa,
        faits,
        agentsPresents,
        rapport,

        nbCasiers: "",

        // OFF par défaut
        manualPhotosReminder: false,
      };

      setDraft(guildId, userId, draft);

      return interaction.reply({
        ephemeral: true,
        content:
          "✅ Étape 1 enregistrée.\n" +
          "Tu peux activer **Photos manuelles** (ON) si tu veux que le bot poste un rappel sous le dossier.",
        embeds: [buildJugementEmbed(draft)],
        components: wizardComponents(userId, draft),
      });
    }

    // Modal nb casiers
    if (action === "nbcasiers") {
      const existing = getDraft(guildId, userId);
      if (!existing) {
        return interaction.reply({
          ephemeral: true,
          content: "⏱️ Ton dossier a expiré (15 min). Relance `/demande-jugement`.",
        });
      }

      const nb = safeVal(interaction, "nbCasiers");
      const updated = updateDraft(guildId, userId, { nbCasiers: nb });

      return interaction.reply({
        ephemeral: true,
        content: "✅ Nombre de casiers mis à jour.",
        embeds: [buildJugementEmbed(updated)],
        components: wizardComponents(userId, updated),
      });
    }

    return interaction.reply({ content: "❌ Modal inconnu.", ephemeral: true });
  },
};