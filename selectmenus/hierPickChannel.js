const { isOwner } = require("../src/utils/permissions");
const db = require("../services/hierarchy.db");

module.exports = {
  id: "hier:pick_channel",
  async execute(interaction) {
    if (!isOwner(interaction.user.id)) return interaction.reply({ content: "❌ Owner only.", ephemeral: true });

    const ch = interaction.values?.[0];
    if (!ch) return interaction.reply({ content: "❌ Aucun salon choisi.", ephemeral: true });

    await db.upsertSettings(interaction.guildId, { channel_id: String(ch) });
    return interaction.reply({ content: "✅ Salon configuré.", ephemeral: true });
  },
};