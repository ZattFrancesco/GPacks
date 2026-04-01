const { SlashCommandBuilder, PermissionFlagsBits, OverwriteType } = require('discord.js');
const {
  ensureTables,
  listLockSnapshots,
  deleteLockSnapshot,
  parseOverwritesJson,
} = require('../../services/channelLocks.db');

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
    .setName('unlock-all')
    .setDescription('Déverrouiller tous les salons')
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

    const snapshots = await listLockSnapshots(interaction.guildId);
    if (!snapshots.length) {
      return interaction.editReply({
        content: '⚠️ Aucun salon locké trouvé en DB pour ce serveur.',
      });
    }

    let unlocked = 0;
    let missing = 0;
    const failures = [];

    for (const row of snapshots) {
      const channel = interaction.guild.channels.cache.get(row.channel_id)
        || await interaction.guild.channels.fetch(row.channel_id).catch(() => null);

      if (!channel || channel.isThread?.() || typeof channel.permissionOverwrites?.set !== 'function') {
        missing += 1;
        await deleteLockSnapshot(interaction.guildId, row.channel_id).catch(() => {});
        continue;
      }

      try {
        const overwrites = parseOverwritesJson(row.overwrites_json).map(normalizeOverwrite);
        await channel.permissionOverwrites.set(
          overwrites,
          `Unlock-all par ${interaction.user.tag} (${interaction.user.id})`
        );
        await deleteLockSnapshot(interaction.guildId, row.channel_id);
        unlocked += 1;
      } catch {
        failures.push(`${channel.name} (${channel.id})`);
      }
    }

    let content = `🔓 Unlock-all terminé.\n`;
    content += `- Salons restaurés : **${unlocked}**\n`;
    content += `- Snapshots supprimés car salon introuvable/incompatible : **${missing}**`;

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
