const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
const { listTypes } = require("../services/tickets.db");
const { setTypeAdminDraft, getTypeAdminDraft, getDefaultTypeDraft, setPanelAdminDraft, getPanelAdminDraft, getDefaultPanelDraft } = require("../src/utils/ticketsAdminDrafts");
const { buildTypeCreateView, buildPanelCreateView } = require("../src/utils/ticketsAdminDashboard");

function buildTypeGeneralModal(draft = {}) {
  const modal = new ModalBuilder().setCustomId("ticketsadmin:type:create:general:modal").setTitle("Créer un type — infos");
  const id = new TextInputBuilder().setCustomId("id").setLabel("ID").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(64).setValue(String(draft.id || ""));
  const label = new TextInputBuilder().setCustomId("label").setLabel("Label").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80).setValue(String(draft.label || ""));
  const emoji = new TextInputBuilder().setCustomId("emoji").setLabel("Emoji (optionnel)").setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(32).setValue(String(draft.emoji || ""));
  modal.addComponents(new ActionRowBuilder().addComponents(id), new ActionRowBuilder().addComponents(label), new ActionRowBuilder().addComponents(emoji));
  return modal;
}

function buildTypeCustomEmbedModal(draft = {}) {
  const modal = new ModalBuilder().setCustomId("ticketsadmin:type:create:customembed:modal").setTitle("Créer un type — custom embed");
  const enabled = new TextInputBuilder().setCustomId("enabled").setLabel("Activer ? (oui/non)").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(8).setValue(draft.customEmbedEnabled ? "oui" : "non");
  const title = new TextInputBuilder().setCustomId("title").setLabel("Titre").setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(256).setValue(String(draft.customEmbedTitle || ""));
  const description = new TextInputBuilder().setCustomId("description").setLabel("Description").setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(4000).setValue(String(draft.customEmbedDescription || ""));
  modal.addComponents(new ActionRowBuilder().addComponents(enabled), new ActionRowBuilder().addComponents(title), new ActionRowBuilder().addComponents(description));
  return modal;
}

function buildPanelGeneralModal(draft = {}) {
  const modal = new ModalBuilder().setCustomId("ticketsadmin:panel:create:general:modal").setTitle("Créer un panel — infos");
  const id = new TextInputBuilder().setCustomId("id").setLabel("ID").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(64).setValue(String(draft.id || ""));
  const title = new TextInputBuilder().setCustomId("title").setLabel("Titre").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(256).setValue(String(draft.title || ""));
  const description = new TextInputBuilder().setCustomId("description").setLabel("Description").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(4000).setValue(String(draft.description || ""));
  modal.addComponents(new ActionRowBuilder().addComponents(id), new ActionRowBuilder().addComponents(title), new ActionRowBuilder().addComponents(description));
  return modal;
}

function buildPanelStyleModal(draft = {}) {
  const modal = new ModalBuilder().setCustomId("ticketsadmin:panel:create:style:modal").setTitle("Créer un panel — style");
  const style = new TextInputBuilder().setCustomId("style").setLabel("Style (menu ou boutons)").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(16).setValue(String(draft.style || "menu"));
  const color = new TextInputBuilder().setCustomId("color").setLabel("Couleur (nombre ou #RRGGBB)").setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(16).setValue(draft.color === null || draft.color === undefined ? "" : String(draft.color));
  const assets = new TextInputBuilder().setCustomId("assets").setLabel("LogoURL ; BannerURL").setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(4000).setValue(`${draft.logoUrl || ""} ; ${draft.bannerUrl || ""}`.trim());
  modal.addComponents(new ActionRowBuilder().addComponents(style), new ActionRowBuilder().addComponents(color), new ActionRowBuilder().addComponents(assets));
  return modal;
}

function parseColor(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  const hex = s.startsWith("#") ? s.slice(1) : s;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return parseInt(hex, 16);
}

module.exports = {
  idPrefix: "ticketsadmin:",
  buildTypeGeneralModal,
  buildTypeCustomEmbedModal,
  buildPanelGeneralModal,
  buildPanelStyleModal,
  async execute(interaction) {
    const cid = String(interaction.customId || "");
    const guildId = interaction.guildId;

    if (cid === "ticketsadmin:type:create:general:modal") {
      const draft = setTypeAdminDraft(guildId, interaction.user.id, {
        id: interaction.fields.getTextInputValue("id")?.trim(),
        label: interaction.fields.getTextInputValue("label")?.trim(),
        emoji: interaction.fields.getTextInputValue("emoji")?.trim() || null,
      });
      return interaction.reply({ ...buildTypeCreateView(interaction.guild, draft), flags: 64 });
    }

    if (cid === "ticketsadmin:type:create:customembed:modal") {
      const enabledRaw = interaction.fields.getTextInputValue("enabled")?.trim().toLowerCase();
      const enabled = ["1", "true", "yes", "oui", "on"].includes(enabledRaw);
      const draft = setTypeAdminDraft(guildId, interaction.user.id, {
        customEmbedEnabled: enabled,
        customEmbedTitle: enabled ? interaction.fields.getTextInputValue("title")?.trim() || null : null,
        customEmbedDescription: enabled ? interaction.fields.getTextInputValue("description")?.trim() || null : null,
      });
      return interaction.reply({ ...buildTypeCreateView(interaction.guild, draft), flags: 64 });
    }

    if (cid === "ticketsadmin:panel:create:general:modal") {
      const draft = setPanelAdminDraft(guildId, interaction.user.id, {
        id: interaction.fields.getTextInputValue("id")?.trim(),
        title: interaction.fields.getTextInputValue("title")?.trim(),
        description: interaction.fields.getTextInputValue("description")?.trim(),
      });
      const allTypes = await listTypes(guildId);
      return interaction.reply({ ...buildPanelCreateView(interaction.guild, draft, allTypes), flags: 64 });
    }

    if (cid === "ticketsadmin:panel:create:style:modal") {
      const rawStyle = interaction.fields.getTextInputValue("style")?.trim().toLowerCase();
      const style = rawStyle === "boutons" || rawStyle === "buttons" ? "boutons" : "menu";
      const assets = interaction.fields.getTextInputValue("assets") || "";
      const [logoRaw, bannerRaw] = assets.split(";");
      const draft = setPanelAdminDraft(guildId, interaction.user.id, {
        style,
        color: parseColor(interaction.fields.getTextInputValue("color")),
        logoUrl: logoRaw?.trim() || null,
        bannerUrl: bannerRaw?.trim() || null,
      });
      const allTypes = await listTypes(guildId);
      return interaction.reply({ ...buildPanelCreateView(interaction.guild, draft, allTypes), flags: 64 });
    }
  },
};
