// commands/admin/rapports-semaine-reset.js
const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { addWeekReset } = require("../../services/rapportJugement.db");
const { auditLog } = require("../../src/utils/auditLog");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rapports-semaine-reset")
    .setDescription("Réinitialise la semaine des stats (sans supprimer l'historique)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const guildId = interaction.guildId;
    if (!guildId) return interaction.reply({ content: "❌ Commande utilisable uniquement en serveur.", ephemeral: true });

    await addWeekReset(guildId, interaction.user.id);


    await auditLog(interaction.client, interaction.guildId, {
      module: "RAPPORTS",
      action: "WEEK_RESET",
      level: "WARN",
      userId: interaction.user.id,
      sourceChannelId: interaction.channelId,
      message: "Reset des rapports de la semaine.",
      meta: {},
    });
    return interaction.reply({ content: "✅ Semaine réinitialisée. Les stats repartent de zéro à partir de maintenant.", ephemeral: true });
  },
};
