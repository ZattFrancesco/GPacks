// modals/dojModals.js
const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const { setDraft, getDraft, updateDraft } = require("../src/utils/dojDrafts");
const { buildJugementEmbed } = require("../src/utils/jugementEmbed");
const { wizardComponents } = require("../buttons/dojButtons");

function safeVal(interaction, customId) {
  const v = interaction.fields.getTextInputValue(customId);
  return (v ?? "").trim();
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

    if (action === "main") {
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

        // On stocke des listes (casier peut avoir plusieurs images)
        photoCasierUrls: [],
        photoIndividuUrls: [],
      };

      setDraft(guildId, userId, draft);

      const preview = buildJugementEmbed(draft);

      return interaction.reply({
        ephemeral: true,
        content:
          "✅ Étape 1 enregistrée.\n" +
          "Utilise les boutons pour uploader les photos (tu envoies juste les images dans le salon), puis clique **Valider et envoyer**.",
        embeds: [preview],
        components: wizardComponents(userId),
      });
    }

    if (action === "nbcasiers") {
      const nb = safeVal(interaction, "nbCasiers");
      const existing = getDraft(guildId, userId);
      if (!existing) {
        return interaction.reply({
          ephemeral: true,
          content: "⏱️ Ton dossier a expiré (15 min). Relance `/demande-jugement`.",
        });
      }

      const updated = updateDraft(guildId, userId, { nbCasiers: nb });
      const preview = buildJugementEmbed(updated);

      return interaction.reply({
        ephemeral: true,
        content: "✅ Nombre de casiers mis à jour.",
        embeds: [preview],
        components: wizardComponents(userId),
      });
    }

    // Si customId inconnu
    return interaction.reply({ content: "❌ Modal inconnu.", ephemeral: true });
  },
};