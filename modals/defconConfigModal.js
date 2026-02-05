// modals/defconConfigModal.js
const defconDb = require("../services/defcon.db");
const { auditLog } = require("../src/utils/auditLog");
const { buildConfigEmbed, buildConfigButtons, parseColorInput } = require("../src/utils/defconUtils");

module.exports = {
  idPrefix: "defconcfgmodal:",
  async execute(interaction) {
    const level = Number(String(interaction.customId).split(":")[1]);
    if (![1, 2, 3, 4, 5].includes(level)) {
      return interaction.reply({ content: "❌ DEFCON invalide.", ephemeral: true });
    }

    const message = interaction.fields.getTextInputValue("message")?.trim();
    const colorRaw = interaction.fields.getTextInputValue("color");
    const footerRaw = interaction.fields.getTextInputValue("footer");

    const colorParsed = parseColorInput(colorRaw);
    if (colorParsed === undefined) {
      return interaction.reply({
        content: "❌ Couleur invalide. Exemple: **#ff0000** ou laisse vide.",
        ephemeral: true,
      });
    }

    const footer = footerRaw?.trim() || null;

    await defconDb.upsertDefconMessage({
      level,
      message: message || `DEFCON ${level} activé.`,
      color: colorParsed === null ? null : colorParsed,
      footer,
    });


    await auditLog(interaction.client, interaction.guildId, {
      module: "DEFCON",
      action: "CONFIG_MESSAGE",
      level: "INFO",
      userId: interaction.user.id,
      sourceChannelId: interaction.channelId,
      message: `Message DEFCON ${level} modifié.`,
      meta: { level, color: colorParsed, footer },
    });

    // On renvoie le dashboard mis à jour (éphemère)
    const embed = await buildConfigEmbed(interaction.client);
    return interaction.reply({
      ephemeral: true,
      content: "✅ DEFCON mis à jour.",
      embeds: [embed],
      components: buildConfigButtons(),
    });
  },
};
