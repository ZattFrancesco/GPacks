const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, OverwriteType } = require('discord.js');
const {
  ensureTables,
  getLockSnapshot,
  deleteLockSnapshot,
  parseOverwritesJson,
} = require('../../services/channelLocks.db');

function canBeUnlocked(channel) {
  if (!channel) return false;
  if (channel.isThread?.()) return false;
  return typeof channel.permissionOverwrites?.set === 'function';
}

function normalizeOverwrite(raw) {
  return {
    id: String(raw.id),
    type: typeof raw.type === 'number'
      ? raw.type
      : String(raw.type).toLowerCase() === 'member'
        ? OverwriteType.Member
        : OverwriteType.Role,
    allow: BigInt(raw.allow || '0'),
    deny: BigInt(raw.deny || '0'),
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Restore un salon locké avec ses permissions exactes d’avant lock')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Salon à unlock')
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

    if (!canBeUnlocked(channel)) {
      return interaction.editReply({
        content: '❌ Ce salon ne peut pas être unlock par cette commande.',
      });
    }

    const snapshotRow = await getLockSnapshot(interaction.guildId, channel.id);
    if (!snapshotRow) {
      return interaction.editReply({
        content: `⚠️ ${channel} n’a pas de snapshot en DB, donc je ne peux pas restaurer proprement ses permissions.`,
      });
    }

    const me = interaction.guild.members.me;
    if (!me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.editReply({
        content: '❌ Il me manque la permission **Gérer les salons**.',
      });
    }

    const overwrites = parseOverwritesJson(snapshotRow.overwrites_json).map(normalizeOverwrite);
    await channel.permissionOverwrites.set(overwrites, `Unlock par ${interaction.user.tag} (${interaction.user.id})`);
    await deleteLockSnapshot(interaction.guildId, channel.id);

    return interaction.editReply({
      content: `🔓 ${channel} a été restauré avec ses permissions d’origine.`,
    });
  },
};
