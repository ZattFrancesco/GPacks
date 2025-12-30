const { isOwner } = require("../src/utils/permissions");
const db = require("../services/hierarchy.db");

module.exports = [
  // ADD tier
  {
    id: "hier:modal_tier_add",
    async execute(interaction) {
      if (!isOwner(interaction.user.id)) return interaction.reply({ content: "❌ Owner only.", ephemeral: true });

      const name = interaction.fields.getTextInputValue("name")?.trim();
      const desc = interaction.fields.getTextInputValue("desc")?.trim() || null;

      if (!name) return interaction.reply({ content: "❌ Nom invalide.", ephemeral: true });

      await db.createTier(interaction.guildId, name, desc);
      return interaction.reply({ content: "✅ Palier ajouté.", ephemeral: true });
    },
  },

  // EDIT tier meta => customId hier:modal_tier_edit:<tierId>
  {
    idPrefix: "hier:modal_tier_edit:",
    async execute(interaction) {
      if (!isOwner(interaction.user.id)) return interaction.reply({ content: "❌ Owner only.", ephemeral: true });

      const tierId = interaction.customId.split(":").pop();
      const name = interaction.fields.getTextInputValue("name")?.trim();
      const desc = interaction.fields.getTextInputValue("desc")?.trim() || null;

      if (!name) return interaction.reply({ content: "❌ Nom invalide.", ephemeral: true });

      await db.setTierMeta(interaction.guildId, tierId, name, desc);
      return interaction.reply({ content: "✅ Palier modifié.", ephemeral: true });
    },
  },

  // META embed
  {
    id: "hier:modal_meta",
    async execute(interaction) {
      if (!isOwner(interaction.user.id)) return interaction.reply({ content: "❌ Owner only.", ephemeral: true });

      const title = interaction.fields.getTextInputValue("title")?.trim() || null;
      const color = interaction.fields.getTextInputValue("color")?.trim() || null;
      const footer = interaction.fields.getTextInputValue("footer")?.trim() || null;

      await db.upsertSettings(interaction.guildId, { title, color, footer });
      return interaction.reply({ content: "✅ Embed configuré.", ephemeral: true });
    },
  },
];