const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

function buildPaginationComponents({ page, maxPage, messageId }) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`rapport_prev:${messageId}`)
        .setLabel('⬅️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 1),

      new ButtonBuilder()
        .setCustomId(`rapport_next:${messageId}`)
        .setLabel('➡️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= maxPage),

      new ButtonBuilder()
        .setCustomId(`rapport_goto:${messageId}`)
        .setLabel('🔎 Aller')
        .setStyle(ButtonStyle.Primary)
    )
  ];
}

module.exports = { buildPaginationComponents };