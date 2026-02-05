const { isOwner } = require("../src/utils/permissions");
const db = require("../services/hierarchy.db");

module.exports = {
  id: "hier:pick_channel",
  async execute(interaction) {
    if (!isOwner(interaction.user.id)) return interaction.reply({ content: "❌ Owner only.", flags: 64 });

    const ch = interaction.values?.[0];
    if (!ch) return interaction.reply({ content: "❌ Aucun salon choisi.", flags: 64 });

    await db.upsertSettings(interaction.guildId, { channel_id: String(ch) });
    return interaction.reply({ content: "✅ Salon configuré.", flags: 64 });
  },
};