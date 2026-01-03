// commands/utility/config-defcon-messages.js
const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { buildConfigEmbed, buildConfigButtons } = require("../../src/utils/defconUtils");
const defconDb = require("../../services/defcon.db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("config-defcon-messages")
    .setDescription("Configure les messages DEFCON (global)"),
  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: "❌ Admin uniquement.", ephemeral: true });
    }
    await defconDb.ensureTables();

    const embed = await buildConfigEmbed(interaction.client);
    return interaction.reply({
      ephemeral: true,
      embeds: [embed],
      components: buildConfigButtons(),
    });
  },
};
