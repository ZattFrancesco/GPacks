const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
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
  return typeof channel.permissionOverwrites?.edit === 'function';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock-all')
    .setDescription('Lock tous les salons du serveur avec snapshot DB')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    await ensureTables();

    const me = interaction.guild.members.me;
    if (!me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.editReply({
        content: '❌ Il me manque la permission **Gérer les salons**.',
      });
    }

    const channels = interaction.guild.channels.cache
      .filter((channel) => canBeLocked(channel))
      .sort((a, b) => a.rawPosition - b.rawPosition);

    let locked = 0;
    let alreadyLocked = 0;
    let skipped = 0;
    const failures = [];

    for (const channel of channels.values()) {
      try {
        const existing = await getLockSnapshot(interaction.guildId, channel.id);
        if (existing) {
          alreadyLocked += 1;
          continue;
        }

        const snapshot = serializeOverwrites(channel);
        await saveLockSnapshot(interaction.guildId, channel.id, interaction.user.id, snapshot);

        try {
          await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
            ViewChannel: false,
          }, {
            reason: `Lock-all par ${interaction.user.tag} (${interaction.user.id})`,
          });
          locked += 1;
        } catch (error) {
          await deleteLockSnapshot(interaction.guildId, channel.id).catch(() => {});
          failures.push(`${channel.name} (${channel.id})`);
        }
      } catch {
        skipped += 1;
      }
    }

    let content = `🔒 Lock-all terminé.\n`;
    content += `- Salons lockés : **${locked}**\n`;
    content += `- Déjà lockés : **${alreadyLocked}**\n`;
    content += `- Ignorés : **${skipped}**`;

    if (failures.length) {
      content += `\n- Échecs : **${failures.length}**`;
      content += `\n\nSalons en échec :\n${failures.slice(0, 15).map((v) => `• ${v}`).join('\n')}`;
      if (failures.length > 15) {
        content += `\n• ... et ${failures.length - 15} autre(s)`;
      }
    }

    return interaction.editReply({ content });
  },
};
