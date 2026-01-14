const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { getPanel, deletePanel } = require("../../services/tickets.db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket-panel-delete")
    .setDescription("Supprimer un panel (message + DB)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((o) => o.setName("id").setDescription("ID du panel").setRequired(true)),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const panelId = interaction.options.getString("id", true);
    const panel = await getPanel(guildId, panelId);
    if (!panel) return interaction.reply({ content: "❌ Panel introuvable.", ephemeral: true });

    try {
      const channel = await interaction.client.channels.fetch(panel.channel_id);
      const msg = await channel?.messages.fetch(panel.message_id);
      await msg?.delete().catch(() => {});
    } catch {}

    await deletePanel(guildId, panelId);
    return interaction.reply({ content: "✅ Panel supprimé (message + DB).", ephemeral: true });
  },
};
