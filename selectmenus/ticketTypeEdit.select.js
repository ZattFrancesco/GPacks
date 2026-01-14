const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
} = require("discord.js");

const { getType, updateType } = require("../services/tickets.db");
const { buildTypeEditView } = require("../src/utils/ticketTypeEditView");
const { setTypeCreateDraft } = require("../src/utils/ticketDrafts");

function buildBackRow(typeId) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`tickettype:edit:field:${typeId}`)
    .setPlaceholder("Que veux-tu modifier ?")
    .addOptions(
      { label: "Label", value: "label", emoji: "🏷️" },
      { label: "Emoji", value: "emoji", emoji: "😄" },
      { label: "Catégorie d'ouverture", value: "category", emoji: "🗂️" },
      { label: "Rôles staff", value: "roles", emoji: "👮" },
      { label: "nameModalRename", value: "namemodalrename", emoji: "🧑‍💼" },
      { label: "Custom embed", value: "customembed", emoji: "📝" }
    );

  return new ActionRowBuilder().addComponents(menu);
}

module.exports = {
  idPrefix: "tickettype:edit:",
  async execute(interaction) {
    const guildId = interaction.guildId;
    const parts = String(interaction.customId).split(":");

    // tickettype:edit:field:<typeId>
    // tickettype:edit:category:<typeId>
    // tickettype:edit:roles:<typeId>
    const kind = parts[2];
    const typeId = parts[3];

    const type = await getType(guildId, typeId);
    if (!type) {
      return interaction.reply({ content: "❌ Type introuvable.", ephemeral: true });
    }

    // 1) Menu principal : choisir le champ
    if (kind === "field") {
      const choice = interaction.values?.[0];
      if (!choice) {
        return interaction.reply({ content: "❌ Choix invalide.", ephemeral: true });
      }

      // --- label / emoji => modal
      if (choice === "label" || choice === "emoji") {
        const modal = require("../modals/ticketTypeEdit.modals");
        return interaction.showModal(modal.build(type, choice));
      }

      // --- category => channel select
      if (choice === "category") {
        const embed = new EmbedBuilder()
          .setTitle(`🗂️ Modifier la catégorie — ${type.id}`)
          .setDescription("Choisis la catégorie où les tickets de ce type seront créés.")
          .setFooter({ text: `Type ID: ${type.id}` });

        const picker = new ChannelSelectMenuBuilder()
          .setCustomId(`tickettype:edit:category:${type.id}`)
          .setPlaceholder("Choisir une catégorie")
          .setMinValues(1)
          .setMaxValues(1)
          .addChannelTypes(ChannelType.GuildCategory);

        return interaction.update({
          embeds: [embed],
          components: [new ActionRowBuilder().addComponents(picker), buildBackRow(type.id)],
        });
      }

      // --- roles => role select multi
      if (choice === "roles") {
        const embed = new EmbedBuilder()
          .setTitle(`👮 Modifier les rôles staff — ${type.id}`)
          .setDescription("Sélectionne un ou plusieurs rôles staff.")
          .setFooter({ text: `Type ID: ${type.id}` });

        const picker = new RoleSelectMenuBuilder()
          .setCustomId(`tickettype:edit:roles:${type.id}`)
          .setPlaceholder("Choisir les rôles staff")
          .setMinValues(1)
          .setMaxValues(10);

        return interaction.update({
          embeds: [embed],
          components: [new ActionRowBuilder().addComponents(picker), buildBackRow(type.id)],
        });
      }

      // --- namemodalrename => passer par les boutons déjà affichés sur dashboard
      if (choice === "namemodalrename") {
        const view = buildTypeEditView(interaction.guild, type);
        return interaction.update({ ...view });
      }

      // --- customembed => modal existant (avec draft)
      if (choice === "customembed") {
        setTypeCreateDraft(guildId, interaction.user.id, {
          id: type.id,
          label: type.label,
          emoji: type.emoji,
          nameModalRename: Boolean(type.namemodalrename),
          categoryOpenedId: type.category_opened_id || null,
          staffRoleIds: type.staff_role_ids || [],
          customEmbedEnabled: true,
          editMode: true,
        });

        const modal = require("../modals/ticketTypeCustomEmbed.modal");
        return interaction.showModal(
          modal.build({
            title: type.custom_embed_title || "",
            description: type.custom_embed_description || "",
            enabled: Boolean(type.custom_embed_enabled),
          })
        );
      }

      return interaction.reply({ content: "❌ Choix non géré.", ephemeral: true });
    }

    // 2) Category selection
    if (kind === "category") {
      const catId = interaction.values?.[0];
      await updateType(guildId, type.id, { category_opened_id: catId || null });
      const fresh = await getType(guildId, type.id);
      const view = buildTypeEditView(interaction.guild, fresh);
      return interaction.update({ ...view });
    }

    // 3) Roles selection
    if (kind === "roles") {
      const roleIds = (interaction.values || []).filter(Boolean);
      await updateType(guildId, type.id, { staff_role_ids_json: JSON.stringify(roleIds) });
      const fresh = await getType(guildId, type.id);
      const view = buildTypeEditView(interaction.guild, fresh);
      return interaction.update({ ...view });
    }

    return interaction.reply({ content: "❌ Action inconnue.", ephemeral: true });
  },
};
