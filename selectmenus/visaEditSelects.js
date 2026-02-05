// selectmenus/visaEditSelects.js

const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");

const { getVisaById, updateVisa } = require("../services/visa.db");
const { statutLabel, factureLabel, buildVisaEmbed } = require("../src/utils/visaFormat");

function isManager(interaction) {
  try { return interaction.memberPermissions?.has("ManageGuild"); } catch { return false; }
}

function pickValue(interaction) {
  const vals = Array.isArray(interaction.values) ? interaction.values : [];
  return vals[0] || null;
}

async function refreshVisaMessage(interaction, visaRow) {
  if (!visaRow?.channel_id || !visaRow?.message_id) return;
  const ch = await interaction.client.channels.fetch(visaRow.channel_id);
  const msg = await ch.messages.fetch(visaRow.message_id);
  const embed = buildVisaEmbed(visaRow);
  await msg.edit({ embeds: [embed] });
}

module.exports = {
  idPrefix: "visaselEdit:",

  async execute(interaction) {
    // visaselEdit:<visaId>:<ownerId>:<field>
    const parts = String(interaction.customId).split(":");
    const visaId = parts[1];
    const ownerId = parts[2];
    const field = parts[3];

    if (interaction.user.id !== ownerId) {
      return interaction.reply({ content: "❌ Pas à toi.", flags: 64 });
    }

    const row = await getVisaById(interaction.guildId, visaId);
    if (!row) return interaction.reply({ content: "❌ Visa introuvable.", flags: 64 });

    const can = interaction.user.id === row.reporter_user_id || isManager(interaction);
    if (!can) return interaction.reply({ content: "❌ Tu n'as pas la permission.", flags: 64 });

    const value = pickValue(interaction);
    if (!value) return interaction.reply({ content: "❌ Valeur invalide.", flags: 64 });

    if (field === "statut") {
      const normalized = statutLabel(value);
      await updateVisa(visaId, { statut_visa: normalized });

      // Si temporaire => demander expiration
      if (normalized === "Temporaire") {
        const modal = new ModalBuilder()
          .setCustomId(`visaEdit:exp:${visaId}:${ownerId}`)
          .setTitle("Modifier expiration (Temporaire)");

        const year = new TextInputBuilder().setCustomId("year").setLabel("Année expiration").setStyle(TextInputStyle.Short).setRequired(true);
        const month = new TextInputBuilder().setCustomId("month").setLabel("Mois expiration").setStyle(TextInputStyle.Short).setRequired(true);
        const day = new TextInputBuilder().setCustomId("day").setLabel("Jour expiration").setStyle(TextInputStyle.Short).setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(year),
          new ActionRowBuilder().addComponents(month),
          new ActionRowBuilder().addComponents(day)
        );
        return interaction.showModal(modal);
      }

      // Si pas temporaire => expiration null
      await updateVisa(visaId, { expiration_unix: null });

      // Si suspendu/refusé => demander raison
      if (normalized === "Suspendu" || normalized === "Refusé") {
        const modal = new ModalBuilder()
          .setCustomId(`visaEdit:raison:${visaId}:${ownerId}`)
          .setTitle(`Modifier motif (${normalized})`);

        const raison = new TextInputBuilder()
          .setCustomId("raison")
          .setLabel("Raison")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(raison));
        return interaction.showModal(modal);
      }

      const fresh = await getVisaById(interaction.guildId, visaId);
      await refreshVisaMessage(interaction, fresh);
      return interaction.reply({ content: "✅ Statut mis à jour.", flags: 64 });
    }

    if (field === "facture") {
      const normalized = factureLabel(value);
      // factureLabel renvoie Payée/Impayée -> on stocke sans accent pour cohérence
      const store = normalized === "Payée" ? "Payee" : "Impayee";
      await updateVisa(visaId, { facture_statut: store });
      const fresh = await getVisaById(interaction.guildId, visaId);
      await refreshVisaMessage(interaction, fresh);
      return interaction.reply({ content: "✅ Facture mise à jour.", flags: 64 });
    }

    return interaction.reply({ content: "❌ Champ inconnu.", flags: 64 });
  },
};
