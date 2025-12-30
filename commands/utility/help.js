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
  const label = row.label_override || row.default_name || row.item_key;
  const desc = row.description_override || row.default_description || "";
  return desc ? `• **${label}** — ${desc}` : `• **${label}**`;
}

function fallbackHelpFromLoadedCommands(interaction) {
  const cmds = interaction.client?.commands;
  const names = [];

  if (cmds && typeof cmds.forEach === "function") {
    cmds.forEach((cmd, name) => {
      names.push(`• **/${name}** — ${cmd?.data?.description || "—"}`);
    });
  }

  const embed = new EmbedBuilder()
    .setTitle("📚 Aide du bot (mode fallback)")
    .setDescription(
      "La DB est indisponible, donc j'affiche la liste simple des commandes chargées.\n\n" +
        (names.length ? names.join("\n").slice(0, 3900) : "Aucune commande trouvée.")
    )
    .setFooter({ text: "Astuce: vérifie MySQL (DB_HOST/DB_PORT) pour retrouver le help par catégories." });

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Affiche l'aide du bot")
    .addStringOption((opt) =>
      opt
        .setName("category")
        .setDescription("Clé de catégorie (ex: tickets, moderation...)")
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      const categoryKey = interaction.options.getString("category");

      // Si category demandé, afficher les items de cette catégorie
      if (categoryKey) {
        const items = await getItemsForCategory(categoryKey);

        if (!items.length) {
          return interaction.reply({
            content: `❌ Aucune commande trouvée pour la catégorie \`${categoryKey}\`.`,
            ephemeral: true,
          });
        }

        const embed = new EmbedBuilder()
          .setTitle(`📚 Aide — ${categoryKey}`)
          .setDescription(items.map(formatItem).join("\n").slice(0, 4000));

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // Sinon, liste catégories DB
      const categories = await getVisibleCategories();

      const base = new EmbedBuilder()
        .setTitle("📚 Aide du bot")
        .setDescription("Choisis une catégorie avec `/help category:<clé>`.\n\n**Catégories disponibles :**")
        .setFooter({ text: "Help piloté par DB (catégories + ordre + hidden + overrides)" });

      const lines = categories.map((c) => `• **${pickTitle(c)}** — \`${c.category_key}\``);
      base.addFields([{ name: "Catégories", value: lines.join("\n").slice(0, 1024) || "Aucune", inline: false }]);

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

      return interaction.reply({ embeds: [base], ephemeral: true });
    } catch (err) {
      // Si DB down (ECONNREFUSED), on fallback au lieu d'afficher "Erreur interne"
      if (err?.code === "ECONNREFUSED") {
        return fallbackHelpFromLoadedCommands(interaction);
      }

      logger.error(`help cmd error: ${err?.stack || err}`);
      return interaction.reply({ content: "❌ Erreur interne sur /help.", ephemeral: true }).catch(() => {});
    }
  },
};