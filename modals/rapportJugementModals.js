const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');

const { getDraft, updateDraft, clearDraft } = require('../src/utils/rjDrafts');
const { parseJudgementDate, formatRapportJugement } = require('../src/utils/rapportJugementFormat');
const {
  ensureTables,
  insertReport,
} = require('../services/rapportJugement.db');

// petit helper pour éviter les crash si champ absent
function safeVal(interaction, id) {
  try {
    return interaction.fields.getTextInputValue(id);
  } catch {
    return null;
  }
}

module.exports = {
  idPrefix: 'rj:',

  async execute(interaction) {
    const [prefix, step, userId] = interaction.customId.split(':');

    if (interaction.user.id !== userId) {
      return interaction.reply({
        content: "❌ Ce formulaire ne t'appartient pas.",
        ephemeral: true,
      });
    }

    // Assure DB
    await ensureTables();

    // STEP 1
    if (step === 'step1') {
      const nom = safeVal(interaction, 'nom');
      const prenom = safeVal(interaction, 'prenom');
      const dateJugementRaw = safeVal(interaction, 'dateJugement');

      updateDraft(userId, {
        nom,
        prenom,
        dateJugementRaw,
      });

      const modal = new ModalBuilder()
        .setCustomId(`rj:step2:${userId}`)
        .setTitle('Rapport jugement - Étape 2/3');

      const juge = new TextInputBuilder()
        .setCustomId('juge')
        .setLabel('Juge')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const procureur = new TextInputBuilder()
        .setCustomId('procureur')
        .setLabel('Procureur')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const avocat = new TextInputBuilder()
        .setCustomId('avocat')
        .setLabel('Avocat')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(juge),
        new ActionRowBuilder().addComponents(procureur),
        new ActionRowBuilder().addComponents(avocat)
      );

      return interaction.showModal(modal);
    }

    // STEP 2
    if (step === 'step2') {
      const juge = safeVal(interaction, 'juge');
      const procureur = safeVal(interaction, 'procureur');
      const avocat = safeVal(interaction, 'avocat');

      updateDraft(userId, { juge, procureur, avocat });

      const modal = new ModalBuilder()
        .setCustomId(`rj:step3:${userId}`)
        .setTitle('Rapport jugement - Étape 3/3');

      const peine = new TextInputBuilder()
        .setCustomId('peine')
        .setLabel('Peine')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const amende = new TextInputBuilder()
        .setCustomId('amende')
        .setLabel('Amende')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      const tig = new TextInputBuilder()
        .setCustomId('tig')
        .setLabel('T.I.G. (oui/non)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('oui ou non');

      const tigEntreprise = new TextInputBuilder()
        .setCustomId('tigEntreprise')
        .setLabel('Entreprise T.I.G. (si oui)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      const observation = new TextInputBuilder()
        .setCustomId('observation')
        .setLabel('Observation')
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

    // STEP 3 (final)
    if (step === 'step3') {
      const peine = safeVal(interaction, 'peine');
      const amende = safeVal(interaction, 'amende');
      const tigRaw = safeVal(interaction, 'tig');
      const tigEntreprise = safeVal(interaction, 'tigEntreprise');
      const observation = safeVal(interaction, 'observation');

      const draft = getDraft(userId);
      if (!draft) {
        return interaction.reply({
          content: "❌ Brouillon expiré (15 min). Relance /rapport-jugement.",
          ephemeral: true,
        });
      }

      const tig = (tigRaw || '').trim().toLowerCase();
      const tigBool = tig === 'oui' || tig === 'o' || tig === 'yes' || tig === 'y';

      const dateJugement = parseJudgementDate(draft.dateJugementRaw);

      const payload = {
        guildId: interaction.guildId,
        reporterUserId: interaction.user.id,

        nom: draft.nom,
        prenom: draft.prenom,
        dateJugement,

        juge: draft.juge,
        procureur: draft.procureur,
        avocat: draft.avocat,

        peine,
        amende,
        tig: tigBool ? 1 : 0,
        tigEntreprise: tigEntreprise || '/',
        observation,
      };

      // Post message rapport
      const content = formatRapportJugement(payload);
      await interaction.reply({ content });

      // Save DB
      await insertReport(payload);

      // Clear draft
      clearDraft(userId);

      return;
    }
  },
};