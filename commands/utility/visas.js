// commands/utility/visas.js

const { SlashCommandBuilder } = require("discord.js");
const { ensureTables } = require("../../services/visa.db");
const { putState } = require("../../src/utils/visasListState");
const { buildVisasListMessage } = require("../../src/utils/visasListView");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("visas")
    .setDescription("Lister les visas (pagination + recherche)"),

  async execute(interaction) {
    await ensureTables();

    const stateId = putState({
      ownerId: interaction.user.id,
      guildId: interaction.guildId,
      query: "",
      page: 1,
      pageSize: 4,
    });

    const { embed, components } = await buildVisasListMessage({
      stateId,
      guildId: interaction.guildId,
      query: "",
      page: 1,
      pageSize: 4,
    });

    return interaction.reply({ embeds: [embed], components, flags: 64 });
  },
};
