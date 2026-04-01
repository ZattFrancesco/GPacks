const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const { getType } = require("../../services/tickets.db");
const { buildTypeEditView } = require("../../src/utils/ticketTypeEditView");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket-type-edit")
    .setDescription("Modifier un type de ticket")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    // ✅ required en premier
    .addStringOption((o) => o.setName("id").setDescription("ID du type").setRequired(true)),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const typeId = interaction.options.getString("id", true);

    const type = await getType(guildId, typeId);
    if (!type) {
      return interaction.reply({ content: "❌ Type introuvable.", flags: 64 });
    }

    const view = buildTypeEditView(interaction.guild, type);
    return interaction.reply({ ...view, flags: 64 });
  },
};
