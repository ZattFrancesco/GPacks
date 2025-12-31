const db = require("../services/jugement.db");

module.exports = {
  id: "doj:config:roles",
  async execute(interaction) {
    const guildId = interaction.guildId;
    const selected = interaction.values || [];

    await db.upsertSettings(guildId, { pingRoleIds: selected });

    const current = selected.length
      ? selected.map((id) => `<@&${id}>`).join(" ")
      : "Aucun";

    return interaction.update({
      content: `✅ Rôles enregistrés : ${current}`,
      components: interaction.message?.components || [],
    });
  },
};
