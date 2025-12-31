// commands/admin/rapports-semaine-reset.js
const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { addWeekReset } = require("../../services/rapportJugement.db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rapports-semaine-reset")
    .setDescription("Réinitialise la semaine des stats (sans supprimer l'historique)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const guildId = interaction.guildId;
    if (!guildId) return interaction.reply({ content: "❌ Commande utilisable uniquement en serveur.", ephemeral: true });

    await addWeekReset(guildId, interaction.user.id);
    return interaction.reply({ content: "✅ Semaine réinitialisée. Les stats repartent de zéro à partir de maintenant.", ephemeral: true });
  },
};
