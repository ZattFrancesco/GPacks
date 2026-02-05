// selectmenus/planningJugementsSelectMenus.js

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { ensureTables, getEntryById } = require("../services/judgementPlanning.db");
const { clearDraft } = require("../src/utils/judgementPlanningDrafts");

module.exports = {
  idPrefix: "jplanselect:",

  async execute(interaction) {
    await ensureTables();

    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const parts = String(interaction.customId).split(":");
    // patterns:
    // jplanselect:edit:pick:<ownerId>
    // jplanselect:del:pick:<ownerId>
    const mode = parts[1]; // edit|del
    const ownerId = parts[3];

    if (ownerId !== userId) {
      return interaction.reply({ content: "❌ Ce menu ne t'est pas destiné.", flags: 64 });
    }

    const selected = interaction.values?.[0];
    const idJudge = Number(selected);

    if (!idJudge) {
      return interaction.reply({ content: "❌ Sélection invalide.", flags: 64 });
    }

    const entry = await getEntryById(guildId, idJudge);
    if (!entry) {
      return interaction.reply({ content: "❌ Entrée introuvable.", flags: 64 });
    }

    clearDraft(guildId, userId);

    if (mode === "edit") {
      // bouton qui ouvre le modal identité (prefill géré côté bouton)
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`jplan:edit:open:${idJudge}:${userId}`).setLabel("Ouvrir la modification").setStyle(ButtonStyle.Primary)
      );

      return interaction.update({ content: "Clique pour modifier cette entrée :", components: [row] });
    }

    if (mode === "del") {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`jplan:del:confirm:${idJudge}:${userId}:yes`).setLabel("✅ Oui supprimer").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`jplan:del:confirm:${idJudge}:${userId}:no`).setLabel("❌ Annuler").setStyle(ButtonStyle.Secondary)
      );

      return interaction.update({ content: "⚠️ Confirme la suppression :", components: [row] });
    }

    return interaction.reply({ content: "❌ Action select inconnue.", flags: 64 });
  },
};
