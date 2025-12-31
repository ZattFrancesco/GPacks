const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const { isOwner } = require("../../src/utils/permissions");
const db = require("../../services/hierarchy.db");
const { buildHierarchyEmbed } = require("../../src/utils/hierarchyEmbed");

function panelComponents() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("hier:action")
    .setPlaceholder("Choisir une action…")
    .addOptions(
      { label: "➕ Ajouter un palier", value: "tier_add" },
      { label: "✏️ Renommer / description d’un palier", value: "tier_edit" },
      { label: "🗑️ Supprimer un palier", value: "tier_delete" },
      { label: "⬆️⬇️ Déplacer un palier", value: "tier_move" },
      { label: "🎭 Définir les rôles d’un palier", value: "tier_roles" },
      { label: "📝 Modifier l’embed (titre/couleur/footer)", value: "meta" },
      { label: "📌 Choisir le salon de publication", value: "channel" },
      { label: "🚀 Publier / Mettre à jour le message", value: "publish" }
    );

  const row1 = new ActionRowBuilder().addComponents(menu);

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("hier:refresh")
      .setLabel("Rafraîchir preview")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("hier:close")
      .setLabel("Fermer")
      .setStyle(ButtonStyle.Danger)
  );

  return [row1, row2];
}

module.exports = {
  data: new SlashCommandBuilder()
    // ⚠️ Je conseille SANS accent pour éviter les soucis : "hierarchie"
    // Mais si tu veux absolument avec accent, remplace les 2 lignes ci-dessous :
    .setName("hierarchie")
    .setDescription("Configurer et afficher la hiérarchie de rôles (DOJ)")
    .addSubcommand((s) => s.setName("config").setDescription("Ouvrir le panel de configuration"))
    .addSubcommand((s) => s.setName("show").setDescription("Afficher l’embed hiérarchie"))
    .addSubcommand((s) => s.setName("publish").setDescription("Publier / mettre à jour le message hiérarchie"))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    // Owner only
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: "❌ Réservé à l’owner.", ephemeral: true });
    }

    const sub = interaction.options.getSubcommand(true);
    const guildId = interaction.guildId;

    // /hierarchie config
    if (sub === "config") {
      const settings = (await db.getSettings(guildId)) || {};
      const tiers = await db.getTierRoles(guildId);
      const embed = buildHierarchyEmbed({ guild: interaction.guild, settings, tiers });

      return interaction.reply({
        embeds: [embed],
        components: panelComponents(),
        ephemeral: true,
      });
    }

    // /hierarchie show
    if (sub === "show") {
      const settings = (await db.getSettings(guildId)) || {};
      const tiers = await db.getTierRoles(guildId);
      const embed = buildHierarchyEmbed({ guild: interaction.guild, settings, tiers });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // /hierarchie publish
    if (sub === "publish") {
      const settings = (await db.getSettings(guildId)) || {};
      if (!settings.channel_id) {
        return interaction.reply({
          content: "❌ Aucun salon configuré. Fais `/hierarchie config` → 'Choisir le salon'.",
          ephemeral: true,
        });
      }

      const tiers = await db.getTierRoles(guildId);
      const embed = buildHierarchyEmbed({ guild: interaction.guild, settings, tiers });

      const channel = await interaction.guild.channels.fetch(settings.channel_id).catch(() => null);
      if (!channel) {
        return interaction.reply({ content: "❌ Salon introuvable. Reconfigure le salon.", ephemeral: true });
      }

      let msg = null;
      if (settings.message_id) {
        msg = await channel.messages.fetch(settings.message_id).catch(() => null);
      }

      if (msg) {
        await msg.edit({ embeds: [embed] });
      } else {
        const sent = await channel.send({ embeds: [embed] });
        await db.upsertSettings(guildId, { message_id: sent.id });
      }

      return interaction.reply({ content: "✅ Hiérarchie publiée / mise à jour.", ephemeral: true });
    }
  },
};