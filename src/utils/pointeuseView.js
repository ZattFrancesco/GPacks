// src/utils/pointeuseView.js
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");

function formatHmFromMinutes(totalMinutes) {
  const m = Math.max(0, Number(totalMinutes) || 0);
  const h = Math.floor(m / 60);
  const mi = m % 60;
  return `${h} heures ${mi} minutes`;
}

function buildPanelMessage() {
  const embed = new EmbedBuilder()
    .setTitle("Pointeuse")
    .setDescription("Clique sur **Pointer** pour ajouter du temps à ta semaine en cours.")
    .setFooter({ text: "Pointeuse" });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("pointeuse:clock")
      .setLabel("Pointer")
      .setStyle(ButtonStyle.Success)
  );

  return { embeds: [embed], components: [row] };
}

function buildRecapMessage({ weekId, totals }) {
  const lines = (totals || [])
    .map((t) => `- membre <@${t.userId}> : ${formatHmFromMinutes(t.totalMinutes)}`);

  const desc = lines.length ? lines.join("\n") : "_Aucune entrée pour cette semaine._";

  const embed = new EmbedBuilder()
    .setTitle(`Heures semaine — ${weekId}`)
    .setDescription(desc)
    .setFooter({ text: `Semaine: ${weekId}` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`pointeuse:week:prev:${weekId}`)
      .setLabel("◀️")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`pointeuse:week:next:${weekId}`)
      .setLabel("▶️")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`pointeuse:week:reset:${weekId}`)
      .setLabel("Reset semaine")
      .setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [row] };
}

module.exports = {
  buildPanelMessage,
  buildRecapMessage,
  formatHmFromMinutes,
};
