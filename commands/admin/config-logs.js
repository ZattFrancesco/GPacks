const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const logsDb = require('../../services/logs.db');

const GROUPS = logsDb.getLogTypeGroups();
const CATEGORY_OPTIONS = GROUPS.map((group) => ({
  label: group.label,
  value: group.key,
  description: `${group.types.length} options`,
  emoji: group.emoji,
}));

function buildDashboardEmbed(guild, cfg, selectedGroupKey) {
  const selectedGroup = GROUPS.find((g) => g.key === selectedGroupKey) || GROUPS[0];
  const enabledSet = new Set(cfg?.enabledTypes || logsDb.ALL_LOG_TYPES);
  const totalEnabled = logsDb.ALL_LOG_TYPES.filter((key) => enabledSet.has(key)).length;

  const statusLines = selectedGroup.types.map(
    (type) => `${enabledSet.has(type.key) ? '✅' : '❌'} ${type.label} — \`${type.key}\``
  );

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Dashboard des logs')
    .setDescription(
      [
        `**Serveur** : ${guild?.name || '—'}`,
        `**Salon de logs** : ${cfg?.channelId ? `<#${cfg.channelId}>` : 'Non configuré'}`,
        `**Logs actifs** : ${totalEnabled}/${logsDb.ALL_LOG_TYPES.length}`,
        `**Catégorie affichée** : ${selectedGroup.emoji} ${selectedGroup.label}`,
        '',
        statusLines.join('\n') || 'Aucun type disponible.',
      ].join('\n')
    )
    .addFields({
      name: 'Utilisation',
      value: [
        '• Choisis une catégorie dans le premier menu',
        '• Active/désactive les logs visibles avec le second menu',
        '• Le même message est mis à jour à chaque modification',
      ].join('\n'),
    })
    .setFooter({ text: "Ghost'Packs • Dashboard logs" })
    .setTimestamp();
}

function buildDashboardComponents(cfg, selectedGroupKey) {
  const selectedGroup = GROUPS.find((g) => g.key === selectedGroupKey) || GROUPS[0];
  const enabledSet = new Set(cfg?.enabledTypes || logsDb.ALL_LOG_TYPES);

  const categoryMenu = new StringSelectMenuBuilder()
    .setCustomId(`logs-dashboard:category:${selectedGroup.key}`)
    .setPlaceholder('Choisir une catégorie')
    .addOptions(CATEGORY_OPTIONS.map((option) => ({ ...option, default: option.value === selectedGroup.key })));

  const toggleMenu = new StringSelectMenuBuilder()
    .setCustomId(`logs-dashboard:toggle:${selectedGroup.key}`)
    .setPlaceholder('Activer / désactiver les logs visibles')
    .setMinValues(0)
    .setMaxValues(selectedGroup.types.length)
    .addOptions(
      selectedGroup.types.map((type) => ({
        label: type.label,
        value: type.key,
        description: type.key,
        default: enabledSet.has(type.key),
      }))
    );

  const actions = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`logs-dashboard:enableall:${selectedGroup.key}`)
      .setLabel('Tout activer')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`logs-dashboard:disableall:${selectedGroup.key}`)
      .setLabel('Tout désactiver')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`logs-dashboard:reset:${selectedGroup.key}`)
      .setLabel('Reset total')
      .setStyle(ButtonStyle.Secondary)
  );

  return [
    new ActionRowBuilder().addComponents(categoryMenu),
    new ActionRowBuilder().addComponents(toggleMenu),
    actions,
  ];
}

function buildDashboardPayload(guild, cfg, selectedGroupKey) {
  return {
    embeds: [buildDashboardEmbed(guild, cfg, selectedGroupKey)],
    components: buildDashboardComponents(cfg, selectedGroupKey),
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config-logs')
    .setDescription('Configure le salon et le dashboard des logs du serveur')
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
    .addSubcommand((s) => s.setName('dashboard').setDescription('Ouvre le dashboard interactif des logs'))
    .addSubcommand((s) => s.setName('status').setDescription('Affiche la configuration actuelle'))
    .addSubcommand((s) => s.setName('disable').setDescription('Désactive les logs du serveur')),

  buildDashboardPayload,

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

    if (sub === 'dashboard') {
      return interaction.reply({
        ...buildDashboardPayload(interaction.guild, cfg, GROUPS[0]?.key),
        flags: 64,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Configuration des logs')
      .setDescription(cfg?.channelId ? `Salon actuel : <#${cfg.channelId}>` : 'Aucun salon de logs configuré.')
      .addFields(
        {
          name: 'Dashboard',
          value: 'Utilise `/config-logs dashboard` pour choisir précisément quels logs activer ou désactiver.',
        },
        {
          name: 'Logs actifs',
          value: `${(cfg?.enabledTypes || logsDb.ALL_LOG_TYPES).length}/${logsDb.ALL_LOG_TYPES.length}`,
          inline: true,
        }
      )
      .setFooter({ text: "Ghost'Packs • Logs serveur" })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: 64 });
  },
};
