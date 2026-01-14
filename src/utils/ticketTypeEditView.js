const {
  ActionRowBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

function yesNo(v) {
  return v ? "✅ Oui" : "❌ Non";
}

function mentionRoles(roleIds) {
  const ids = Array.isArray(roleIds) ? roleIds : [];
  if (!ids.length) return "—";
  return ids.map((id) => `<@&${id}>`).join(" ");
}

function safeEmoji(e) {
  const s = String(e || "").trim();
  return s ? s : "—";
}

/**
 * Vue “dashboard” pour éditer un type
 */
function buildTypeEditView(guild, type) {
  const staff = mentionRoles(type.staff_role_ids || []);
  const cat = type.category_opened_id ? `<#${type.category_opened_id}>` : "—";
  const custom = type.custom_embed_enabled ? "✅ Activé" : "❌ Désactivé";

  const embed = new EmbedBuilder()
    .setTitle(`🧩 Édition du type : ${type.id}`)
    .setDescription("Choisis ce que tu veux modifier via le menu ci-dessous.")
    .addFields(
      { name: "Label", value: String(type.label || "—"), inline: true },
      { name: "Emoji", value: safeEmoji(type.emoji), inline: true },
      { name: "nameModalRename", value: yesNo(Boolean(type.namemodalrename)), inline: true },
      { name: "Catégorie d'ouverture", value: cat, inline: true },
      { name: "Rôles staff", value: staff, inline: false },
      {
        name: "Custom embed",
        value:
          `${custom}` +
          (type.custom_embed_enabled
            ? `\n**Titre :** ${type.custom_embed_title || "—"}\n**Desc :** ${type.custom_embed_description ? "(défini)" : "—"}`
            : ""),
        inline: false,
      }
    )
    .setFooter({ text: `Type ID: ${type.id}` });

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`tickettype:edit:field:${type.id}`)
    .setPlaceholder("Que veux-tu modifier ?")
    .addOptions(
      { label: "Label", value: "label", emoji: "🏷️" },
      { label: "Emoji", value: "emoji", emoji: "😄" },
      { label: "Catégorie d'ouverture", value: "category", emoji: "🗂️" },
      { label: "Rôles staff", value: "roles", emoji: "👮" },
      { label: "nameModalRename", value: "namemodalrename", emoji: "🧑‍💼" },
      { label: "Custom embed", value: "customembed", emoji: "📝" }
    );

  const row1 = new ActionRowBuilder().addComponents(menu);

  // Petit raccourci toggle nameModalRename
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`tickettype:edit:toggle:${type.id}:namemodalrename:1`)
      .setLabel("Activer rename")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`tickettype:edit:toggle:${type.id}:namemodalrename:0`)
      .setLabel("Désactiver rename")
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row1, row2] };
}

module.exports = { buildTypeEditView };
