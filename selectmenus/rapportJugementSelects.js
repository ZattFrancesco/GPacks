// selects/rapportJugementSelects.js
const { updateDraft, getDraft } = require("../src/utils/rjDrafts");

module.exports = {
  idPrefix: "rjsel:",

  async execute(interaction) {
    // customId: rjsel:<role>:<ownerId>
    const [, role, ownerId] = interaction.customId.split(":");

    if (interaction.user.id !== ownerId) {
      return interaction.reply({ content: "❌ Pas ton rapport.", flags: 64 });
    }

    const draft = getDraft(interaction.guildId, ownerId);
    if (!draft) {
      return interaction.reply({
        content: "⏱️ Rapport expiré (15 min). Relance /rapport-jugement.",
        flags: 64,
      });
    }

    // User select menu => interaction.values = array d'IDs users
    const values = Array.isArray(interaction.values) ? interaction.values : [];

    if (role === "jugeIds") {
      updateDraft(interaction.guildId, ownerId, { jugeIds: values });
    } else if (role === "procIds") {
      updateDraft(interaction.guildId, ownerId, { procIds: values });
    } else if (role === "avocatIds") {
      updateDraft(interaction.guildId, ownerId, { avocatIds: values });
    } else {
      return interaction.reply({ content: "❌ Sélecteur inconnu.", flags: 64 });
    }

    // On ne change pas le message : on confirme juste
    return interaction.reply({ content: "✅", flags: 64 });
  },
};