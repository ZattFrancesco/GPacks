// commands/utility/config-defcon-messages.js
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require("discord.js");
const { buildConfigEmbed, buildConfigButtons } = require("../../src/utils/defconUtils");
const defconDb = require("../../services/defcon.db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("config-defcon-messages")
    .setDescription("Configure les messages DEFCON (global)")
    // admin-only côté Discord (en plus du check runtime)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      // v15+ : flags au lieu de ephemeral
      return interaction.reply({ content: "❌ Admin uniquement.", flags: MessageFlags.Ephemeral });
    }

    // IMPORTANT : on defer tout de suite => évite "Unknown interaction"
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    await defconDb.ensureTables();

    const embed = await buildConfigEmbed(interaction.client);
    return interaction.editReply({
      embeds: [embed],
      components: buildConfigButtons(),
    });
  },
};