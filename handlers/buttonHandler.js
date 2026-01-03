const { EmbedBuilder } = require('discord.js');
const { buildPaginationComponents } = require('../utils/pagination');
const {
  listReportsWeek,
  listReportsAll,
  countReportsWeek,
  countReportsAll
} = require('../services/rapportJugement.db');

const PAGE_SIZE = 10;

module.exports = async (interaction) => {
  if (!interaction.isButton()) return;

  const [action, messageId] = interaction.customId.split(':');

  if (!messageId || interaction.message.id !== messageId) {
    return interaction.reply({
      content: '❌ Bouton expiré ou invalide.',
      ephemeral: true
    });
  }

  const footer = interaction.message.embeds[0]?.footer?.text || '';
  let page = Number(footer.match(/Page (\d+)/)?.[1]) || 1;

  if (action === 'rapport_prev') page--;
  if (action === 'rapport_next') page++;

  const isWeek = interaction.message.embeds[0].title.includes('Semaine');

  const total = isWeek
    ? await countReportsWeek()
    : await countReportsAll();

  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  page = Math.min(Math.max(page, 1), maxPage);

  const offset = (page - 1) * PAGE_SIZE;

  const reports = isWeek
    ? await listReportsWeek(offset, PAGE_SIZE)
    : await listReportsAll(offset, PAGE_SIZE);

  const embed = new EmbedBuilder()
    .setTitle(isWeek ? '📄 Rapports – Semaine' : '📚 Rapports – Tous')
    .setColor(0x2b2d31)
    .setFooter({ text: `Page ${page} / ${maxPage}` });

  for (const r of reports) {
    embed.addFields({
      name: `Rapport #${r.id}`,
      value: (r.observation || r.faits || '—').slice(0, 700)
    });
  }

  await interaction.update({
    embeds: [embed],
    components: buildPaginationComponents({
      page,
      maxPage,
      messageId
    })
  });
};