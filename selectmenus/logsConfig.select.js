// selectmenus/logsConfig.select.js
const { MessageFlags } = require("discord.js");
const logsDb = require("../services/logs.db");
const { buildLogsConfigEmbed, buildLogsConfigComponents, MODULES } = require("../src/utils/logsUtils");

module.exports = {
  idPrefix: "logscfg:",
  async execute(interaction) {
    if (!interaction.memberPermissions?.has("Administrator")) {
      return interaction.reply({ content: "❌ Admin uniquement.", flags: MessageFlags.Ephemeral });
    }

    const kind = String(interaction.customId).split(":")[1];
    await logsDb.ensureTables();

    const cfg = await logsDb.getConfig(interaction.guildId);

    if (kind === "channel") {
      const picked = interaction.values?.[0] || null;
      cfg.channelId = picked ? String(picked) : null;
      await logsDb.upsertConfig(cfg);
    }

    if (kind === "modules") {
      // values = enabled modules
      const enabled = new Set((interaction.values || []).map((v) => String(v).toUpperCase()));
      const mods = { ...(cfg.modules || {}) };
      for (const m of MODULES) {
        mods[m.key] = enabled.has(m.key);
      }
      cfg.modules = mods;
      await logsDb.upsertConfig(cfg);
    }

    if (kind === "minlevel") {
      const lvl = String(interaction.values?.[0] || "INFO").toUpperCase();
      cfg.minLevel = lvl;
      await logsDb.upsertConfig(cfg);
    }

    const fresh = await logsDb.getConfig(interaction.guildId);
    const embed = await buildLogsConfigEmbed(interaction.guildId);

    return interaction.update({
      embeds: [embed],
      components: buildLogsConfigComponents(fresh),
    });
  },
};
