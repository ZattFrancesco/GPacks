const { openTicketFromPanel } = require("../src/utils/ticketOpen");

module.exports = {
  idPrefix: "ticketopen:",

  async execute(interaction) {
    const parts = interaction.customId.split(":");
    const panelId = parts[1];
    const typeId = parts[2];
    if (!panelId || !typeId) {
      return interaction.reply({ content: "❌ Bouton invalide.", ephemeral: true });
    }
    return openTicketFromPanel(interaction, { panelId, typeId });
  },
};
