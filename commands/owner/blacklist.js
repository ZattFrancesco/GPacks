const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
} = require("discord.js");

const { isOwner } = require("../../src/utils/permissions");
const { listBlacklisted } = require("../../services/blacklist.db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("blacklist")
    .setDescription("Gestion blacklist globale du bot")
    .addSubcommand((s) => s.setName("add").setDescription("Restreint l'utilisation du bot a l'utilisateur entré."))
    .addSubcommand((s) => s.setName("remove").setDescription("Annule la restriction de l'utilisation du bot."))
    .addSubcommand((s) => s.setName("status").setDescription("Afficher la liste de membres restreints."))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: "❌ Réservé au développeur du bot.", ephemeral: true });
    }

    const sub = interaction.options.getSubcommand(true);

    // --- ADD ---
    if (sub === "add") {
      const modal = new ModalBuilder()
        .setCustomId("blacklist:add")
        .setTitle("Blacklist - Ajouter");

      const userIdInput = new TextInputBuilder()
        .setCustomId("user")
        .setLabel("User ID ou mention")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: 123456789012345678 ou <@123...>")
        .setRequired(true)
        .setMaxLength(64);

      const reasonInput = new TextInputBuilder()
        .setCustomId("reason")
        .setLabel("Raison (optionnel)")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Ex: spam, abus, etc.")
        .setRequired(false)
        .setMaxLength(255);

      modal.addComponents(
        new ActionRowBuilder().addComponents(userIdInput),
        new ActionRowBuilder().addComponents(reasonInput)
      );

      return interaction.showModal(modal);
    }

    // --- REMOVE ---
    if (sub === "remove") {
      const modal = new ModalBuilder()
        .setCustomId("blacklist:remove")
        .setTitle("Blacklist - Retirer");

      const userIdInput = new TextInputBuilder()
        .setCustomId("user")
        .setLabel("User ID ou mention")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: 123456789012345678 ou <@123...>")
        .setRequired(true)
        .setMaxLength(64);

      modal.addComponents(new ActionRowBuilder().addComponents(userIdInput));
      return interaction.showModal(modal);
    }

    // --- STATUS ---
    if (sub === "status") {
      const rows = await listBlacklisted(25);

      if (!rows.length) {
        return interaction.reply({ content: "✅ Aucune personne n'est blacklistée.", ephemeral: true });
      }

      const lines = rows.map((r, i) => {
        const reason = r.reason ? ` — ${r.reason}` : "";
        return `${i + 1}. <@${r.user_id}> (\`${r.user_id}\`)${reason}`;
      });

      const embed = new EmbedBuilder()
        .setTitle("📛 Blacklist du bot")
        .setDescription(lines.join("\n").slice(0, 4000))
        .setFooter({ text: `Total affiché: ${rows.length} (max 25)` });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};