const { wizardComponents } = require("../buttons/dojButtons");
const { setDraft, getDraft } = require("../src/utils/dojDrafts");
const { buildJugementEmbed } = require("../src/utils/jugementEmbed");

function parseOwner(customId, expectedPrefix) {
  if (!customId?.startsWith(expectedPrefix)) return null;
  const parts = customId.split(":");
  return parts[2] || null;
}

module.exports = [
  {
    idPrefix: "doj:main:",
    async execute(interaction) {
      const ownerId = parseOwner(interaction.customId, "doj:main:");
      if (ownerId && interaction.user.id !== ownerId) {
        return interaction.reply({ content: "❌ Ce modal ne t'appartient pas.", ephemeral: true });
      }

      const guildId = interaction.guildId;
      const userId = interaction.user.id;

      const suspect = interaction.fields.getTextInputValue("suspect")?.trim();
      const ppa = interaction.fields.getTextInputValue("ppa")?.trim();
      const faits = interaction.fields.getTextInputValue("faits")?.trim();
      const agentsPresentsRaw = interaction.fields.getTextInputValue("agents")?.trim();
      const rapport = interaction.fields.getTextInputValue("rapport")?.trim();

      const payload = {
        openedAt: new Date().toISOString(),
        agentCharge: `<@${userId}>`,
        suspect,
        ppa,
        faits,
        agentsPresents: agentsPresentsRaw || `<@${userId}>`,
        rapport,
        // pièces (step2)
        photoCasier: "",
        nbCasiers: "",
        photoIndividu: "",
      };

      setDraft(guildId, userId, payload);

      const embed = buildJugementEmbed(payload);
      return interaction.reply({
        content: "✅ Étape 1 enregistrée. Tu peux ajouter les pièces ou envoyer.",
        embeds: [embed],
        components: wizardComponents(userId),
        ephemeral: true,
      });
    },
  },
  {
    idPrefix: "doj:pieces:",
    async execute(interaction) {
      const ownerId = parseOwner(interaction.customId, "doj:pieces:");
      if (ownerId && interaction.user.id !== ownerId) {
        return interaction.reply({ content: "❌ Ce modal ne t'appartient pas.", ephemeral: true });
      }

      const guildId = interaction.guildId;
      const userId = interaction.user.id;
      const draft = getDraft(guildId, userId);
      if (!draft) {
        return interaction.reply({
          content: "⏱️ Ton dossier a expiré (15 min). Relance `/demande-jugement`.",
          ephemeral: true,
        });
      }

      const photoCasier = interaction.fields.getTextInputValue("photoCasier")?.trim();
      const nbCasiers = interaction.fields.getTextInputValue("nbCasiers")?.trim();
      const photoIndividu = interaction.fields.getTextInputValue("photoIndividu")?.trim();

      draft.photoCasier = photoCasier || "";
      draft.nbCasiers = nbCasiers || "";
      draft.photoIndividu = photoIndividu || "";

      // On ré-enregistre pour prolonger le TTL + garder le même objet propre
      setDraft(guildId, userId, draft);

      const embed = buildJugementEmbed(draft);
      return interaction.reply({
        content: "✅ Pièces enregistrées. Tu peux maintenant envoyer.",
        embeds: [embed],
        components: wizardComponents(userId),
        ephemeral: true,
      });
    },
  },
];
