const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { isOwner } = require('../../src/utils/permissions');

function toCommandJson(cmd) {
  try {
    return cmd?.data?.toJSON ? cmd.data.toJSON() : null;
  } catch {
    return null;
  }
}

function getSubcommandSummary(json) {
  if (!json?.options?.length) return '';

  const subcommands = json.options
    .filter((opt) => opt.type === 1)
    .map((opt) => opt.name);

  if (!subcommands.length) return '';
  return ` — ${subcommands.map((name) => `\
\`${name}\``).join(', ')}`.replace('\n', '');
}

function parseDefaultPerms(cmd) {
  const json = toCommandJson(cmd);
  const raw = json?.default_member_permissions;
  if (raw == null) return null;

  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

function canUseCommand(interaction, cmd) {
  if (!cmd?.data?.name) return false;

  if (cmd.ownerOnly) {
    return isOwner(interaction.user.id);
  }

  if (!interaction.inGuild()) {
    return true;
  }

  const perms = parseDefaultPerms(cmd);
  if (perms == null) return true;

  try {
    return interaction.memberPermissions?.has(perms);
  } catch {
    try {
      return new PermissionsBitField(interaction.memberPermissions?.bitfield ?? 0n).has(perms);
    } catch {
      return false;
    }
  }
}

function getAccessBucket(cmd) {
  if (cmd.ownerOnly) {
    return {
      key: 'owner',
      title: '👑 Owner',
      order: 0,
    };
  }

  const perms = parseDefaultPerms(cmd);
  if (perms == null || perms === 0n) {
    return {
      key: 'simple',
      title: '📦 Simples',
      order: 3,
    };
  }

  const adminBit = BigInt(PermissionsBitField.Flags.Administrator);
  if ((perms & adminBit) === adminBit) {
    return {
      key: 'admin',
      title: '🛠️ Admin',
      order: 1,
    };
  }

  return {
    key: 'staff',
    title: '🔐 Staff',
    order: 2,
  };
}

function formatCommandLine(cmd) {
  const json = toCommandJson(cmd);
  const name = json?.name || cmd.data.name;
  const description = json?.description || 'Aucune description';
  const subSummary = getSubcommandSummary(json);

  return `• \
\`/${name}\` — ${description}${subSummary}`.replace('\n', '');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Voir les commandes disponibles'),

  async execute(interaction) {
    const commands = [...interaction.client.commands.values()]
      .filter((cmd) => canUseCommand(interaction, cmd))
      .sort((a, b) => a.data.name.localeCompare(b.data.name, 'fr'));

    const buckets = new Map();

    for (const cmd of commands) {
      const bucket = getAccessBucket(cmd);
      if (!buckets.has(bucket.key)) {
        buckets.set(bucket.key, { ...bucket, lines: [] });
      }
      buckets.get(bucket.key).lines.push(formatCommandLine(cmd));
    }

    const orderedBuckets = [...buckets.values()].sort((a, b) => a.order - b.order);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('📖 Aide des commandes')
      .setDescription('Tu vois seulement les commandes auxquelles tu as accès.')
      .setFooter({ text: `Total : ${commands.length} commande${commands.length > 1 ? 's' : ''}` })
      .setTimestamp();

    if (!orderedBuckets.length) {
      embed.addFields({
        name: 'Aucune commande',
        value: 'Je n’ai trouvé aucune commande disponible pour toi.',
      });
    } else {
      for (const bucket of orderedBuckets) {
        const value = bucket.lines.join('\n').slice(0, 1024);
        embed.addFields({
          name: `${bucket.title} (${bucket.lines.length})`,
          value: value || '—',
        });
      }
    }

    return interaction.reply({
      embeds: [embed],
      flags: 64,
    });
  },
};
