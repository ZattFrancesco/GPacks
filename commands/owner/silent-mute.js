const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');
const { isOwner } = require('../../src/utils/permissions');
const {
  ensureTable,
  addSilentMute,
  getSilentMute,
  listSilentMutes,
} = require('../../services/silentMute.db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('silent-mute')
    .setDescription('Gérer les silent-mutes')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) =>
      s
        .setName('add')
        .setDescription('Ajouter un silent-mute')
        .addUserOption((o) => o.setName('user').setDescription('Membre ciblé').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Raison').setRequired(false).setMaxLength(255))
    )
    .addSubcommand((s) =>
      s
        .setName('status')
        .setDescription('Lister les silent-mutes')
    ),

    ownerOnly: true,

  async execute(interaction) {
    await ensureTable();
    const sub = interaction.options.getSubcommand(true);

    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        content: "❌ Cette commande est réservée au propriétaire du bot.",
        flags: 64,
      });
    }

    if (sub === 'add') {
      const target = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason', false);

      if (target.bot) {
        return interaction.reply({ content: '❌ Impossible de silent-mute un bot.', flags: 64 });
      }
      if (target.id === interaction.user.id) {
        return interaction.reply({ content: '❌ Tu ne peux pas te silent-mute toi-même.', flags: 64 });
      }
      if (isOwner(target.id)) {
        return interaction.reply({ content: '❌ Impossible de silent-mute l’owner du bot.', flags: 64 });
      }

      const existing = await getSilentMute(interaction.guildId, target.id);
      if (existing.muted) {
        return interaction.reply({ content: `⚠️ ${target} est déjà en silent-mute.`, flags: 64 });
      }

      await addSilentMute({
        guildId: interaction.guildId,
        userId: target.id,
        addedBy: interaction.user.id,
        reason,
      });

      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (member?.voice?.channel) {
        await member.voice.disconnect(`Silent-mute par ${interaction.user.tag} (${interaction.user.id})`).catch(() => {});
      }

      return interaction.reply({
        content: `✅ ${target} a été placé en silent-mute.`,
        flags: 64,
      });
    }

    if (sub === 'status') {
      const rows = await listSilentMutes(interaction.guildId, 25);
      if (!rows.length) {
        return interaction.reply({ content: '✅ Aucun utilisateur n’est en silent-mute sur ce serveur.', flags: 64 });
      }

      const lines = rows.map((r, i) => {
        const reason = r.reason ? ` — ${r.reason}` : '';
        return `${i + 1}. <@${r.user_id}> (\`${r.user_id}\`)${reason}`;
      });

      const embed = new EmbedBuilder()
        .setTitle('Silent-mutes du serveur')
        .setDescription(lines.join('\n').slice(0, 4000))
        .setFooter({ text: `Total affiché: ${rows.length} (max 25)` });

      return interaction.reply({ embeds: [embed], flags: 64 });
    }
  },
};
