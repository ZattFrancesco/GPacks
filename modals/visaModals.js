// modals/visaModals.js

const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const { updateVisaDraft, getVisaDraft, clearVisaDraft } = require("../src/utils/visaDrafts");
const { buildVisaEmbed, statutLabel } = require("../src/utils/visaFormat");
const { ensureTables, insertVisa } = require("../services/visa.db");

function safeVal(interaction, id) {
  try {
    return interaction.fields.getTextInputValue(id);
  } catch {
    return null;
  }
}

function buildDraftComponents(ownerId) {
  const rowStatut = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`visasel:draft:${ownerId}:statut`)
      .setPlaceholder("Statut du visa")
      .addOptions(
        { label: "Temporaire", value: "Temporaire" },
        { label: "Permanent", value: "Permanent" },
        { label: "Suspendu", value: "Suspendu" },
        { label: "Refusé", value: "Refusé" }
      )
  );

  const rowFacture = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`visasel:draft:${ownerId}:facture`)
      .setPlaceholder("Facture")
      .addOptions(
        { label: "Payée", value: "Payee" },
        { label: "Impayée", value: "Impayee" }
      )
  );

  const rowButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`visabtn:draft:emploi:${ownerId}`)
      .setLabel("🧰 Emploi")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`visabtn:draft:permis:${ownerId}`)
      .setLabel("🪪 Permis")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`visabtn:draft:save:${ownerId}`)
      .setLabel("✅ Enregistrer")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`visabtn:draft:cancel:${ownerId}`)
      .setLabel("❌ Annuler")
      .setStyle(ButtonStyle.Danger)
  );

  return [rowStatut, rowFacture, rowButtons];
}

module.exports = {
  idPrefix: "visa:",

  async execute(interaction) {
    const [, step, ownerId] = String(interaction.customId).split(":");

    if (interaction.user.id !== ownerId) {
      return interaction.reply({ content: "❌ Pas ton formulaire.", flags: 64 });
    }

    await ensureTables();

    // STEP 1: identité => on crée un brouillon et on affiche le panneau
    if (step === "step1") {
      updateVisaDraft(interaction.guildId, ownerId, {
        nom: safeVal(interaction, "nom"),
        prenom: safeVal(interaction, "prenom"),
        identityId: safeVal(interaction, "identityId"),
        statutVisa: "Temporaire",
        factureStatut: "Impayee",
        expirationUnix: null,
        permisValidite: null,
        entreprise: null,
        poste: null,
        raison: null,
        createdAtUnix: Math.floor(Date.now() / 1000),
      });

      const draft = getVisaDraft(interaction.guildId, ownerId);
      const embed = buildVisaEmbed({
        ...draft,
        reporterUserId: interaction.user.id,
      });

      return interaction.reply({
        content: "✅ Brouillon créé. Choisis **Statut** + **Facture**, puis complète si besoin et clique **Enregistrer**.",
        embeds: [embed],
        components: buildDraftComponents(ownerId),
        flags: 64,
      });
    }

    // STEP EXP: expiration (temporaire)
    if (step === "exp") {
      const draft = getVisaDraft(interaction.guildId, ownerId);
      if (!draft) {
        return interaction.reply({ content: "⏱️ Brouillon expiré (15 min). Relance /visa-creation.", flags: 64 });
      }

      const y = Number(safeVal(interaction, "year"));
      const m = Number(safeVal(interaction, "month"));
      const d = Number(safeVal(interaction, "day"));

      if (!Number.isFinite(y) || y < 2000 || y > 2100 || !Number.isFinite(m) || m < 1 || m > 12 || !Number.isFinite(d) || d < 1 || d > 31) {
        return interaction.reply({ content: "❌ Date invalide. Exemple: 2026 / 1 / 6", flags: 64 });
      }

      const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      const ts = Math.floor(dt.getTime() / 1000);
      updateVisaDraft(interaction.guildId, ownerId, { expirationUnix: ts });

      const updated = getVisaDraft(interaction.guildId, ownerId);
      const embed = buildVisaEmbed({ ...updated, reporterUserId: interaction.user.id });

      return interaction.update({
        embeds: [embed],
        components: buildDraftComponents(ownerId),
      });
    }

    // STEP EMPLOI: entreprise + poste
    if (step === "emploi") {
      const draft = getVisaDraft(interaction.guildId, ownerId);
      if (!draft) {
        return interaction.reply({ content: "⏱️ Brouillon expiré (15 min). Relance /visa-creation.", flags: 64 });
      }

      updateVisaDraft(interaction.guildId, ownerId, {
        entreprise: safeVal(interaction, "entreprise"),
        poste: safeVal(interaction, "poste"),
      });

      const updated = getVisaDraft(interaction.guildId, ownerId);
      const embed = buildVisaEmbed({ ...updated, reporterUserId: interaction.user.id });
      return interaction.update({ embeds: [embed], components: buildDraftComponents(ownerId) });
    }

    // STEP PERMIS: texte libre
    if (step === "permis") {
      const draft = getVisaDraft(interaction.guildId, ownerId);
      if (!draft) {
        return interaction.reply({ content: "⏱️ Brouillon expiré (15 min). Relance /visa-creation.", flags: 64 });
      }

      updateVisaDraft(interaction.guildId, ownerId, {
        permisValidite: safeVal(interaction, "permis"),
      });

      const updated = getVisaDraft(interaction.guildId, ownerId);
      const embed = buildVisaEmbed({ ...updated, reporterUserId: interaction.user.id });
      return interaction.update({ embeds: [embed], components: buildDraftComponents(ownerId) });
    }

    // STEP RAISON: suspendu/refusé
    if (step === "raison") {
      const draft = getVisaDraft(interaction.guildId, ownerId);
      if (!draft) {
        return interaction.reply({ content: "⏱️ Brouillon expiré (15 min). Relance /visa-creation.", flags: 64 });
      }

      updateVisaDraft(interaction.guildId, ownerId, {
        raison: safeVal(interaction, "raison"),
      });

      const updated = getVisaDraft(interaction.guildId, ownerId);
      const embed = buildVisaEmbed({ ...updated, reporterUserId: interaction.user.id });
      return interaction.update({ embeds: [embed], components: buildDraftComponents(ownerId) });
    }

    // STEP SAVE: finalisation depuis un modal (rare) -> pas utilisé ici
    if (step === "save") {
      // pas utilisé
      return interaction.reply({ content: "❌ Action invalide.", flags: 64 });
    }

    return interaction.reply({ content: "❌ Modal inconnu.", flags: 64 });
  },
};
