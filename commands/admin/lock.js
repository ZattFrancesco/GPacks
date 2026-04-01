const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const {
  ensureTables,
  getLockSnapshot,
  saveLockSnapshot,
  deleteLockSnapshot,
} = require('../../services/channelLocks.db');

function serializeOverwrites(channel) {
  return channel.permissionOverwrites.cache.map((ow) => ({
    id: String(ow.id),
    type: ow.type,
    allow: ow.allow.bitfield.toString(),
    deny: ow.deny.bitfield.toString(),
  }));
}

function canBeLocked(channel) {
  if (!channel) return false;
  if (channel.isThread?.()) return false;
  if (typeof channel.permissionOverwrites?.edit !== 'function') return false;

  const guild = channel.guild;
  if (!guild) return false;

  if (
    channel.id === guild.rulesChannelId ||
    channel.id === guild.publicUpdatesChannelId
  ) {
    return false;
  }

  return true;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Verrouiller un salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Salon ciblé')
        .setRequired(true)
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildVoice,
          ChannelType.GuildAnnouncement,
          ChannelType.GuildForum,
          ChannelType.GuildMedia,
          ChannelType.GuildCategory,
          ChannelType.GuildStageVoice
        )
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    await ensureTables();

    const channel = interaction.options.getChannel('channel', true);

    if (!canBeLocked(channel)) {
      return interaction.editReply({
        content: '❌ Ce salon ne peut pas être lock par cette commande.',
      });
    }

    const existing = await getLockSnapshot(interaction.guildId, channel.id);
    if (existing) {
      return interaction.editReply({
        content: `⚠️ ${channel} est déjà locké.`,
      });
    }

    const me = interaction.guild.members.me;
    if (!me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.editReply({
        content: '❌ Il me manque la permission **Gérer les salons**.',
      });
    }

    const snapshot = serializeOverwrites(channel);
    await saveLockSnapshot(interaction.guildId, channel.id, interaction.user.id, snapshot);

    try {
      await channel.permissionOverwrites.edit(
        interaction.guild.roles.everyone,
        { ViewChannel: false },
        { reason: `Lock par ${interaction.user.tag} (${interaction.user.id})` }
      );
    } catch (error) {
      await deleteLockSnapshot(interaction.guildId, channel.id).catch(() => {});

      if (error?.code === 350003) {
        return interaction.editReply({
          content: `⚠️ ${channel} ne peut pas être locké car Discord l’utilise comme salon système / onboarding et il doit rester visible par tout le monde.`,
        });
      }

      return interaction.editReply({
        content: `❌ Impossible de lock ${channel}. ${error?.message || 'Erreur inconnue.'}`,
      });
    }

    return interaction.editReply({
      content: `🔒 ${channel} a été locké.`,
    });
  },
};
