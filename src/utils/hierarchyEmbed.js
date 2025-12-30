const { EmbedBuilder } = require("discord.js");

function safeColor(hex) {
  if (!hex) return null;
  const h = String(hex).trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return parseInt(h, 16);
}

function buildHierarchyEmbed({ guild, settings, tiers }) {
  const title = settings?.title || `Hiérarchie — ${guild?.name || "Serveur"}`;
  const footer = settings?.footer || "DOJHelper";
  const colorInt = safeColor(settings?.color) ?? null;

  const embed = new EmbedBuilder().setTitle(title).setFooter({ text: footer });

  if (colorInt !== null) embed.setColor(colorInt);

  if (!tiers?.length) {
    embed.setDescription("Aucun palier configuré. Utilise `/hiérarchie config`.");
    return embed;
  }

  for (const tier of tiers) {
    const roles = (tier.role_ids || []).map(rid => `<@&${rid}>`).join("\n");
    const descParts = [];
    if (tier.description) descParts.push(tier.description);
    descParts.push(roles || "_(Aucun rôle)_");

    embed.addFields({
      name: `#${tier.tier_index} — ${tier.name}`,
      value: descParts.join("\n"),
      inline: false,
    });
  }

  return embed;
}

module.exports = { buildHierarchyEmbed };