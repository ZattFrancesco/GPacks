const {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const { isOwner } = require("../src/utils/permissions");
const db = require("../services/hierarchy.db");
const { buildHierarchyEmbed } = require("../src/utils/hierarchyEmbed");

function tiersSelect(tiers, customId, placeholder) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .setMinValues(1)
    .setMaxValues(1);

  if (!tiers.length) {
    menu.addOptions({ label: "Aucun palier", value: "none" });
    menu.setDisabled(true);
    return new ActionRowBuilder().addComponents(menu);
  }

  for (const t of tiers) {
    menu.addOptions({
      label: `#${t.tier_index} — ${t.name}`,
      value: String(t.id),
      description: (t.description || "").slice(0, 90) || undefined,
    });
  }

  return new ActionRowBuilder().addComponents(menu);
}

async function refreshPanel(interaction) {
  const settings = (await db.getSettings(interaction.guildId)) || {};
  const tiers = await db.getTierRoles(interaction.guildId);
  const embed = buildHierarchyEmbed({ guild: interaction.guild, settings, tiers });

  return interaction.editReply({
    embeds: [embed],
    components: interaction.message.components,
  });
}

module.exports = {
  id: "hier:action",

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: "❌ Réservé à l’owner.", flags: 64 });
    }

    const action = interaction.values?.[0];
    const guildId = interaction.guildId;

    const tiers = await db.listTiers(guildId);

    // 1) ADD tier => modal
    if (action === "tier_add") {
      const modal = new ModalBuilder().setCustomId("hier:modal_tier_add").setTitle("Ajouter un palier");

      const name = new TextInputBuilder()
        .setCustomId("name")
        .setLabel("Nom du palier")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(64)
        .setRequired(true);

      const desc = new TextInputBuilder()
        .setCustomId("desc")
        .setLabel("Description (optionnel)")
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(256)
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(name),
        new ActionRowBuilder().addComponents(desc)
      );

      return interaction.showModal(modal);
    }

    // 2) EDIT tier meta => select tier then modal
    if (action === "tier_edit") {
      return interaction.reply({
        content: "Choisis le palier à modifier :",
        components: [tiersSelect(tiers, "hier:pick_tier_edit", "Choisir un palier")],
        flags: 64,
      });
    }

    // 3) DELETE tier => select tier
    if (action === "tier_delete") {
      return interaction.reply({
        content: "Choisis le palier à supprimer :",
        components: [tiersSelect(tiers, "hier:pick_tier_delete", "Choisir un palier")],
        flags: 64,
      });
    }

    // 4) MOVE tier => select tier then choose direction with buttons
    if (action === "tier_move") {
      return interaction.reply({
        content: "Choisis le palier à déplacer :",
        components: [tiersSelect(tiers, "hier:pick_tier_move", "Choisir un palier")],
        flags: 64,
      });
    }

    // 5) Roles for tier => select tier then role select menu
    if (action === "tier_roles") {
      return interaction.reply({
        content: "Choisis le palier auquel tu veux définir les rôles :",
        components: [tiersSelect(tiers, "hier:pick_tier_roles", "Choisir un palier")],
        flags: 64,
      });
    }

    // 6) Meta embed => modal
    if (action === "meta") {
      const modal = new ModalBuilder().setCustomId("hier:modal_meta").setTitle("Embed hiérarchie");

      const title = new TextInputBuilder()
        .setCustomId("title")
        .setLabel("Titre (optionnel)")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(128)
        .setRequired(false);

      const color = new TextInputBuilder()
        .setCustomId("color")
        .setLabel("Couleur HEX (ex: #ffcc00) (optionnel)")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(16)
        .setRequired(false);

      const footer = new TextInputBuilder()
        .setCustomId("footer")
        .setLabel("Footer (optionnel)")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(128)
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(title),
        new ActionRowBuilder().addComponents(color),
        new ActionRowBuilder().addComponents(footer)
      );

      return interaction.showModal(modal);
    }

    // 7) Channel select
    if (action === "channel") {
      const channelMenu = new ChannelSelectMenuBuilder()
        .setCustomId("hier:pick_channel")
        .setPlaceholder("Choisir le salon de publication")
        .addChannelTypes(ChannelType.GuildText)
        .setMinValues(1)
        .setMaxValues(1);

      return interaction.reply({
        content: "Choisis le salon où le bot publie l’embed hiérarchie :",
        components: [new ActionRowBuilder().addComponents(channelMenu)],
        flags: 64,
      });
    }

    // 8) Publish
    if (action === "publish") {
      // On déclenche la même logique que /hiérarchie publish, mais depuis le panel
      const settings = (await db.getSettings(guildId)) || {};
      if (!settings.channel_id) {
        return interaction.reply({ content: "❌ Aucun salon configuré (action 'Choisir le salon').", flags: 64 });
      }

      const fullTiers = await db.getTierRoles(guildId);
      const embed = buildHierarchyEmbed({ guild: interaction.guild, settings, tiers: fullTiers });

      const channel = await interaction.guild.channels.fetch(settings.channel_id).catch(() => null);
      if (!channel) return interaction.reply({ content: "❌ Salon introuvable.", flags: 64 });

      let msg = null;
      if (settings.message_id) msg = await channel.messages.fetch(settings.message_id).catch(() => null);

      if (msg) {
        await msg.edit({ embeds: [embed] });
      } else {
        const sent = await channel.send({ embeds: [embed] });
        await db.upsertSettings(guildId, { message_id: sent.id });
      }

      return interaction.reply({ content: "✅ Publié / mis à jour.", flags: 64 });
    }

    // fallback
    return interaction.deferUpdate();
  },
};