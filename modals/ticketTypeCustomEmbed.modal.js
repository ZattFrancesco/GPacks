const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");

const { getTypeCreateDraft, clearTypeCreateDraft } = require("../src/utils/ticketDrafts");
const { createType, updateType } = require("../services/tickets.db");

module.exports = {
  id: "tickettype:customembed",

  // options: { title, description, enabled }
  build(options = {}) {
    const modal = new ModalBuilder()
      .setCustomId("tickettype:customembed")
      .setTitle("Type - Custom Embed");

    const enabled = new TextInputBuilder()
      .setCustomId("enabled")
      .setLabel("Activer ? (oui/non)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(8)
      .setValue(options.enabled ? "oui" : "non");

    const t = new TextInputBuilder()
      .setCustomId("title")
      .setLabel("Titre")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(256)
      .setValue(String(options.title || "").slice(0, 256));

    const d = new TextInputBuilder()
      .setCustomId("description")
      .setLabel("Description")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(4000)
      .setValue(String(options.description || "").slice(0, 4000));

    modal.addComponents(
      new ActionRowBuilder().addComponents(enabled),
      new ActionRowBuilder().addComponents(t),
      new ActionRowBuilder().addComponents(d)
    );
    return modal;
  },

  async execute(interaction) {
    const guildId = interaction.guildId;
    const draft = getTypeCreateDraft(guildId, interaction.user.id);
    if (!draft) {
      return interaction.reply({ content: "❌ Demande expirée. Recommence la commande.", ephemeral: true });
    }

    const enabledRaw = interaction.fields.getTextInputValue("enabled");
    const enabled = ["1", "true", "yes", "oui", "on"].includes(String(enabledRaw || "").trim().toLowerCase());
    const title = interaction.fields.getTextInputValue("title") || null;
    const description = interaction.fields.getTextInputValue("description") || null;

    clearTypeCreateDraft(guildId, interaction.user.id);

    if (draft.editMode) {
      await updateType(guildId, draft.id, {
        custom_embed_enabled: enabled ? 1 : 0,
        custom_embed_title: enabled ? title : null,
        custom_embed_description: enabled ? description : null,
      });
      return interaction.reply({ content: "✅ Custom embed mis à jour.", ephemeral: true });
    }

    const finalId = await createType(guildId, {
      ...draft,
      customEmbedEnabled: enabled,
      customEmbedTitle: enabled ? title : null,
      customEmbedDescription: enabled ? description : null,
    });

    return interaction.reply({ content: `✅ Type **${finalId}** enregistré (custom embed).`, ephemeral: true });
  },
};
