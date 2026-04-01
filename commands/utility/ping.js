const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Voir la latence du bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
  async execute(interaction) {
    const sent = await interaction.reply({
      content: '🏓 Calcul de la latence...',
      fetchReply: true,
    });

    const messageLatency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = interaction.client.ws.ping;

    await interaction.editReply(
      `**🏓 Pong !**\nLatence message :** ${messageLatency}ms**\nLatence API :** ${apiLatency}ms**`
    );
  },
};