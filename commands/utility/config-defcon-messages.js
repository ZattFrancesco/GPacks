// commands/utility/config-defcon-messages.js
const { SlashCommandBuilder } = require("discord.js");
const { buildConfigEmbed, buildConfigButtons } = require("../../src/utils/defconUtils");
const defconDb = require("../../services/defcon.db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("config-defcon-messages")
    .setDescription("Configure les messages DEFCON (global)"),
  async execute(interaction) {
    await defconDb.ensureTables();

    const embed = await buildConfigEmbed(interaction.client);
    return interaction.reply({
      ephemeral: true,
      embeds: [embed],
      components: buildConfigButtons(),
    });
  },
};
