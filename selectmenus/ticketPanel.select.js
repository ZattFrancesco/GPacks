const { openTicketFromPanel } = require("../src/utils/ticketOpen");

module.exports = {
  idPrefix: "ticketpanel:",

  async execute(interaction) {
    const panelId = interaction.customId.split(":")[1];
    const typeId = interaction.values?.[0];
    if (!panelId || !typeId) {
      return interaction.reply({ content: "❌ Sélection invalide.", flags: 64 });
    }
    return openTicketFromPanel(interaction, { panelId, typeId });
  },
};
