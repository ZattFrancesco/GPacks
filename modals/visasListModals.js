// modals/visasListModals.js

const { getState, patchState } = require("../src/utils/visasListState");
const { buildVisasListMessage } = require("../src/utils/visasListView");

function safeVal(interaction, id) {
  try {
    return interaction.fields.getTextInputValue(id);
  } catch {
    return "";
  }
}

module.exports = {
  idPrefix: "visaslist:",

  async execute(interaction) {
    // visaslist:search:<stateId>
    const parts = String(interaction.customId).split(":");
    const mode = parts[1];
    const stateId = parts[2];

    if (mode !== "search") {
      return interaction.reply({ content: "❌ Modal inconnu.", ephemeral: true });
    }

    const state = getState(stateId);
    if (!state) {
      return interaction.reply({ content: "⏱️ Session expirée. Relance /visas.", ephemeral: true });
    }
    if (interaction.user.id !== state.ownerId) {
      return interaction.reply({ content: "❌ Pas ta liste.", ephemeral: true });
    }

    const q = String(safeVal(interaction, "q") || "").trim();
    patchState(stateId, { query: q, page: 1 });

    const nextState = getState(stateId);
    const { embed, components, safePage } = await buildVisasListMessage({
      stateId,
      guildId: nextState.guildId,
      query: nextState.query,
      page: nextState.page,
      pageSize: nextState.pageSize,
    });

    patchState(stateId, { page: safePage });
    return interaction.update({ embeds: [embed], components });
  },
};
