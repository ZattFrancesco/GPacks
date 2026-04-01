const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const autoroleDb = require('../../services/autorole.db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autorole-setup')
    .setDescription('Configurer l\'autorole')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption((option) =>
      option
        .setName('role')
        .setDescription('Rôle à attribuer')
        .setRequired(false)
    ),

  async execute(interaction) {
    await autoroleDb.ensureTable();

    const role = interaction.options.getRole('role');

    if (!role) {
      await autoroleDb.clearAutorole(interaction.guildId);
      return interaction.reply({
        content: '✅ Autorole supprimé. Les nouveaux membres ne recevront plus de rôle automatiquement.',
        flags: 64,
      });
    }

    if (!role.editable || role.managed) {
      return interaction.reply({
        content:
          '❌ Je ne peux pas utiliser ce rôle. Vérifie qu’il ne soit pas géré par une intégration et qu’il soit sous mon rôle le plus haut.',
        flags: 64,
      });
    }

    await autoroleDb.setAutorole(interaction.guildId, role.id);

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('Autorole configuré')
      .setDescription([
        `**Rôle défini** : ${role}`,
        `**ID** : \`${role.id}\``,
        '',
        'Les nouveaux membres recevront désormais ce rôle automatiquement.',
        'Si le rôle est supprimé plus tard, la configuration sera nettoyée automatiquement.',
      ].join('\n'))
      .setFooter({ text: "Ghost'Packs • Autorole" })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: 64 });
  },
};
