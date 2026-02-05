// buttons/visaButtons.js

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
} = require("discord.js");

const { getVisaDraft, clearVisaDraft } = require("../src/utils/visaDrafts");
const { buildVisaEmbed } = require("../src/utils/visaFormat");
const { insertVisa, updateVisa, getVisaById, deleteVisa } = require("../services/visa.db");
const { auditLog } = require("../src/utils/auditLog");

function isManager(interaction) {
  try {
    return interaction.memberPermissions?.has("ManageGuild");
  } catch {
    return false;
  }
}

function editPanel(visaId, ownerId) {
  const row1 = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`visaselEdit:${visaId}:${ownerId}:statut`)
      .setPlaceholder("Modifier statut")
      .addOptions(
        { label: "Temporaire", value: "Temporaire" },
        { label: "Permanent", value: "Permanent" },
        { label: "Suspendu", value: "Suspendu" },
        { label: "Refusé", value: "Refusé" }
      )
  );

  const row2 = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`visaselEdit:${visaId}:${ownerId}:facture`)
      .setPlaceholder("Modifier facture")
      .addOptions(
        { label: "Payée", value: "Payee" },
        { label: "Impayée", value: "Impayee" }
      )
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`visabtn:edit:exp:${visaId}:${ownerId}`).setLabel("📅 Expiration").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`visabtn:edit:emploi:${visaId}:${ownerId}`).setLabel("🧰 Emploi").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`visabtn:edit:permis:${visaId}:${ownerId}`).setLabel("🪪 Permis").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`visabtn:edit:raison:${visaId}:${ownerId}`).setLabel("🛑 Raison").setStyle(ButtonStyle.Secondary)
  );

  return [row1, row2, row3];
}

