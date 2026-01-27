// src/utils/pointeuseSetupView.js
const {
  EmbedBuilder,
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  RoleSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

function buildDashboard(settings) {
  const embed = new EmbedBuilder()
    .setTitle("Dashboard Pointeuse")
    .setDescription(
      "Configure le panel, le recap, les logs et les rôles staff.\n\n" +
        `• Panel channel: ${settings?.panel_channel_id ? `<#${settings.panel_channel_id}>` : "Non configuré"}\n` +
        `• Recap channel: ${settings?.recap_channel_id ? `<#${settings.recap_channel_id}>` : "Non configuré"}\n` +
        `• Logs channel: ${settings?.logs_channel_id ? `<#${settings.logs_channel_id}>` : "Non configuré"}\n` +
        `• Staff roles: ${(settings?.staff_roles?.length || 0)
          ? settings.staff_roles.map((r) => `<@&${r}>`).join(" ")
          : "Non configuré"}`
    )
    .setFooter({ text: "Pointeuse" });

  const row1 = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId("pointeuse:setup:panel_ch")
      .setPlaceholder("Choisir le salon du panel (bouton Pointer)")
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId("pointeuse:setup:recap_ch")
      .setPlaceholder("Choisir le salon du recap semaine")
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId("pointeuse:setup:logs_ch")
      .setPlaceholder("Choisir le salon des logs")
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
  );

  const row4 = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId("pointeuse:setup:staff_roles")
      .setPlaceholder("Choisir les rôles staff (multi)")
      .setMinValues(0)
      .setMaxValues(10)
  );

  const row5 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("pointeuse:setup:publish_panel")
      .setLabel("Publier / Mettre à jour Panel")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("pointeuse:setup:publish_recap")
      .setLabel("Publier / Mettre à jour Recap")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("pointeuse:setup:close")
      .setLabel("Fermer")
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row1, row2, row3, row4, row5] };
}

module.exports = { buildDashboard };
