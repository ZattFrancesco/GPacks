const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");

const { getType, updateType } = require("../services/tickets.db");
const { buildTypeEditView } = require("../src/utils/ticketTypeEditView");

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
    const parts = String(interaction.customId).split(":");
    const typeId = parts[4];
    const field = parts[5];

    const type = await getType(guildId, typeId);
    if (!type) return interaction.reply({ content: "❌ Type introuvable.", ephemeral: true });

    if (field === "label") {
      const label = interaction.fields.getTextInputValue("label")?.trim();
      if (!label) return interaction.reply({ content: "❌ Label invalide.", ephemeral: true });
      await updateType(guildId, type.id, { label });
    } else if (field === "emoji") {
      const emoji = (interaction.fields.getTextInputValue("emoji") || "").trim();
      await updateType(guildId, type.id, { emoji: emoji || null });
    } else {
      return interaction.reply({ content: "❌ Champ non géré.", ephemeral: true });
    }

    const fresh = await getType(guildId, type.id);
    const view = buildTypeEditView(interaction.guild, fresh);
    return interaction.reply({ ...view, ephemeral: true });
  },
};
