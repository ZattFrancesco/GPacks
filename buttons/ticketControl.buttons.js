const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  PermissionFlagsBits,
} = require("discord.js");

const {
  getTicketById,
  setTicketStatus,
  getType,
  getPanel,
} = require("../services/tickets.db");

const { buildTranscriptAttachment } = require("../src/utils/ticketTranscript");
const { buildTicketControlEmbed, buildTicketOpenRows } = require("../src/utils/ticketViews");

function isStaff(member, staffRoleIds) {
  if (!member) return false;
  if (member.permissions?.has?.(PermissionFlagsBits.ManageChannels)) return true;
  const set = new Set(staffRoleIds || []);
  return member.roles?.cache?.some((r) => set.has(r.id)) || false;
}

async function refreshControlMessage(channel, client, ticket, type, panel) {
  try {
    const msgs = await channel.messages.fetch({ limit: 15 });
    const botMsg = [...msgs.values()].find(
      (m) => m.author?.id === client.user.id && m.embeds?.length
    );
    if (!botMsg) return;
    await botMsg.edit({
      embeds: [buildTicketControlEmbed({ ticket, type, panel, channel })],
      components: buildTicketOpenRows(ticket.ticket_id, { isClosed: ticket.status === "closed" }),
    });
  } catch {}
}

