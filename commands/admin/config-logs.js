const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const logsDb = require('../../services/logs.db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config-logs')
    .setDescription('Configure le salon recevant les logs du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) =>
      s
        .setName('set')
        .setDescription('Définit le salon de logs')
        .addChannelOption((o) =>
          o
            .setName('channel')
            .setDescription('Salon textuel pour recevoir les logs')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
    )
    .addSubcommand((s) => s.setName('status').setDescription('Affiche la configuration actuelle'))
    .addSubcommand((s) => s.setName('disable').setDescription('Désactive les logs du serveur')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand(true);
    await logsDb.ensureTable();

    if (sub === 'set') {
      const channel = interaction.options.getChannel('channel', true);
      await logsDb.setConfig(interaction.guildId, channel.id);
      return interaction.reply({
        content: `✅ Les logs du serveur seront envoyés dans ${channel}.`,
        flags: 64,
      });
    }

    if (sub === 'disable') {
      await logsDb.setConfig(interaction.guildId, null);
      return interaction.reply({
        content: '✅ Les logs du serveur sont désactivés.',
        flags: 64,
      });
    }

    const cfg = await logsDb.getConfig(interaction.guildId);
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Configuration des logs')
      .setDescription(cfg?.channelId ? `Salon actuel : <#${cfg.channelId}>` : 'Aucun salon de logs configuré.')
      .addFields(
        {
          name: 'Événements suivis',
          value: [
            'Messages, réactions, pins',
            'Membres, rôles, salons, invitations',
            'Threads, emojis, stickers, webhooks',
            'Vocal, events planifiés, stages, mises à jour utilisateur',
          ].join('\n'),
        }
      )
      .setFooter({ text: "Ghost'Packs • Logs serveur" })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: 64 });
  },
};
