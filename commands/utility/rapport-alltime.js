const { EmbedBuilder } = require('discord.js');
const { buildPaginationComponents } = require('../../utils/pagination');
const {
  listReportsAll,
  countReportsAll
} = require('../../services/rapportJugement.db');

const PAGE_SIZE = 10;

module.exports = {
  name: 'rapport-alltime',
  description: 'Afficher tous les rapports avec pagination',

  async execute(interaction) {
    const page = 1;
    const total = await countReportsAll();
    const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const reports = await listReportsAll(0, PAGE_SIZE);

    if (!reports.length) {
      return interaction.reply({
        content: '❌ Aucun rapport trouvé.',
        ephemeral: true
      });
    }

    const embed = buildEmbed(reports, page, maxPage);

    const reply = await interaction.reply({
      embeds: [embed],
      fetchReply: true
    });

    await interaction.editReply({
      components: buildPaginationComponents({
        page,
        maxPage,
        messageId: reply.id
      })
    });
  }
};

function truncate(str, max = 700) {
  if (!str) return '—';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function buildEmbed(reports, page, maxPage) {
  const embed = new EmbedBuilder()
    .setTitle('📚 Rapports – Tous')
    .setColor(0x2b2d31)
    .setFooter({ text: `Page ${page} / ${maxPage}` });

  for (const r of reports) {
    embed.addFields({
      name: `Rapport #${r.id}`,
      value: truncate(r.observation || r.faits)
    });
  }

  return embed;
}