module.exports = {
  idPrefix: "visabtn:",

  async execute(interaction) {
    const parts = String(interaction.customId).split(":");
    const scope = parts[1];

    // visabtn:draft:<action>:<ownerId>
    if (scope === "draft") {
      const action = parts[2];
      const ownerId = parts[3];

      if (interaction.user.id !== ownerId) {
        return interaction.reply({ content: "❌ Pas ton visa.", flags: 64 });
      }

      if (action === "cancel") {
        clearVisaDraft(interaction.guildId, ownerId);
        return interaction.update({ content: "✅ Brouillon annulé.", embeds: [], components: [] });
      }

      const draft = getVisaDraft(interaction.guildId, ownerId);
      if (!draft) {
        return interaction.reply({ content: "⏱️ Brouillon expiré (15 min). Relance /visa-creation.", flags: 64 });
      }

      if (action === "emploi") {
        const modal = new ModalBuilder().setCustomId(`visa:emploi:${ownerId}`).setTitle("Visa - Emploi");

        const entreprise = new TextInputBuilder()
          .setCustomId("entreprise")
          .setLabel("Entreprise")
          .setStyle(TextInputStyle.Short)
          .setRequired(false);

        const poste = new TextInputBuilder()
          .setCustomId("poste")
          .setLabel("Poste")
          .setStyle(TextInputStyle.Short)
          .setRequired(false);

        modal.addComponents(
          new ActionRowBuilder().addComponents(entreprise),
          new ActionRowBuilder().addComponents(poste)
        );

        return interaction.showModal(modal);
      }

      if (action === "permis") {
        const modal = new ModalBuilder().setCustomId(`visa:permis:${ownerId}`).setTitle("Visa - Permis");

        const permis = new TextInputBuilder()
          .setCustomId("permis")
          .setLabel("Validité du permis")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false);

        modal.addComponents(new ActionRowBuilder().addComponents(permis));
        return interaction.showModal(modal);
      }

      if (action === "save") {
        // Création du message visa (public)
        const embed = buildVisaEmbed({
          ...draft,
          reporterUserId: interaction.user.id,
          createdAtUnix: draft.createdAtUnix,
        });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`visabtn:visa:edit:0:${ownerId}`).setLabel("✏️ Modifier").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`visabtn:visa:delete:0:${ownerId}`).setLabel("🗑️ Supprimer").setStyle(ButtonStyle.Danger)
        );

        const msg = await interaction.channel.send({ embeds: [embed], components: [row] });

        const visaId = await insertVisa({
          guildId: interaction.guildId,
          channelId: msg.channelId,
          messageId: msg.id,
          reporterUserId: interaction.user.id,
          nom: draft.nom,
          prenom: draft.prenom,
          identityId: draft.identityId,
          statutVisa: draft.statutVisa,
          factureStatut: draft.factureStatut,
          expirationUnix: draft.expirationUnix,
          permisValidite: draft.permisValidite,
          entreprise: draft.entreprise,
          poste: draft.poste,
          raison: draft.raison,
        });

        // Update buttons customIds with real visaId
        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`visabtn:visa:edit:${visaId}:${ownerId}`).setLabel("✏️ Modifier").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`visabtn:visa:delete:${visaId}:${ownerId}`).setLabel("🗑️ Supprimer").setStyle(ButtonStyle.Danger)
        );
        await msg.edit({ components: [row2] });

        clearVisaDraft(interaction.guildId, ownerId);

        await interaction.update({ content: "✅ Visa enregistré.", embeds: [], components: [] });
        return interaction.followUp({
          content: "🪪 Merci de mettre **la carte d'identité juste en dessous** (message avec la photo).",
          flags: 64,
        });
      }

      return interaction.reply({ content: "❌ Action inconnue.", flags: 64 });
    }

    // visabtn:visa:<action>:<visaId>:<ownerId>
    if (scope === "visa") {
      const action = parts[2];
      const visaId = parts[3];
      const ownerId = parts[4];

      const row = await getVisaById(interaction.guildId, visaId);
      if (!row) return interaction.reply({ content: "❌ Visa introuvable.", flags: 64 });

      const can = interaction.user.id === row.reporter_user_id || isManager(interaction);
      if (!can) return interaction.reply({ content: "❌ Tu n'as pas la permission.", flags: 64 });

      if (action === "edit") {
        return interaction.reply({
          content: "✏️ Choisis ce que tu veux modifier :",
          components: editPanel(visaId, interaction.user.id),
          flags: 64,
        });
      }

      if (action === "delete") {
        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`visabtn:confirmdel:${visaId}:${interaction.user.id}`)
            .setLabel("✅ Confirmer suppression")
            .setStyle(ButtonStyle.Danger)
        );
        return interaction.reply({ content: "⚠️ Tu es sûr ?", components: [confirmRow], flags: 64 });
      }
    }

    // visabtn:confirmdel:<visaId>:<ownerId>
    if (scope === "confirmdel") {
      const visaId = parts[2];
      const ownerId = parts[3];
      if (interaction.user.id !== ownerId) return interaction.reply({ content: "❌ Pas à toi.", flags: 64 });

      const row = await getVisaById(interaction.guildId, visaId);
      if (!row) return interaction.reply({ content: "❌ Visa introuvable.", flags: 64 });

      const can = interaction.user.id === row.reporter_user_id || isManager(interaction);
      if (!can) return interaction.reply({ content: "❌ Tu n'as pas la permission.", flags: 64 });

      // supprimer DB + message
      await auditLog(interaction.client, interaction.guildId, {
        module: "VISAS",
        action: "DELETE",
        level: "WARN",
        userId: interaction.user.id,
        sourceChannelId: interaction.channelId,
        message: `Visa supprimé (#${visaId}).`,
        meta: { visaId },
      });

      await deleteVisa(interaction.guildId, visaId);

      // suppression du message visa (celui stocké en DB)
      try {
        const ch = await interaction.client.channels.fetch(row.channel_id);
        const msg = await ch.messages.fetch(row.message_id);
        await msg.delete();
      } catch {}

      return interaction.update({ content: "✅ Visa supprimé.", components: [] });
    }

    // edit actions that open modals
    if (scope === "edit") {
      const action = parts[2];
      const visaId = parts[3];
      const ownerId = parts[4];
      if (interaction.user.id !== ownerId) return interaction.reply({ content: "❌ Pas à toi.", flags: 64 });

      const row = await getVisaById(interaction.guildId, visaId);
      if (!row) return interaction.reply({ content: "❌ Visa introuvable.", flags: 64 });
      const can = interaction.user.id === row.reporter_user_id || isManager(interaction);
      if (!can) return interaction.reply({ content: "❌ Tu n'as pas la permission.", flags: 64 });

      if (action === "exp") {
        const modal = new ModalBuilder().setCustomId(`visaEdit:exp:${visaId}:${ownerId}`).setTitle("Modifier expiration");
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

      if (action === "emploi") {
        const modal = new ModalBuilder().setCustomId(`visaEdit:emploi:${visaId}:${ownerId}`).setTitle("Modifier emploi");
        const entreprise = new TextInputBuilder().setCustomId("entreprise").setLabel("Entreprise").setStyle(TextInputStyle.Short).setRequired(false);
        const poste = new TextInputBuilder().setCustomId("poste").setLabel("Poste").setStyle(TextInputStyle.Short).setRequired(false);
        modal.addComponents(
          new ActionRowBuilder().addComponents(entreprise),
          new ActionRowBuilder().addComponents(poste)
        );
        return interaction.showModal(modal);
      }

      if (action === "permis") {
        const modal = new ModalBuilder().setCustomId(`visaEdit:permis:${visaId}:${ownerId}`).setTitle("Modifier permis");
        const permis = new TextInputBuilder().setCustomId("permis").setLabel("Validité du permis").setStyle(TextInputStyle.Paragraph).setRequired(false);
        modal.addComponents(new ActionRowBuilder().addComponents(permis));
        return interaction.showModal(modal);
      }

      if (action === "raison") {
        const modal = new ModalBuilder().setCustomId(`visaEdit:raison:${visaId}:${ownerId}`).setTitle("Modifier raison");
        const raison = new TextInputBuilder().setCustomId("raison").setLabel("Raison").setStyle(TextInputStyle.Paragraph).setRequired(false);
        modal.addComponents(new ActionRowBuilder().addComponents(raison));
        return interaction.showModal(modal);
      }
    }

    return interaction.reply({ content: "❌ Bouton inconnu.", flags: 64 });
  },
};
