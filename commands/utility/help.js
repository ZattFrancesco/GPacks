// commands/utility/help.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const logger = require("../../src/utils/logger");
const {
  getVisibleCategories,
  getItemsForCategory,
  getUncategorizedItems,
} = require("../../services/helpGlobal.db");

function pickTitle(cat) {
  if (cat.emoji && cat.display_name.includes(cat.emoji)) return cat.display_name;
  if (cat.emoji) return `${cat.emoji} ${cat.display_name}`;
  return cat.display_name;
}

function formatItem(row) {
  const name = row.label_override || row.default_name || row.item_key;
  const desc = row.description_override || row.default_description || "";
  return desc ? `• **${name}** — ${desc}` : `• **${name}**`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Affiche l’aide du bot (pilotée par la base de données)")
    .addStringOption((opt) =>
      opt
        .setName("category")
        .setDescription("Clé de catégorie (optionnel, ex: utility, tickets)")
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      const categoryKey = interaction.options.getString("category");

      // Si on demande une catégorie précise
      if (categoryKey) {
        const items = await getItemsForCategory(categoryKey);

        if (!items.length) {
          return interaction.reply({
            content: `❌ Aucune commande dans la catégorie **${categoryKey}** (ou catégorie inconnue).`,
            ephemeral: true,
          });
        }

        const embed = new EmbedBuilder()
          .setTitle(`📚 Aide — ${categoryKey}`)
          .setDescription(items.map(formatItem).join("\n").slice(0, 4000));

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // Sinon, affiche la liste des catégories + un résumé
      const categories = await getVisibleCategories();

      const base = new EmbedBuilder()
        .setTitle("📚 Aide du bot")
        .setDescription("Choisis une catégorie avec `/help category:<clé>`.\n\n**Catégories disponibles :**")
        .setFooter({ text: "Help piloté par DB (catégories + ordre + hidden + overrides)" });

      // Ajoute les catégories comme une liste
      const lines = categories.map((c) => `• **${pickTitle(c)}** — \`${c.category_key}\``);
      base.addFields([{ name: "Catégories", value: lines.join("\n").slice(0, 1024) || "Aucune", inline: false }]);

      // Optionnel : “Non classé”
      const uncategorized = await getUncategorizedItems();
      if (uncategorized.length) {
        base.addFields([
          {
            name: "Non classé",
            value: uncategorized.slice(0, 10).map(formatItem).join("\n").slice(0, 1024),
            inline: false,
          },
        ]);
      }

      // Couleur : si tu veux une couleur globale, tu peux la mettre ici
      return interaction.reply({ embeds: [base], ephemeral: true });
    } catch (err) {
      logger.error(`help cmd error: ${err?.stack || err}`);
      return interaction.reply({ content: "❌ Erreur interne sur /help.", ephemeral: true }).catch(() => {});
    }
  },
};