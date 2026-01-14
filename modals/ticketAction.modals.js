const { setTicketStatus, getTicketById, getType, getPanel } = require("../services/tickets.db");
const { buildTranscriptAttachment } = require("../src/utils/ticketTranscript");
const { buildTicketControlEmbed, buildTicketOpenRows } = require("../src/utils/ticketViews");

async function refreshControl(channel, client, ticket, type, panel) {
  try {
    const msgs = await channel.messages.fetch({ limit: 15 });
    const botMsg = [...msgs.values()].find((m) => m.author?.id === client.user.id && m.embeds?.length);
    if (!botMsg) return;
    await botMsg.edit({
      embeds: [buildTicketControlEmbed({ ticket, type, panel, channel })],
      components: buildTicketOpenRows(ticket.ticket_id, { isClosed: ticket.status === "closed" }),
    });
  } catch {}
}

const renameModal = {
  idPrefix: "ticket:renameModal:",

  async execute(interaction, client) {
    const parts = interaction.customId.split(":");
    const ticketId = parts[2];
    const newName = (interaction.fields.getTextInputValue("name") || "").trim();
    if (!ticketId || !newName) {
      return interaction.reply({ content: "❌ Nom invalide.", ephemeral: true });
    }

    try {
      await interaction.channel.setName(newName.slice(0, 90));
    } catch {
      return interaction.reply({ content: "❌ Je ne peux pas rename ce salon (permissions ?).", ephemeral: true });
    }
    return interaction.reply({ content: "✅ Salon renommé.", ephemeral: true });
  },
};

const deleteDmModal = {
  idPrefix: "ticket:deleteDmModal:",

  async execute(interaction, client) {
    const parts = interaction.customId.split(":");
    const ticketId = parts[2];
    const dm = (interaction.fields.getTextInputValue("message") || "").trim();
    if (!ticketId) return interaction.reply({ content: "❌ Ticket invalide.", ephemeral: true });

    const guildId = interaction.guildId;
    const ticket = await getTicketById(guildId, ticketId);
    if (!ticket) return interaction.reply({ content: "❌ Ticket introuvable.", ephemeral: true });

    // Transcript
    let attachment = null;
    try {
      attachment = await buildTranscriptAttachment(interaction.channel, `ticket-${ticket.ticket_id}`);
    } catch {}

    // DM
    try {
      const user = await client.users.fetch(ticket.author_user_id);
      if (user) {
        await user.send({
          content:
            `📌 Ton ticket #${ticket.ticket_id} a été supprimé.` +
            (dm ? `\n\n📝 Message staff:\n${dm}` : ""),
          files: attachment ? [attachment] : [],
        });
      }
    } catch {}

    await setTicketStatus(guildId, ticket.ticket_id, "deleted");
    try {
      await interaction.channel.delete(`Ticket deleted #${ticket.ticket_id}`);
    } catch {
      return interaction.reply({ content: "⚠️ Je n'ai pas pu supprimer le salon (permissions ?).", ephemeral: true });
    }
  },
};

module.exports = [renameModal, deleteDmModal];
