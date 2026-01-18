const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const {
  getTicketByChannel,
  setTicketStatus,
  clearPendingCloseMessage,
  getType,
  getPanel,
} = require("../../services/tickets.db");
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

	    if (String(t.status || "").toLowerCase() === "closed") {
	      return interaction.reply({ content: "ℹ️ Ce ticket est déjà fermé.", ephemeral: true });
	    }

	    // Si une demande de confirmation était en attente, on la nettoie (sinon elle reste dans le salon).
	    if (t.pending_close_message_id) {
	      try {
	        const pending = await channel.messages.fetch(String(t.pending_close_message_id));
	        await pending.delete().catch(() => pending.edit({ components: [] }).catch(() => {}));
	      } catch {}
	      try {
	        await clearPendingCloseMessage(guildId, t.ticket_id);
	      } catch {}
	    }

    // Retire la vue au créateur
    try {
      await channel.permissionOverwrites.edit(t.author_user_id, { ViewChannel: false });
    } catch {}

	    await setTicketStatus(guildId, t.ticket_id, "closed");
	    const closedTicket = { ...t, status: "closed" };

	    // Refresh l'embed de contrôle (fiable): on privilégie l'ID stocké en DB.
	    // Avant, on cherchait dans les 10 derniers messages => ça rate souvent si le ticket a déjà du trafic.
	    try {
	      const type = await getType(guildId, t.type_id);
	      const panel = await getPanel(guildId, t.panel_id);

	      let botMsg = null;
	      if (t.control_message_id) {
	        try {
	          botMsg = await channel.messages.fetch(String(t.control_message_id));
	        } catch {
	          botMsg = null;
	        }
	      }

	      // Fallback: on élargit la recherche (25) si l'ID est manquant/incorrect.
	      if (!botMsg) {
	        const msgs = await channel.messages.fetch({ limit: 25 });
	        botMsg = [...msgs.values()].find(
	          (m) => m.author?.id === interaction.client.user.id && m.embeds?.length
	        );
	      }

	      if (botMsg) {
	        await botMsg.edit({
	          embeds: [buildTicketControlEmbed({ ticket: closedTicket, type, panel, channel })],
	          components: buildTicketOpenRows(t.ticket_id, { isClosed: true }),
	        });
	      }
	    } catch {}

    return interaction.reply({ content: "✅ Ticket fermé (force-close).", ephemeral: true });
  },
};
