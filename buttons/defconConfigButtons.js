// buttons/defconConfigButtons.js
const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");

const defconDb = require("../services/defcon.db");
const { buildConfigEmbed, buildConfigButtons } = require("../src/utils/defconUtils");

function makeModal(level, current) {
  const modal = new ModalBuilder()
    .setCustomId(`defconcfgmodal:${level}`)
    .setTitle(`Configurer DEFCON ${level}`);

  const messageInput = new TextInputBuilder()
    .setCustomId("message")
    .setLabel("Message (dans l'embed)")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(4000)
    .setValue(current?.message ? String(current.message).slice(0, 4000) : `DEFCON ${level} activé.`);

  const colorInput = new TextInputBuilder()
    .setCustomId("color")
    .setLabel("Couleur (hex ex: #ff0000) ou vide")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(16)
    .setValue(
      current?.color !== null && current?.color !== undefined
        ? `#${Number(current.color).toString(16).padStart(6, "0")}`
        : ""
    );

  const footerInput = new TextInputBuilder()
    .setCustomId("footer")
    .setLabel("Footer (optionnel)")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(255)
    .setValue(current?.footer ? String(current.footer).slice(0, 255) : "");

  modal.addComponents(
    new ActionRowBuilder().addComponents(messageInput),
    new ActionRowBuilder().addComponents(colorInput),
    new ActionRowBuilder().addComponents(footerInput),
  );

  return modal;
}

module.exports = {
  idPrefix: "defconcfg:",
  async execute(interaction) {
    const parts = String(interaction.customId).split(":");
    const level = Number(parts[1]);
    if (![1, 2, 3, 4, 5].includes(level)) {
      return interaction.reply({ content: "❌ DEFCON invalide.", flags: 64 });
    }

    const current = await defconDb.getDefconMessage(level);
    const modal = makeModal(level, current);

    // Ouvre le modal (pas de spam)
    await interaction.showModal(modal);
  },
};
