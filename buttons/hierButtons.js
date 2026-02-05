const { isOwner } = require("../src/utils/permissions");
const db = require("../services/hierarchy.db");
const { buildHierarchyEmbed } = require("../src/utils/hierarchyEmbed");

async function doRefresh(interaction) {
  const settings = (await db.getSettings(interaction.guildId)) || {};
  const tiers = await db.getTierRoles(interaction.guildId);
  const embed = buildHierarchyEmbed({ guild: interaction.guild, settings, tiers });

  return interaction.update({
    embeds: [embed],
    components: interaction.message.components,
  });
}

module.exports = [
  {
    id: "hier:refresh",
    async execute(interaction) {
      if (!isOwner(interaction.user.id)) return interaction.reply({ content: "❌ Owner only.", flags: 64 });
      return doRefresh(interaction);
    },
  },
  {
    id: "hier:close",
    async execute(interaction) {
      if (!isOwner(interaction.user.id)) return interaction.reply({ content: "❌ Owner only.", flags: 64 });
      return interaction.update({ content: "Panel fermé.", embeds: [], components: [] });
    },
  },
  {
    idPrefix: "hier:move_up:",
    async execute(interaction) {
      if (!isOwner(interaction.user.id)) return interaction.reply({ content: "❌ Owner only.", flags: 64 });
      const tierId = interaction.customId.split(":").pop();
      await db.moveTier(interaction.guildId, tierId, "up");
      return interaction.reply({ content: "✅ Palier monté.", flags: 64 });
    },
  },
  {
    idPrefix: "hier:move_down:",
    async execute(interaction) {
      if (!isOwner(interaction.user.id)) return interaction.reply({ content: "❌ Owner only.", flags: 64 });
      const tierId = interaction.customId.split(":").pop();
      await db.moveTier(interaction.guildId, tierId, "down");
      return interaction.reply({ content: "✅ Palier descendu.", flags: 64 });
    },
  },
];