module.exports = {
  idPrefix: "ticket:",

  async execute(interaction, client) {
    const parts = interaction.customId.split(":");
    const action = parts[1];
    const ticketId = parts[2];

    const guildId = interaction.guildId;
    const channel = interaction.channel;

    // Actions qui n'ont pas de ticketId (rare)
    if (!action) return;

    // --- Helper charge ticket ---
    const ticket = ticketId ? await getTicketById(guildId, ticketId) : null;
    if (ticketId && !ticket) {
      return interaction.reply({ content: "❌ Ticket introuvable (DB).", ephemeral: true });
    }

    const type = ticket ? await getType(guildId, ticket.type_id) : null;
    const panel = ticket ? await getPanel(guildId, ticket.panel_id) : null;
    const staffRoleIds = type?.staff_role_ids || JSON.parse(type?.staff_role_ids_json || "[]");

    // Permission staff (pour la plupart des actions)
    const needStaff = [
      "close",
      "rename",
      "members",
      "reopen",
      "delete",
      "member",
      "confirmclose",
      "cancelclose",
      "delete_mp",
      "delete_nom",
    ].includes(action);

    if (needStaff && !isStaff(interaction.member, staffRoleIds)) {
      return interaction.reply({ content: "❌ Réservé au staff.", ephemeral: true });
    }

    // ---------------- CLOSE (demande confirmation au créateur) ----------------
    if (action === "close") {
      if (ticket.status === "closed") {
        return interaction.reply({ content: "ℹ️ Déjà fermé.", ephemeral: true });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket:closeconfirm:${ticket.ticket_id}`)
          .setLabel("Confirmer")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`ticket:closecancel:${ticket.ticket_id}`)
          .setLabel("Annuler")
          .setStyle(ButtonStyle.Secondary)
      );

      await channel.send({
        content: `<@${ticket.author_user_id}> le staff veut fermer ce ticket. Tu confirmes ?`,
        components: [row],
      });

      return interaction.reply({ content: "✅ Demande de confirmation envoyée au créateur.", ephemeral: true });
    }

    if (action === "closeconfirm") {
      if (interaction.user.id !== ticket.author_user_id) {
        return interaction.reply({ content: "❌ Seul le créateur peut confirmer.", ephemeral: true });
      }

      try {
        await channel.permissionOverwrites.edit(ticket.author_user_id, { ViewChannel: false });
      } catch {}

      await setTicketStatus(guildId, ticket.ticket_id, "closed");
      const updated = { ...ticket, status: "closed" };
      await refreshControlMessage(channel, client, updated, type, panel);

      try {
        await interaction.message.edit({ components: [] });
      } catch {}

      return interaction.reply({ content: "✅ Ticket fermé.", ephemeral: true });
    }

    if (action === "closecancel") {
      if (interaction.user.id !== ticket.author_user_id) {
        return interaction.reply({ content: "❌ Seul le créateur peut annuler.", ephemeral: true });
      }
      try {
        await interaction.message.edit({ components: [] });
      } catch {}
      return interaction.reply({ content: "✅ Fermeture annulée.", ephemeral: true });
    }

    // ---------------- REOPEN ----------------
    if (action === "reopen") {
      if (ticket.status !== "closed") {
        return interaction.reply({ content: "❌ Ce ticket n'est pas fermé.", ephemeral: true });
      }

      try {
        await channel.permissionOverwrites.edit(ticket.author_user_id, { ViewChannel: true });
      } catch {}

      await setTicketStatus(guildId, ticket.ticket_id, "open");
      const updated = { ...ticket, status: "open" };
      await refreshControlMessage(channel, client, updated, type, panel);

      return interaction.reply({ content: "✅ Ticket ré-ouvert.", ephemeral: true });
    }

    // ---------------- RENAME ----------------
    if (action === "rename") {
      const modal = new ModalBuilder()
        .setCustomId(`ticket:renamemodal:${ticket.ticket_id}`)
        .setTitle("Renommer le ticket");

      const input = new TextInputBuilder()
        .setCustomId("name")
        .setLabel("Nouveau nom de salon (sans #)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(90)
        .setValue(channel.name);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    // ---------------- MEMBERS (user select) ----------------
    if (action === "members") {
      const userSelect = new UserSelectMenuBuilder()
        .setCustomId(`ticket:memberpick:${ticket.ticket_id}`)
        .setPlaceholder("Choisis un membre...")
        .setMinValues(1)
        .setMaxValues(1);

      const row = new ActionRowBuilder().addComponents(userSelect);
      return interaction.reply({
        content: "Choisis un membre, puis tu pourras l'ajouter ou le retirer.",
        components: [row],
        ephemeral: true,
      });
    }

    // ---------------- DELETE (choix MP) ----------------
    if (action === "delete") {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket:delete_mp:${ticket.ticket_id}`)
          .setLabel("MP au créateur : OUI")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`ticket:delete_nom:${ticket.ticket_id}`)
          .setLabel("MP au créateur : NON")
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.reply({
        content: "Avant de supprimer : tu veux envoyer un MP au créateur ?",
        components: [row],
        ephemeral: true,
      });
    }

    if (action === "delete_mp") {
      // Modal message
      const modal = new ModalBuilder()
        .setCustomId(`ticket:deletemodal:${ticket.ticket_id}`)
        .setTitle("Message au créateur (optionnel)");

      const input = new TextInputBuilder()
        .setCustomId("msg")
        .setLabel("Message")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(1500);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    if (action === "delete_nom") {
      // Pas de message, on supprime direct
      await interaction.reply({ content: "✅ Suppression en cours...", ephemeral: true });
      return deleteTicketNow({ interaction, client, ticket, type, panel, dmMessage: null });
    }

    // Les actions "member" / modals / selects sont gérées ailleurs
    return;
  },
};

async function deleteTicketNow({ interaction, client, ticket, type, panel, dmMessage }) {
  const guildId = interaction.guildId;
  const channel = interaction.channel;

  // Transcript
  let attachment = null;
  try {
    attachment = await buildTranscriptAttachment(channel, `ticket-${ticket.ticket_id}`);
  } catch {}

  // DM créateur
  try {
    const user = await client.users.fetch(ticket.author_user_id);
    if (user) {
      const files = attachment ? [attachment] : [];
      await user.send({
        content:
          `📌 Ton ticket #${ticket.ticket_id} a été supprimé.` +
          (dmMessage ? `\n\n📝 Message staff:\n${dmMessage}` : ""),
        files,
      });
    }
  } catch {}

  // DB
  try {
    await setTicketStatus(guildId, ticket.ticket_id, "deleted");
  } catch {}

  // Delete channel
  try {
    await channel.delete(`Ticket deleted #${ticket.ticket_id}`);
  } catch {
    try {
      await interaction.followUp({ content: "⚠️ Je n'ai pas pu supprimer le salon (permissions ?).", ephemeral: true });
    } catch {}
  }
}
