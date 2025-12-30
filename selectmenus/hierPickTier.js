const {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  RoleSelectMenuBuilder,
} = require("discord.js");

const { isOwner } = require("../src/utils/permissions");
const db = require("../services/hierarchy.db");

module.exports = [
  // EDIT -> open modal
  {
    id: "hier:pick_tier_edit",
    async execute(interaction) {
      if (!isOwner(interaction.user.id)) return interaction.reply({ content: "❌ Owner only.", ephemeral: true });

      const tierId = interaction.values?.[0];
      if (!tierId || tierId === "none") return interaction.reply({ content: "❌ Aucun palier.", ephemeral: true });

      const tiers = await db.listTiers(interaction.guildId);
      const tier = tiers.find(t => String(t.id) === String(tierId));
      if (!tier) return interaction.reply({ content: "❌ Palier introuvable.", ephemeral: true });

      const modal = new ModalBuilder().setCustomId(`hier:modal_tier_edit:${tier.id}`).setTitle("Modifier un palier");

      const name = new TextInputBuilder()
        .setCustomId("name")
        .setLabel("Nom du palier")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(64)
        .setRequired(true)
        .setValue(tier.name);

      const desc = new TextInputBuilder()
        .setCustomId("desc")
        .setLabel("Description (optionnel)")
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(256)
        .setRequired(false)
        .setValue(tier.description || "");

      modal.addComponents(new ActionRowBuilder().addComponents(name), new ActionRowBuilder().addComponents(desc));
      return interaction.showModal(modal);
    },
  },

  // DELETE -> directly delete
  {
    id: "hier:pick_tier_delete",
    async execute(interaction) {
      if (!isOwner(interaction.user.id)) return interaction.reply({ content: "❌ Owner only.", ephemeral: true });

      const tierId = interaction.values?.[0];
      if (!tierId || tierId === "none") return interaction.reply({ content: "❌ Aucun palier.", ephemeral: true });

      await db.deleteTier(interaction.guildId, tierId);
      return interaction.reply({ content: "✅ Palier supprimé.", ephemeral: true });
    },
  },

  // MOVE -> choose direction buttons
  {
    id: "hier:pick_tier_move",
    async execute(interaction) {
      if (!isOwner(interaction.user.id)) return interaction.reply({ content: "❌ Owner only.", ephemeral: true });

      const tierId = interaction.values?.[0];
      if (!tierId || tierId === "none") return interaction.reply({ content: "❌ Aucun palier.", ephemeral: true });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`hier:move_up:${tierId}`).setLabel("⬆️ Monter").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`hier:move_down:${tierId}`).setLabel("⬇️ Descendre").setStyle(ButtonStyle.Secondary)
      );

      return interaction.reply({ content: "Choisis le sens :", components: [row], ephemeral: true });
    },
  },

  // ROLES -> role select menu
  {
    id: "hier:pick_tier_roles",
    async execute(interaction) {
      if (!isOwner(interaction.user.id)) return interaction.reply({ content: "❌ Owner only.", ephemeral: true });

      const tierId = interaction.values?.[0];
      if (!tierId || tierId === "none") return interaction.reply({ content: "❌ Aucun palier.", ephemeral: true });

      const roleMenu = new RoleSelectMenuBuilder()
        .setCustomId(`hier:roles_for_tier:${tierId}`)
        .setPlaceholder("Sélectionne les rôles (multi)")
        .setMinValues(0)
        .setMaxValues(25);

      return interaction.reply({
        content: "Sélectionne les rôles qui appartiennent à ce palier :",
        components: [new ActionRowBuilder().addComponents(roleMenu)],
        ephemeral: true,
      });
    },
  },
];