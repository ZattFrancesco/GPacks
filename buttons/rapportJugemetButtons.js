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

// Petit helper
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
        .setStyle(ButtonStyle.Danger),
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
        .setStyle(ButtonStyle.Danger),
    );
  }

  return [row];
}

module.exports = {
  idPrefix: "rjbtn:",

  async execute(interaction) {
    const [prefix, action, ownerId] = interaction.customId.split(":");
    if (prefix !== "rjbtn") return;

    if (ownerId && interaction.user.id !== ownerId) {
      return interaction.reply({ content: "❌ Ce panneau ne t'appartient pas.", ephemeral: true });
    }

    const draft = getDraft(ownerId);
    if (!draft && action !== "cancel") {
      return interaction.reply({
        content: "⏱️ Ton rapport a expiré (15 min). Relance `/rapport-jugement`.",
        ephemeral: true,
      });
    }

    // Annuler
    if (action === "cancel") {
      clearDraft(ownerId);
      return interaction.update({ content: "✅ Rapport annulé.", components: [] });
    }

    // Ouvrir Modal Step2
    if (action === "open2") {
      const modal = new ModalBuilder()
        .setCustomId(`rj:step2:${ownerId}`)
        .setTitle("Rapport jugement - Étape 2/3");

      const juge = new TextInputBuilder()
        .setCustomId("juge")
        .setLabel("Juge")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const procureur = new TextInputBuilder()
        .setCustomId("procureur")
        .setLabel("Procureur")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const avocat = new TextInputBuilder()
        .setCustomId("avocat")
        .setLabel("Avocat")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(juge),
        new ActionRowBuilder().addComponents(procureur),
        new ActionRowBuilder().addComponents(avocat),
      );

      // NOTE: button interactions ont bien showModal()
      return interaction.showModal(modal);
    }

    // Ouvrir Modal Step3
    if (action === "open3") {
      const modal = new ModalBuilder()
        .setCustomId(`rj:step3:${ownerId}`)
        .setTitle("Rapport jugement - Étape 3/3");

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
        .setLabel("Entreprise T.I.G. (si oui)")
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
        new ActionRowBuilder().addComponents(observation),
      );

      return interaction.showModal(modal);
    }

    return interaction.reply({ content: "❌ Action inconnue.", ephemeral: true });
  },

  panel,
};