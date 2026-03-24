const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const {
  ensureTables,
  getLockSnapshot,
  saveLockSnapshot,
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
  return typeof channel.permissionOverwrites?.edit === 'function';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock un salon en cachant sa vue au rôle @everyone')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Salon à lock')
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
        content: `⚠️ ${channel} est déjà locké.` ,
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
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        ViewChannel: false,
      }, {
        reason: `Lock par ${interaction.user.tag} (${interaction.user.id})`,
      });
    } catch (error) {
      // rollback si le lock échoue
      const { deleteLockSnapshot } = require('../../services/channelLocks.db');
      await deleteLockSnapshot(interaction.guildId, channel.id).catch(() => {});
      throw error;
    }

    return interaction.editReply({
      content: `🔒 ${channel} a été locké.` ,
    });
  },
};
