const { isOwner } = require("../src/utils/permissions");
const db = require("../services/hierarchy.db");

module.exports = {
  // customId = hier:roles_for_tier:<tierId>
  idPrefix: "hier:roles_for_tier:",
  async execute(interaction) {
    if (!isOwner(interaction.user.id)) return interaction.reply({ content: "❌ Owner only.", flags: 64 });

    const tierId = interaction.customId.split(":").pop();
    const roleIds = interaction.values || [];

    const res = await db.setTierRoles(interaction.guildId, tierId, roleIds);
    if (!res.ok) return interaction.reply({ content: "❌ Erreur: palier introuvable.", flags: 64 });

    return interaction.reply({ content: "✅ Rôles enregistrés pour ce palier.", flags: 64 });
  },
};