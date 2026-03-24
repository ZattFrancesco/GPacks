const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { ensureTable, getSilentMute, removeSilentMute } = require('../../services/silentMute.db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('silent-unmute')
    .setDescription('Retire le silent-mute d’un utilisateur')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((o) => o.setName('user').setDescription('Utilisateur à retirer du silent-mute').setRequired(true)),

  async execute(interaction) {
    await ensureTable();

    const target = interaction.options.getUser('user', true);
    const existing = await getSilentMute(interaction.guildId, target.id);

    if (!existing.muted) {
      return interaction.reply({ content: `⚠️ ${target} n’est pas en silent-mute.`, flags: 64 });
    }

    await removeSilentMute(interaction.guildId, target.id);
    return interaction.reply({ content: `✅ ${target} n’est plus en silent-mute.`, flags: 64 });
  },
};
