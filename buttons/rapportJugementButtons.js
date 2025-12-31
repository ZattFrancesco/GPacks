// buttons/rapportJugementButtons.js

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const { getDraft, clearDraft } = require("../src/utils/rjDrafts");

function panel(ownerId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`rjbtn:continue:${ownerId}`)
        .setLabel("➡️ Continuer")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`rjbtn:cancel:${ownerId}`)
        .setLabel("❌ Annuler")
        .setStyle(ButtonStyle.Danger)
    ),
  ];
}

module.exports = {
  idPrefix: "rjbtn:",
  panel,

  async execute(interaction) {
    const [, action, ownerId] = interaction.customId.split(":");

    if (interaction.user.id !== ownerId) {
      return interaction.reply({ content: "❌ Pas ton rapport.", ephemeral: true });
    }

    if (action === "cancel") {
      clearDraft(interaction.guildId, ownerId);
      return interaction.update({ content: "✅ Rapport annulé.", components: [] });
    }

    const draft = getDraft(interaction.guildId, ownerId);
    if (!draft) {
      return interaction.reply({
        content: "⏱️ Rapport expiré (15 min). Relance /rapport-jugement.",
        ephemeral: true,
      });
    }

    if (action === "continue") {
      // ✅ On exige au moins 1 juge + 1 proc
      const jugeIds = Array.isArray(draft.jugeIds) ? draft.jugeIds : [];
      const procIds = Array.isArray(draft.procIds) ? draft.procIds : [];
      const avocatIds = Array.isArray(draft.avocatIds) ? draft.avocatIds : []; // facultatif

      if (jugeIds.length === 0) {
        return interaction.reply({ content: "❌ Tu dois choisir au moins 1 juge.", ephemeral: true });
      }
      if (procIds.length === 0) {
        return interaction.reply({ content: "❌ Tu dois choisir au moins 1 procureur.", ephemeral: true });
      }
      // avocatIds peut être vide => OK

      const modal = new ModalBuilder()
        .setCustomId(`rj:step3:${ownerId}`)
        .setTitle("Rapport jugement - Sanctions");

      const peine = new TextInputBuilder()
        .setCustomId("peine")
        .setLabel("Peine")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const amende = new TextInputBuilder()
        .setCustomId("amende")
        .setLabel("Amende")
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      const tig = new TextInputBuilder()
        .setCustomId("tig")
        .setLabel("T.I.G. (oui/non)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const tigEntreprise = new TextInputBuilder()
        .setCustomId("tigEntreprise")
        .setLabel("Entreprise T.I.G.")
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      const observation = new TextInputBuilder()
        .setCustomId("observation")
        .setLabel("Observation")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(peine),
        new ActionRowBuilder().addComponents(amende),
        new ActionRowBuilder().addComponents(tig),
        new ActionRowBuilder().addComponents(tigEntreprise),
        new ActionRowBuilder().addComponents(observation)
      );

      return interaction.showModal(modal);
    }
  },
};