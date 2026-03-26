const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const { getType, updateType, listTypes } = require("../services/tickets.db");
const { buildTypeEditView } = require("../src/utils/ticketTypeEditView");
const { refreshPanelsUsingType } = require("../src/utils/refreshTicketPanels");
const { setTypeCreateDraft } = require("../src/utils/ticketDrafts");
const { setTypeEditSession } = require("../src/utils/ticketTypeEditSessions");

function buildBackRow(typeId) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`tickettype:edit:field:${typeId}`)
    .setPlaceholder("Que veux-tu modifier ?")
    .addOptions(
      { label: "Label", value: "label", emoji: "🏷️" },
      { label: "Emoji", value: "emoji", emoji: "😄" },
      { label: "Catégorie d'ouverture", value: "category", emoji: "🗂️" },
      { label: "Rôles staff", value: "roles", emoji: "👮" },
      { label: "Ping à l'ouverture", value: "openping", emoji: "📣" },
      { label: "nameModalRename", value: "namemodalrename", emoji: "🧑‍💼" },
      { label: "Custom embed", value: "customembed", emoji: "📝" }
    );

  return new ActionRowBuilder().addComponents(menu);
}

module.exports = {
  idPrefix: "tickettype:edit:",
  async execute(interaction) {
    const guildId = interaction.guildId;
    const customId = String(interaction.customId || "");
    const parts = customId.split(":");

    const kind = parts[2] || null;
    const typeId = parts.slice(3).join(":").trim();

    console.log("[tickettype:edit] customId =", customId);
    console.log("[tickettype:edit] kind =", kind, "| typeId =", typeId, "| guildId =", guildId);

    if (!guildId || !kind || !typeId) {
      return interaction.reply({ content: "❌ Identifiant invalide.", flags: 64 });
    }

    const type = await getType(guildId, typeId);
    if (!type) {
      const allTypes = await listTypes(guildId).catch(() => []);
      console.log("[tickettype:edit] type introuvable. Types dispo =", (allTypes || []).map((t) => t.id));
      return interaction.reply({ content: `❌ Type introuvable.
ID reçu: \`${typeId}\``, flags: 64 });
    }

    // 1) Menu principal : choisir le champ
    if (kind === "field") {
      const choice = interaction.values?.[0];
      if (!choice) {
        return interaction.reply({ content: "❌ Choix invalide.", flags: 64 });
      }

      // --- label / emoji => modal
      if (choice === "label" || choice === "emoji") {
        setTypeEditSession({
          guildId,
          userId: interaction.user.id,
          typeId: type.id,
          field: choice,
          channelId: interaction.channelId || interaction.channel?.id || null,
          messageId: interaction.message?.id || null,
        });
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

      // --- openping => role select (1) + bouton pour retirer
      if (choice === "openping") {
        const embed = new EmbedBuilder()
          .setTitle(`📣 Ping à l'ouverture — ${type.id}`)
          .setDescription(
            "Choisis **1 rôle** à ping quand un ticket de ce type s'ouvre.\n\n" +
              "➡️ Si tu veux enlever le ping, clique **Aucun ping**."
          )
          .setFooter({ text: `Type ID: ${type.id}` });

        const picker = new RoleSelectMenuBuilder()
          .setCustomId(`tickettype:edit:openping:${type.id}`)
          .setPlaceholder("Choisir le rôle à ping")
          .setMinValues(1)
          .setMaxValues(5);

        const clearBtn = new ButtonBuilder()
          .setCustomId(`tickettype:edit:toggle:${type.id}:openping:0`)
          .setLabel("Aucun ping")
          .setStyle(ButtonStyle.Secondary);

        return interaction.update({
          embeds: [embed],
          components: [
            new ActionRowBuilder().addComponents(picker),
            new ActionRowBuilder().addComponents(clearBtn),
            buildBackRow(type.id),
          ],
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
          openPingRoleId: type.open_ping_role_id || null,
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

      return interaction.reply({ content: "❌ Choix non géré.", flags: 64 });
    }

    // 2) Category selection
    if (kind === "category") {
      const catId = interaction.values?.[0];
      await updateType(guildId, type.id, { category_opened_id: catId || null });
      await refreshPanelsUsingType(interaction.guild, type.id);
      const fresh = await getType(guildId, type.id);
      const view = buildTypeEditView(interaction.guild, fresh);
      return interaction.update({ ...view });
    }

    // 3) Roles selection
    if (kind === "roles") {
      const roleIds = (interaction.values || []).filter(Boolean);
      await updateType(guildId, type.id, { staff_role_ids_json: JSON.stringify(roleIds) });
      await refreshPanelsUsingType(interaction.guild, type.id);
      const fresh = await getType(guildId, type.id);
      const view = buildTypeEditView(interaction.guild, fresh);
      return interaction.update({ ...view });
    }

    // 4) Open ping role selection
    if (kind === "openping") {
      const roleId = interaction.values?.[0] || null;
      await updateType(guildId, type.id, { open_ping_role_id: roleId });
      await refreshPanelsUsingType(interaction.guild, type.id);
      const fresh = await getType(guildId, type.id);
      const view = buildTypeEditView(interaction.guild, fresh);
      return interaction.update({ ...view });
    }

    return interaction.reply({ content: "❌ Action inconnue.", flags: 64 });
  },
};
