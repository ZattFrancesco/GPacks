// buttons/visasListButtons.js

const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
const { getState, patchState } = require("../src/utils/visasListState");
const { buildVisasListMessage } = require("../src/utils/visasListView");

module.exports = {
  idPrefix: "visaslistbtn:",

  async execute(interaction) {
    // visaslistbtn:<stateId>:<action>
    const parts = String(interaction.customId).split(":");
    const stateId = parts[1];
    const action = parts[2];

    const state = getState(stateId);
    if (!state) {
      return interaction.reply({ content: "⏱️ Session expirée. Relance /visas.", ephemeral: true });
    }
    if (interaction.user.id !== state.ownerId) {
      return interaction.reply({ content: "❌ Pas ta liste.", ephemeral: true });
    }

    if (action === "search") {
      const modal = new ModalBuilder()
        .setCustomId(`visaslist:search:${stateId}`)
        .setTitle("Rechercher un visa");

      const q = new TextInputBuilder()
        .setCustomId("q")
        .setLabel("Nom / Prénom / ID")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder("ex: Ibrahim Vazimov / vazimov / 12345")
        .setValue(String(state.query || ""));

      modal.addComponents(new ActionRowBuilder().addComponents(q));
      return interaction.showModal(modal);
    }

    if (action === "reset") {
      patchState(stateId, { query: "", page: 1 });
    }

    if (action === "prev") {
      patchState(stateId, { page: Math.max(1, Number(state.page) - 1) });
    }

    if (action === "next") {
      patchState(stateId, { page: Number(state.page) + 1 });
    }

    const nextState = getState(stateId);
    const { embed, components, safePage } = await buildVisasListMessage({
      stateId,
      guildId: nextState.guildId,
      query: nextState.query,
      page: nextState.page,
      pageSize: nextState.pageSize,
    });

    // On synchronise la page réelle si elle a été clampée
    patchState(stateId, { page: safePage });

    return interaction.update({ embeds: [embed], components });
  },
};
