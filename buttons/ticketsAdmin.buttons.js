const { deleteType, getPanel, deletePanel, listPanels, listTypes, createType, createPanel } = require("../services/tickets.db");
const { buildHomeView, buildTypesListView, buildPanelsListView, buildTypeCreateView, buildPanelCreateView } = require("../src/utils/ticketsAdminDashboard");
const { getDefaultTypeDraft, getDefaultPanelDraft, setTypeAdminDraft, getTypeAdminDraft, clearTypeAdminDraft, setPanelAdminDraft, getPanelAdminDraft, clearPanelAdminDraft } = require("../src/utils/ticketsAdminDrafts");
const { buildTypeEditView } = require("../src/utils/ticketTypeEditView");
const { buildPanelEmbed, buildPanelComponents } = require("../src/utils/ticketViews");

function parseColor(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  const hex = s.startsWith("#") ? s.slice(1) : s;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return parseInt(hex, 16);
}

async function buildHome(interaction) {
  const [types, panels] = await Promise.all([listTypes(interaction.guildId), listPanels(interaction.guildId)]);
  return buildHomeView(interaction.guild, { typeCount: types.length, panelCount: panels.length });
}

module.exports = {
  idPrefix: "ticketsadmin:",
  async execute(interaction) {
    const cid = String(interaction.customId || "");
    const guildId = interaction.guildId;

    if (cid === "ticketsadmin:home" || cid === "ticketsadmin:refresh") {
      return interaction.update(await buildHome(interaction));
    }

    if (cid === "ticketsadmin:nav:types") {
      const types = await listTypes(guildId);
      return interaction.update(buildTypesListView(types));
    }

    if (cid === "ticketsadmin:nav:panels") {
      const panels = await listPanels(guildId);
      return interaction.update(buildPanelsListView(panels));
    }

    if (cid === "ticketsadmin:type:create:start") {
      const draft = setTypeAdminDraft(guildId, interaction.user.id, getDefaultTypeDraft());
      return interaction.update(buildTypeCreateView(interaction.guild, draft));
    }

    if (cid === "ticketsadmin:type:create:toggleRename") {
      const current = getTypeAdminDraft(guildId, interaction.user.id) || getDefaultTypeDraft();
      const draft = setTypeAdminDraft(guildId, interaction.user.id, { nameModalRename: !current.nameModalRename });
      return interaction.update(buildTypeCreateView(interaction.guild, draft));
    }

    if (cid === "ticketsadmin:type:create:clearopenping") {
      const draft = setTypeAdminDraft(guildId, interaction.user.id, { openPingRoleId: null });
      return interaction.update(buildTypeCreateView(interaction.guild, draft));
    }

    if (cid === "ticketsadmin:type:create:general") {
      const modal = require("../modals/ticketsAdmin.modals").buildTypeGeneralModal(getTypeAdminDraft(guildId, interaction.user.id) || getDefaultTypeDraft());
      return interaction.showModal(modal);
    }

    if (cid === "ticketsadmin:type:create:customembed") {
      const modal = require("../modals/ticketsAdmin.modals").buildTypeCustomEmbedModal(getTypeAdminDraft(guildId, interaction.user.id) || getDefaultTypeDraft());
      return interaction.showModal(modal);
    }

    if (cid === "ticketsadmin:type:create:save") {
      const draft = getTypeAdminDraft(guildId, interaction.user.id);
      if (!draft?.id || !draft?.label || !draft?.categoryOpenedId || !draft?.staffRoleIds?.length) {
        return interaction.reply({ content: "❌ Il manque des infos: id, label, catégorie et au moins 1 rôle staff.", flags: 64 });
      }

      const finalId = await createType(guildId, {
        id: draft.id,
        label: draft.label,
        emoji: draft.emoji || null,
        nameModalRename: Boolean(draft.nameModalRename),
        categoryOpenedId: draft.categoryOpenedId,
        staffRoleIds: draft.staffRoleIds || [],
        openPingRoleId: draft.openPingRoleId || null,
        customEmbedEnabled: Boolean(draft.customEmbedEnabled),
        customEmbedTitle: draft.customEmbedEnabled ? draft.customEmbedTitle || null : null,
        customEmbedDescription: draft.customEmbedEnabled ? draft.customEmbedDescription || null : null,
      });

      clearTypeAdminDraft(guildId, interaction.user.id);
      const types = await listTypes(guildId);
      await interaction.update(buildTypesListView(types));
      return interaction.followUp({ content: `✅ Type **${finalId}** enregistré.`, flags: 64 });
    }

    if (cid === "ticketsadmin:panel:create:start") {
      const draft = setPanelAdminDraft(guildId, interaction.user.id, getDefaultPanelDraft());
      const allTypes = await listTypes(guildId);
      return interaction.update(buildPanelCreateView(interaction.guild, draft, allTypes));
    }

    if (cid === "ticketsadmin:panel:create:general") {
      const modal = require("../modals/ticketsAdmin.modals").buildPanelGeneralModal(getPanelAdminDraft(guildId, interaction.user.id) || getDefaultPanelDraft());
      return interaction.showModal(modal);
    }

    if (cid === "ticketsadmin:panel:create:style") {
      const modal = require("../modals/ticketsAdmin.modals").buildPanelStyleModal(getPanelAdminDraft(guildId, interaction.user.id) || getDefaultPanelDraft());
      return interaction.showModal(modal);
    }

    if (cid === "ticketsadmin:panel:create:clearrole") {
      const draft = setPanelAdminDraft(guildId, interaction.user.id, { requiredRoleId: null });
      const allTypes = await listTypes(guildId);
      return interaction.update(buildPanelCreateView(interaction.guild, draft, allTypes));
    }

    if (cid === "ticketsadmin:panel:create:save") {
      const draft = getPanelAdminDraft(guildId, interaction.user.id);
      const allTypes = await listTypes(guildId);
      if (!draft?.id || !draft?.channelId || !draft?.title || !draft?.description || !draft?.typeIds?.length) {
        return interaction.reply({ content: "❌ Il manque des infos: id, salon, titre, description et au moins 1 type.", flags: 64 });
      }

      const channel = await interaction.guild.channels.fetch(draft.channelId).catch(() => null);
      if (!channel || typeof channel.send !== "function") {
        return interaction.reply({ content: "❌ Salon invalide pour poster le panel.", flags: 64 });
      }

      const types = allTypes.filter((t) => draft.typeIds.includes(t.id));
      if (!types.length) {
        return interaction.reply({ content: "❌ Aucun type valide sélectionné pour ce panel.", flags: 64 });
      }

      const msg = await channel.send({
        embeds: [buildPanelEmbed({
          id: draft.id,
          title: draft.title,
          description: draft.description,
          color: draft.color,
          logo_url: draft.logoUrl,
          banner_url: draft.bannerUrl,
        })],
        components: buildPanelComponents({ panel: { id: draft.id, style: draft.style }, types }),
      });

      const finalId = await createPanel(guildId, {
        id: draft.id,
        channelId: draft.channelId,
        messageId: msg.id,
        title: draft.title,
        description: draft.description,
        color: draft.color,
        style: draft.style || "menu",
        requiredRoleId: draft.requiredRoleId || null,
        logoUrl: draft.logoUrl || null,
        bannerUrl: draft.bannerUrl || null,
        typeIds: draft.typeIds,
      });

      clearPanelAdminDraft(guildId, interaction.user.id);
      const panels = await listPanels(guildId);
      await interaction.update(buildPanelsListView(panels));
      return interaction.followUp({ content: `✅ Panel **${finalId}** posté dans <#${channel.id}>.`, flags: 64 });
    }

    if (cid === "ticketsadmin:type:delete:start") {
      return interaction.reply({ content: "Choisis le type à supprimer dans le menu de la vue actuelle.", flags: 64 });
    }

    if (cid === "ticketsadmin:panel:delete:start") {
      return interaction.reply({ content: "Choisis le panel à supprimer dans le menu de la vue actuelle.", flags: 64 });
    }
  },
};
