// selectmenus/rjEditSelectMenus.js
// Sélection du rapport puis du champ à modifier.

const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const { getSession } = require("../src/utils/rjReportSessions");
const { getReportById } = require("../services/rapportJugement.db");

function safe(v, fallback = "/") {
  const t = (v ?? "").toString().trim();
  return t.length ? t : fallback;
}

// La conversion et la mise à jour sont gérées dans le modal (modals/rjEditValueModal.js)

const FIELD_META = [
  { key: "date_jugement_unix", label: "Date du jugement", hint: "Format: JJ/MM/AAAA ou AAAA-MM-JJ" },
  { key: "judge_name", label: "Juge", hint: "@mention ou texte" },
  { key: "procureur", label: "Procureur", hint: "@mention ou texte" },
  { key: "avocat", label: "Avocat", hint: "@mention ou texte (ou /)" },
  { key: "peine", label: "Peine", hint: "Texte" },
  { key: "amende", label: "Amende", hint: "Texte" },
  { key: "tig", label: "TIG", hint: "Oui / Non" },
  { key: "tig_entreprise", label: "Entreprise TIG", hint: "Texte (si TIG=Oui)" },
  { key: "observation", label: "Observation", hint: "Texte" },
];

function buildFieldSelect(ownerId, session, reportId, page, limit) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`rjeditfield:${ownerId}:${session}:${reportId}:${page}:${limit}`)
      .setPlaceholder("Quelle info veux-tu modifier ?")
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        FIELD_META.map((f) => ({
          label: f.label,
          description: f.hint.slice(0, 100),
          value: f.key,
        }))
      )
  );
}

function buildReportHeader(report) {
  const ts = report.date_jugement_unix
    ? Number(report.date_jugement_unix)
    : Math.floor(new Date(report.created_at).getTime() / 1000);
  const suspect = `${safe(report.nom)} ${safe(report.prenom)}`;
  return `#${report.id} • <t:${ts}:d> • ${suspect}`;
}

module.exports = [
  {
    idPrefix: "rjeditpick:",
    async execute(interaction) {
      // rjeditpick:<ownerId>:<session>:<page>:<limit>
      const parts = String(interaction.customId || "").split(":");
      const ownerId = parts[1];
      const session = parts[2];
      const page = Number(parts[3] || 1);
      const limit = Number(parts[4] || 200);

      if (!ownerId || interaction.user.id !== ownerId) {
        return interaction.reply({ content: "❌ Ce panneau ne t'appartient pas.", flags: 64 });
      }

      const sess = getSession(interaction.guildId, ownerId, session);
      if (!sess || !sess.search) {
        return interaction.reply({ content: "⏱️ Session expirée. Relance /rapport-modifier.", flags: 64 });
      }

      const val = interaction.values?.[0];
      if (!val || val === "none") {
        return interaction.reply({ content: "❌ Aucun rapport sélectionné.", flags: 64 });
      }

      const report = await getReportById(interaction.guildId, val);
      if (!report) {
        return interaction.reply({ content: "❌ Rapport introuvable.", flags: 64 });
      }

      const embed = new EmbedBuilder()
        .setTitle("✏️ Choisir le champ à modifier")
        .setDescription(
          `${buildReportHeader(report)}\n\nChoisis le champ à modifier dans le menu ci-dessous.`
        )
        .setColor(0x2b2d31);

      const rowField = buildFieldSelect(ownerId, session, report.id, page, limit);

      // On conserve le message (même embed), on ajoute juste le select de champs
      return interaction.update({ embeds: [embed], components: [rowField] });
    },
  },

  {
    idPrefix: "rjeditfield:",
    async execute(interaction) {
      // rjeditfield:<ownerId>:<session>:<reportId>:<page>:<limit>
      const parts = String(interaction.customId || "").split(":");
      const ownerId = parts[1];
      const session = parts[2];
      const reportId = parts[3];
      const page = parts[4] || "1";
      const limit = parts[5] || "200";

      if (!ownerId || interaction.user.id !== ownerId) {
        return interaction.reply({ content: "❌ Ce panneau ne t'appartient pas.", flags: 64 });
      }

      const sess = getSession(interaction.guildId, ownerId, session);
      if (!sess || !sess.search) {
        return interaction.reply({ content: "⏱️ Session expirée. Relance /rapport-modifier.", flags: 64 });
      }

      const fieldKey = interaction.values?.[0];
      const meta = FIELD_META.find((f) => f.key === fieldKey);
      if (!meta) {
        return interaction.reply({ content: "❌ Champ invalide.", flags: 64 });
      }

      const report = await getReportById(interaction.guildId, reportId);
      if (!report) {
        return interaction.reply({ content: "❌ Rapport introuvable.", flags: 64 });
      }

      // Modal 1 champ (comme demandé)
      const modal = new ModalBuilder()
        .setCustomId(`rjeditvalueModal:${ownerId}:${session}:${reportId}:${fieldKey}:${page}:${limit}`)
        .setTitle(`Modifier : ${meta.label}`);

      const input = new TextInputBuilder()
        .setCustomId("value")
        .setLabel(meta.hint)
        .setStyle(fieldKey === "peine" || fieldKey === "observation" ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(fieldKey === "peine" || fieldKey === "observation" ? 1500 : 255);

      // Pré-remplissage simple
      const current = report[fieldKey];
      if (current !== null && current !== undefined && String(current).length) {
        input.setValue(String(current).slice(0, fieldKey === "peine" || fieldKey === "observation" ? 1500 : 255));
      }

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    },
  },
];
