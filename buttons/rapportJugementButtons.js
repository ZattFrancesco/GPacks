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

function panel(ownerId, step) {
  const row = new ActionRowBuilder();

  if (step === 1) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`rjbtn:open2:${ownerId}`)
        .setLabel("➡️ Étape 2")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`rjbtn:cancel:${ownerId}`)
        .setLabel("❌ Annuler")
        .setStyle(ButtonStyle.Danger)
    );
  }

  if (step === 2) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`rjbtn:open3:${ownerId}`)
        .setLabel("➡️ Étape 3")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`rjbtn:cancel:${ownerId}`)
        .setLabel("❌ Annuler")
        .setStyle(ButtonStyle.Danger)
    );
  }

  return [row];
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

    // STEP 2 MODAL
    if (action === "open2") {
      const modal = new ModalBuilder()
        .setCustomId(`rj:step2:${ownerId}`)
        .setTitle("Rapport jugement - Étape 2/3");

      const juge = new TextInputBuilder().setCustomId("juge").setLabel("Juge").setStyle(TextInputStyle.Short).setRequired(true);
      const procureur = new TextInputBuilder().setCustomId("procureur").setLabel("Procureur").setStyle(TextInputStyle.Short).setRequired(true);
      const avocat = new TextInputBuilder().setCustomId("avocat").setLabel("Avocat").setStyle(TextInputStyle.Short).setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(juge),
        new ActionRowBuilder().addComponents(procureur),
        new ActionRowBuilder().addComponents(avocat)
      );

      return interaction.showModal(modal);
    }

    // STEP 3 MODAL
    if (action === "open3") {
      const modal = new ModalBuilder()
        .setCustomId(`rj:step3:${ownerId}`)
        .setTitle("Rapport jugement - Étape 3/3");

      const peine = new TextInputBuilder().setCustomId("peine").setLabel("Peine").setStyle(TextInputStyle.Paragraph).setRequired(false);
      const amende = new TextInputBuilder().setCustomId("amende").setLabel("Amende").setStyle(TextInputStyle.Short).setRequired(false);
      const tig = new TextInputBuilder().setCustomId("tig").setLabel("T.I.G. (oui/non)").setStyle(TextInputStyle.Short).setRequired(true);
      const tigEntreprise = new TextInputBuilder().setCustomId("tigEntreprise").setLabel("Entreprise T.I.G.").setStyle(TextInputStyle.Short).setRequired(false);
      const observation = new TextInputBuilder().setCustomId("observation").setLabel("Observation").setStyle(TextInputStyle.Paragraph).setRequired(false);

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