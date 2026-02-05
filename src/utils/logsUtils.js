// src/utils/logsUtils.js
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  StringSelectMenuBuilder,
} = require("discord.js");

const logsDb = require("../../services/logs.db");

const MODULES = [
  { key: "DEFCON", label: "DEFCON" },
  { key: "RAPPORTS", label: "RAPPORTS" },
  { key: "TICKETS", label: "TICKETS" },
  { key: "VISAS", label: "VISAS" },
  { key: "PLANNING", label: "PLANNING" },
  { key: "BLACKLIST", label: "BLACKLIST" },
];

function onoff(b) {
  return b ? "✅" : "❌";
}

async function buildLogsConfigEmbed(guildId) {
  const cfg = await logsDb.getConfig(guildId);

  const enabledLine = cfg.enabled ? "✅ Activé" : "❌ Désactivé";
  const channelLine = cfg.channelId ? `<#${cfg.channelId}>` : "_(aucun salon)_";
  const minLevelLine = `**${cfg.minLevel}**`;

  const mods = MODULES.map((m) => `${onoff(Boolean(cfg.modules?.[m.key]))} ${m.label}`).join("\n");

  const e = new EmbedBuilder()
    .setTitle("Dashboard Logs (audit)")
    .setDescription(
      "Configure **quoi** loguer et **où** envoyer les logs.\n" +
        "📌 Même sans salon, les logs sont conservés en **DB** (historique)."
    )
    .addFields(
      { name: "Logs", value: enabledLine, inline: true },
      { name: "Niveau minimum", value: minLevelLine, inline: true },
      { name: "Salon logs", value: channelLine, inline: true },
      { name: "Modules loggés", value: mods || "_(vide)_", inline: false }
    );

  return e;
}

function buildLogsConfigComponents(cfg) {
  const rows = [];

  // Row 1: Enable/disable + refresh
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("logscfg:toggle")
        .setLabel(cfg.enabled ? "Désactiver" : "Activer")
        .setStyle(cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("logscfg:refresh")
        .setLabel("Rafraîchir")
        .setStyle(ButtonStyle.Secondary)
    )
  );

  // Row 2: Channel select
  rows.push(
    new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId("logscfg:channel")
        .setPlaceholder(cfg.channelId ? "Changer le salon logs" : "Choisir le salon logs")
        .addChannelTypes(ChannelType.GuildText)
    )
  );

  // Row 3: Modules multi-select
  const modSelect = new StringSelectMenuBuilder()
    .setCustomId("logscfg:modules")
    .setPlaceholder("Activer/Désactiver des modules (multi-select)")
    .setMinValues(0)
    .setMaxValues(MODULES.length);

  for (const m of MODULES) {
    modSelect.addOptions({
      label: m.label,
      value: m.key,
      default: Boolean(cfg.modules?.[m.key]),
    });
  }

  rows.push(new ActionRowBuilder().addComponents(modSelect));

  // Row 4: Min level
  rows.push(
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("logscfg:minlevel")
        .setPlaceholder("Niveau minimum")
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(
          { label: "INFO (tout)", value: "INFO", default: cfg.minLevel === "INFO" },
          { label: "WARN (warnings + errors)", value: "WARN", default: cfg.minLevel === "WARN" },
          { label: "ERROR (erreurs seulement)", value: "ERROR", default: cfg.minLevel === "ERROR" }
        )
    )
  );

  // Row 5: Clear channel (optional)
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("logscfg:clearChannel")
        .setLabel("Retirer le salon")
        .setStyle(ButtonStyle.Secondary)
    )
  );

  return rows.slice(0, 5);
}

module.exports = {
  buildLogsConfigEmbed,
  buildLogsConfigComponents,
  MODULES,
};
