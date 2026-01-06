// selectmenus/visaSelects.js

const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");

const { updateVisaDraft, getVisaDraft } = require("../src/utils/visaDrafts");
const { statutLabel, buildVisaEmbed } = require("../src/utils/visaFormat");

function pickValue(interaction) {
  const vals = Array.isArray(interaction.values) ? interaction.values : [];
  return vals[0] || null;
}

module.exports = {
  idPrefix: "visasel:",

  async execute(interaction) {
    // visasel:draft:<ownerId>:<field>
    const parts = String(interaction.customId).split(":");
    const mode = parts[1];
    const ownerId = parts[2];
    const field = parts[3];

    if (mode !== "draft") {
      return interaction.reply({ content: "❌ Sélecteur inconnu.", ephemeral: true });
    }

    if (interaction.user.id !== ownerId) {
      return interaction.reply({ content: "❌ Pas ton visa.", ephemeral: true });
    }

    const draft = getVisaDraft(interaction.guildId, ownerId);
    if (!draft) {
      return interaction.reply({ content: "⏱️ Brouillon expiré (15 min). Relance /visa-creation.", ephemeral: true });
    }

    const value = pickValue(interaction);
    if (!value) return interaction.reply({ content: "❌ Valeur invalide.", ephemeral: true });

    if (field === "statut") {
      updateVisaDraft(interaction.guildId, ownerId, { statutVisa: value });

      const normalized = statutLabel(value);

      // Si temporaire => demander date expiration
      if (normalized === "Temporaire") {
        const modal = new ModalBuilder()
          .setCustomId(`visa:exp:${ownerId}`)
          .setTitle("Visa - Expiration (Temporaire)");

        const year = new TextInputBuilder()
          .setCustomId("year")
          .setLabel("Année expiration")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder("ex: 2026");

        const month = new TextInputBuilder()
          .setCustomId("month")
          .setLabel("Mois expiration")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder("ex: 1");

        const day = new TextInputBuilder()
          .setCustomId("day")
          .setLabel("Jour expiration")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder("ex: 6");

        modal.addComponents(
          new ActionRowBuilder().addComponents(year),
          new ActionRowBuilder().addComponents(month),
          new ActionRowBuilder().addComponents(day)
        );

        return interaction.showModal(modal);
      }

      // Si permanent/suspendu/refusé => expiration null
      updateVisaDraft(interaction.guildId, ownerId, { expirationUnix: null });

      // Si suspendu/refusé => demander raison
      if (normalized === "Suspendu" || normalized === "Refusé") {
        const modal = new ModalBuilder()
          .setCustomId(`visa:raison:${ownerId}`)
          .setTitle(`Visa - Motif (${normalized})`);

        const raison = new TextInputBuilder()
          .setCustomId("raison")
          .setLabel("Raison")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(raison));
        return interaction.showModal(modal);
      }

      const updated = getVisaDraft(interaction.guildId, ownerId);
      const embed = buildVisaEmbed({ ...updated, reporterUserId: interaction.user.id });
      return interaction.update({ embeds: [embed] });
    }

    if (field === "facture") {
      updateVisaDraft(interaction.guildId, ownerId, { factureStatut: value });
      const updated = getVisaDraft(interaction.guildId, ownerId);
      const embed = buildVisaEmbed({ ...updated, reporterUserId: interaction.user.id });
      return interaction.update({ embeds: [embed] });
    }

    return interaction.reply({ content: "❌ Champ inconnu.", ephemeral: true });
  },
};
