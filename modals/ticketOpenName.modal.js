const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");

const { getOpenDraft, clearOpenDraft } = require("../src/utils/ticketDrafts");
const { getPanel, getType } = require("../services/tickets.db");
const { createTicketChannelAndMessages, ensureNick } = require("../src/utils/ticketOpen");

module.exports = {
  id: "ticketopen:name",

  build() {
    const modal = new ModalBuilder().setCustomId("ticketopen:name").setTitle("Ticket - Nom / Prénom");
    const prenom = new TextInputBuilder()
      .setCustomId("prenom")
      .setLabel("Prénom (RP)")
      .setRequired(true)
      .setStyle(TextInputStyle.Short)
      .setMaxLength(64);
    const nom = new TextInputBuilder()
      .setCustomId("nom")
      .setLabel("Nom (RP)")
      .setRequired(true)
      .setStyle(TextInputStyle.Short)
      .setMaxLength(64);

    modal.addComponents(new ActionRowBuilder().addComponents(prenom), new ActionRowBuilder().addComponents(nom));
    return modal;
  },

  async execute(interaction) {
    const guildId = interaction.guildId;
    const draft = getOpenDraft(guildId, interaction.user.id);
    if (!draft) {
      return interaction.reply({ content: "❌ Demande expirée. Recommence depuis le panel.", flags: 64 });
    }

    // IMPORTANT : un modal doit répondre en < 3s.
    // On defer tout de suite pour éviter DiscordAPIError[10062] (Unknown interaction)
    // si la création du salon / requêtes DB prennent trop de temps.
    await interaction.deferReply({ flags: 64 });

    const prenom = interaction.fields.getTextInputValue("prenom").trim();
    const nom = interaction.fields.getTextInputValue("nom").trim();
    clearOpenDraft(guildId, interaction.user.id);

    const panel = await getPanel(guildId, draft.panelId);
    const type = await getType(guildId, draft.typeId);
    if (!panel || !type) {
      return interaction.editReply({ content: "❌ Panel/type introuvable." });
    }

    // Change pseudo serveur (best effort)
    await ensureNick(interaction.guild, interaction.member, prenom, nom);

    // Crée le ticket
    await createTicketChannelAndMessages(interaction, {
      panel,
      type,
      nom,
      prenom,
      suffix: `${prenom}-${nom}`,
    });
  },
};
