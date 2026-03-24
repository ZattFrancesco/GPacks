const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const logsDb = require('../../services/logs.db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config-logs')
    .setDescription('Configure le salon de logs du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) =>
      s
        .setName('set')
        .setDescription('Définit le salon recevant tous les logs')
        .addChannelOption((o) =>
          o
            .setName('channel')
            .setDescription('Salon de logs')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
    )
    .addSubcommand((s) => s.setName('disable').setDescription('Désactive les logs du serveur'))
    .addSubcommand((s) => s.setName('status').setDescription('Affiche la configuration actuelle des logs')),

  async execute(interaction) {
    await logsDb.ensureTable();
    const sub = interaction.options.getSubcommand(true);

    if (sub === 'set') {
      const channel = interaction.options.getChannel('channel', true);
      await logsDb.setConfig(interaction.guildId, channel.id);
      return interaction.reply({
        content: `✅ Les logs sont maintenant envoyés dans ${channel}.`,
        flags: 64,
      });
    }

    if (sub === 'disable') {
      await logsDb.setConfig(interaction.guildId, null);
      return interaction.reply({
        content: '✅ Les logs ont été désactivés pour ce serveur.',
        flags: 64,
      });
    }

    const cfg = await logsDb.getConfig(interaction.guildId);
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Configuration des logs')
      .setDescription(cfg?.channelId ? `Salon configuré : <#${cfg.channelId}>` : 'Aucun salon de logs configuré.')
      .setFooter({ text: 'Ghost\'Packs • Logs' })
      .setTimestamp(new Date());

    return interaction.reply({ embeds: [embed], flags: 64 });
  },
};
