const { getType, listTypes, listPanels, getPanel, deleteType, deletePanel } = require("../services/tickets.db");
const { buildTypesListView, buildPanelsListView, buildTypeCreateView, buildPanelCreateView } = require("../src/utils/ticketsAdminDashboard");
const { setTypeAdminDraft, getTypeAdminDraft, getDefaultTypeDraft, setPanelAdminDraft, getPanelAdminDraft, getDefaultPanelDraft } = require("../src/utils/ticketsAdminDrafts");
const { buildTypeEditView } = require("../src/utils/ticketTypeEditView");

function buildPanelEditMenu(panelId) {
  const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require("discord.js");
  const embed = new EmbedBuilder()
    .setTitle(`🛠️ Édition du panel: ${panelId}`)
    .setDescription("Choisis le champ à modifier dans le menu ci-dessous.\n\n*(Le panel Discord sera mis à jour automatiquement.)*");

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`ticketpanel:edit:field:${panelId}`)
      .setPlaceholder("Choisis ce que tu veux modifier…")
      .addOptions(
        { label: "Titre", value: "title", emoji: "📝" },
        { label: "Description", value: "description", emoji: "🧾" },
        { label: "Types autorisés", value: "types", emoji: "🎫" },
        { label: "Style (menu / boutons)", value: "style", emoji: "🧩" },
        { label: "Couleur", value: "color", emoji: "🎨" },
        { label: "Rôle requis", value: "required_role_id", emoji: "🔒" },
        { label: "Logo URL", value: "logo_url", emoji: "🖼️" },
        { label: "Banner URL", value: "banner_url", emoji: "🧱" }
      )
  );
  return { embeds: [embed], components: [row] };
}

module.exports = {
  idPrefix: "ticketsadmin:",
  async execute(interaction) {
    const cid = String(interaction.customId || "");
    const guildId = interaction.guildId;

    if (cid === "ticketsadmin:type:pick") {
      const typeId = interaction.values?.[0];
      const type = await getType(guildId, typeId);
      if (!type) return interaction.reply({ content: "❌ Type introuvable.", flags: 64 });
      return interaction.update(buildTypeEditView(interaction.guild, type));
    }

    if (cid === "ticketsadmin:type:delete:pick") {
      const typeId = interaction.values?.[0];
      await deleteType(guildId, typeId);
      const types = await listTypes(guildId);
      await interaction.update(buildTypesListView(types));
      return interaction.followUp({ content: `✅ Type **${typeId}** supprimé.`, flags: 64 });
    }

    if (cid === "ticketsadmin:panel:pick") {
      const panelId = interaction.values?.[0];
      const panel = await getPanel(guildId, panelId);
      if (!panel) return interaction.reply({ content: "❌ Panel introuvable.", flags: 64 });
      return interaction.update(buildPanelEditMenu(panel.id));
    }

    if (cid === "ticketsadmin:panel:delete:pick") {
      const panelId = interaction.values?.[0];
      const panel = await getPanel(guildId, panelId);
      if (panel) {
        try {
          const channel = await interaction.client.channels.fetch(panel.channel_id);
          const msg = await channel?.messages.fetch(panel.message_id);
          await msg?.delete().catch(() => {});
        } catch {}
      }
      await deletePanel(guildId, panelId);
      const panels = await listPanels(guildId);
      await interaction.update(buildPanelsListView(panels));
      return interaction.followUp({ content: `✅ Panel **${panelId}** supprimé.`, flags: 64 });
    }

    if (cid === "ticketsadmin:type:create:category") {
      const draft = setTypeAdminDraft(guildId, interaction.user.id, { categoryOpenedId: interaction.values?.[0] || null });
      return interaction.update(buildTypeCreateView(interaction.guild, draft));
    }

    if (cid === "ticketsadmin:type:create:roles") {
      const draft = setTypeAdminDraft(guildId, interaction.user.id, { staffRoleIds: interaction.values || [] });
      return interaction.update(buildTypeCreateView(interaction.guild, draft));
    }

    if (cid === "ticketsadmin:type:create:openping") {
      const draft = setTypeAdminDraft(guildId, interaction.user.id, { openPingRoleId: interaction.values?.[0] || null });
      return interaction.update(buildTypeCreateView(interaction.guild, draft));
    }

    if (cid === "ticketsadmin:panel:create:channel") {
      const draft = setPanelAdminDraft(guildId, interaction.user.id, { channelId: interaction.values?.[0] || null });
      const allTypes = await listTypes(guildId);
      return interaction.update(buildPanelCreateView(interaction.guild, draft, allTypes));
    }

    if (cid === "ticketsadmin:panel:create:types") {
      const draft = setPanelAdminDraft(guildId, interaction.user.id, { typeIds: interaction.values || [] });
      const allTypes = await listTypes(guildId);
      return interaction.update(buildPanelCreateView(interaction.guild, draft, allTypes));
    }

    if (cid === "ticketsadmin:panel:create:requiredrole") {
      const draft = setPanelAdminDraft(guildId, interaction.user.id, { requiredRoleId: interaction.values?.[0] || null });
      const allTypes = await listTypes(guildId);
      return interaction.update(buildPanelCreateView(interaction.guild, draft, allTypes));
    }
  },
};
