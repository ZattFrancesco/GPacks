const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { getTicketByChannel, setTicketStatus, getType, getPanel } = require("../../services/tickets.db");
const { buildTicketControlEmbed, buildTicketOpenRows } = require("../../src/utils/ticketViews");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("force-close")
    .setDescription("Ferme un ticket sans confirmation (staff)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const channel = interaction.channel;

    const t = await getTicketByChannel(guildId, channel.id);
    if (!t) return interaction.reply({ content: "❌ Ce salon n'est pas un ticket.", ephemeral: true });

    // Retire la vue au créateur
    try {
      await channel.permissionOverwrites.edit(t.author_user_id, { ViewChannel: false });
    } catch {}

    await setTicketStatus(guildId, t.ticket_id, "closed");

    // Refresh l'embed de contrôle si possible (dernier message du bot)
    try {
      const type = await getType(guildId, t.type_id);
      const panel = await getPanel(guildId, t.panel_id);
      const msgs = await channel.messages.fetch({ limit: 10 });
      const botMsg = [...msgs.values()].find((m) => m.author?.id === interaction.client.user.id && m.embeds?.length);
      if (botMsg) {
        await botMsg.edit({
          embeds: [buildTicketControlEmbed({ ticket: { ...t, status: "closed" }, type, panel, channel })],
          components: buildTicketOpenRows(t.ticket_id, { isClosed: true }),
        });
      }
    } catch {}

    return interaction.reply({ content: "✅ Ticket fermé (force-close).", ephemeral: true });
  },
};
