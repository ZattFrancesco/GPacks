const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = {
  idPrefix: "ticket:memberpick:",

  async execute(interaction) {
    const parts = interaction.customId.split(":");
    const ticketId = parts[2];
    const userId = interaction.values?.[0];
    if (!ticketId || !userId) {
      return interaction.reply({ content: "❌ Sélection invalide.", ephemeral: true });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket:member:add:${ticketId}:${userId}`)
        .setLabel("✅ Ajouter")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`ticket:member:remove:${ticketId}:${userId}`)
        .setLabel("❌ Retirer")
        .setStyle(ButtonStyle.Danger)
    );

    return interaction.reply({ content: `Que veux-tu faire avec <@${userId}> ?`, components: [row], ephemeral: true });
  },
};
