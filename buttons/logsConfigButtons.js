// buttons/logsConfigButtons.js
const { MessageFlags } = require("discord.js");
const logsDb = require("../services/logs.db");
const { buildLogsConfigEmbed, buildLogsConfigComponents } = require("../src/utils/logsUtils");

module.exports = {
  idPrefix: "logscfg:",
  async execute(interaction) {
    // Only admins
    if (!interaction.memberPermissions?.has("Administrator")) {
      return interaction.reply({ content: "❌ Admin uniquement.", flags: MessageFlags.Ephemeral });
    }

    const action = String(interaction.customId).split(":")[1];
    await logsDb.ensureTables();

    const cfg = await logsDb.getConfig(interaction.guildId);

    if (action === "toggle") {
      cfg.enabled = !cfg.enabled;
      await logsDb.upsertConfig(cfg);
    }

    if (action === "clearChannel") {
      cfg.channelId = null;
      await logsDb.upsertConfig(cfg);
    }

    // refresh / default
    const fresh = await logsDb.getConfig(interaction.guildId);
    const embed = await buildLogsConfigEmbed(interaction.guildId);

    // Try update if possible, else reply
    try {
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({
          embeds: [embed],
          components: buildLogsConfigComponents(fresh),
        });
      }
      return interaction.update({
        embeds: [embed],
        components: buildLogsConfigComponents(fresh),
      });
    } catch {
      return interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [embed],
        components: buildLogsConfigComponents(fresh),
      });
    }
  },
};
