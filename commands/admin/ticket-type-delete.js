const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { deleteType } = require("../../services/tickets.db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket-type-delete")
    .setDescription("Supprimer un type de ticket")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((o) => o.setName("id").setDescription("ID du type").setRequired(true)),

  async execute(interaction) {
    await deleteType(interaction.guildId, interaction.options.getString("id", true));
    return interaction.reply({ content: "✅ Type supprimé.", ephemeral: true });
  },
};
