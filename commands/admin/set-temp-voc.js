// commands/admin/set-temp-voc.js
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} = require('discord.js');
const tempVoiceDb = require('../../services/tempVoice.db');

// Variables disponibles dans un template
const TEMPLATE_VARS = '`{user}` · `{username}` · `{tag}`';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-temp-voc')
    .setDescription('Gérer les salons vocaux temporaires')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)

    // ── Sous-commande : définir un hub ────────────────────────────────────────
    .addSubcommand(sub =>
      sub
        .setName('set')
        .setDescription('Définir un salon hub qui crée des vocales temporaires')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Salon vocal hub (rejoindre ce salon = créer une voc temp)')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('template')
            .setDescription(`Nom des vocales créées. Variables : ${TEMPLATE_VARS}`)
            .setMinLength(1)
            .setMaxLength(100)
            .setRequired(true)
        )
        .addChannelOption(opt =>
          opt
            .setName('category')
            .setDescription('Catégorie où créer les vocales (optionnel, défaut : même catégorie que le hub)')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(false)
        )
    )

    // ── Sous-commande : supprimer un hub ─────────────────────────────────────
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Retirer un salon hub (ne supprime pas les vocales déjà créées)')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Salon hub à retirer')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true)
        )
    )

    // ── Sous-commande : lister les hubs ──────────────────────────────────────
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('Lister tous les salons hub configurés sur ce serveur')
    ),

  // ── Execute ────────────────────────────────────────────────────────────────
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const sub = interaction.options.getSubcommand();

    // ── /set-temp-voc set ───────────────────────────────────────────────────
    if (sub === 'set') {
      const channel  = interaction.options.getChannel('channel');
      const template = interaction.options.getString('template');
      const category = interaction.options.getChannel('category') || null;

      // Vérifier que le bot peut gérer ce salon et sa catégorie
      const me = interaction.guild.members.me;
      if (!channel.permissionsFor(me).has(PermissionFlagsBits.ManageChannels)) {
        return interaction.editReply({
          content: '❌ Je n\'ai pas la permission **Gérer les salons** sur ce salon vocal.',
        });
      }

      const result = await tempVoiceDb.setConfig({
        guildId:      interaction.guildId,
        hubChannelId: channel.id,
        template,
        categoryId:   category?.id || null,
        createdBy:    interaction.user.id,
      });

      if (!result.ok) {
        return interaction.editReply({ content: '❌ Erreur lors de la sauvegarde en base de données.' });
      }

      // Aperçu du nom généré avec l'utilisateur qui a fait la commande
      const preview = tempVoiceDb.applyTemplate(template, {
        member: interaction.member,
      });

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('🔊 Vocal temporaire configuré')
        .addFields(
          { name: 'Salon hub',   value: `${channel} (\`${channel.id}\`)`,          inline: true },
          { name: 'Template',    value: `\`${template}\``,                          inline: true },
          { name: 'Catégorie',   value: category ? `${category}` : '*(même que le hub)*', inline: true },
          { name: 'Aperçu du nom', value: `→ **${preview}**`,                      inline: false },
          { name: 'Variables dispo', value: TEMPLATE_VARS,                         inline: false },
        )
        .setFooter({ text: "Ghost'Packs • Temp Voice" })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ── /set-temp-voc remove ────────────────────────────────────────────────
    if (sub === 'remove') {
      const channel = interaction.options.getChannel('channel');

      const existing = await tempVoiceDb.getConfig(interaction.guildId, channel.id);
      if (!existing) {
        return interaction.editReply({
          content: `❌ Ce salon n'est pas configuré comme hub de vocales temporaires.`,
        });
      }

      const result = await tempVoiceDb.deleteConfig(interaction.guildId, channel.id);
      if (!result.ok) {
        return interaction.editReply({ content: '❌ Erreur lors de la suppression en base de données.' });
      }

      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('🔇 Hub de vocal temporaire retiré')
        .setDescription(`Le salon ${channel} ne créera plus de vocales temporaires.\n*Les vocales déjà actives ne sont pas supprimées.*`)
        .setFooter({ text: "Ghost'Packs • Temp Voice" })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ── /set-temp-voc list ──────────────────────────────────────────────────
    if (sub === 'list') {
      const configs = await tempVoiceDb.getAllConfigs(interaction.guildId);

      if (!configs.length) {
        return interaction.editReply({
          content: 'ℹ️ Aucun hub de vocal temporaire n\'est configuré sur ce serveur.\nUtilise `/set-temp-voc set` pour en créer un.',
        });
      }

      const lines = configs.map((c, i) => {
        const ch  = interaction.guild.channels.cache.get(c.hubChannelId);
        const cat = c.categoryId ? interaction.guild.channels.cache.get(c.categoryId) : null;
        const chStr  = ch  ? `<#${c.hubChannelId}>` : `~~\`${c.hubChannelId}\`~~ *(introuvable)*`;
        const catStr = cat ? ` → catégorie **${cat.name}**` : '';
        return `**${i + 1}.** ${chStr}${catStr}\n└ template : \`${c.template}\``;
      });

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('🔊 Hubs de vocales temporaires')
        .setDescription(lines.join('\n\n'))
        .setFooter({ text: `Ghost'Packs • Temp Voice — ${configs.length} hub(s)` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  },
};
