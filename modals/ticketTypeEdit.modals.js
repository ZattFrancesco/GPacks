const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");

const { getType, updateType, listTypes } = require("../services/tickets.db");
const { buildTypeEditView } = require("../src/utils/ticketTypeEditView");
const { refreshPanelsUsingType } = require("../src/utils/refreshTicketPanels");

function build(type, field) {
  const modal = new ModalBuilder().setCustomId(`tickettype:edit:modal:${type.id}:${field}`);

  if (field === "label") {
    modal.setTitle(`Modifier le label — ${type.id}`);
    const input = new TextInputBuilder()
      .setCustomId("label")
      .setLabel("Nouveau label")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(80)
      .setValue(String(type.label || ""));
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
  }

  // emoji
  modal.setTitle(`Modifier l'emoji — ${type.id}`);
  const input = new TextInputBuilder()
    .setCustomId("emoji")
    .setLabel("Emoji (vide = enlever)")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(32)
    .setValue(String(type.emoji || ""));
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

module.exports = {
  idPrefix: "tickettype:edit:modal:",

  build,

  async execute(interaction) {
    const guildId = interaction.guildId;
    const customId = String(interaction.customId || "");
    const parts = customId.split(":");
    const field = parts[parts.length - 1] || null;
    const typeId = parts.slice(3, -1).join(":").trim();

    console.log("[tickettype:edit:modal] customId =", customId);
    console.log("[tickettype:edit:modal] field =", field, "| typeId =", typeId, "| guildId =", guildId);

    if (!guildId || !field || !typeId) {
      return interaction.reply({ content: "❌ Identifiant invalide.", flags: 64 });
    }

    const type = await getType(guildId, typeId);
    if (!type) {
      const allTypes = await listTypes(guildId).catch(() => []);
      console.log("[tickettype:edit:modal] type introuvable. Types dispo =", (allTypes || []).map((t) => t.id));
      return interaction.reply({ content: `❌ Type introuvable.
ID reçu: \`${typeId}\``, flags: 64 });
    }

    if (field === "label") {
      const label = interaction.fields.getTextInputValue("label")?.trim();
      if (!label) return interaction.reply({ content: "❌ Label invalide.", flags: 64 });
      await updateType(guildId, type.id, { label });
      await refreshPanelsUsingType(interaction.guild, type.id);
    } else if (field === "emoji") {
      const emoji = (interaction.fields.getTextInputValue("emoji") || "").trim();
      await updateType(guildId, type.id, { emoji: emoji || null });
      await refreshPanelsUsingType(interaction.guild, type.id);
    } else {
      return interaction.reply({ content: "❌ Champ non géré.", flags: 64 });
    }

    const fresh = await getType(guildId, type.id);
    const view = buildTypeEditView(interaction.guild, fresh);
    return interaction.reply({ ...view, flags: 64 });
  },
};
