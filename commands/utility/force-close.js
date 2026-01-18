const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
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
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addBooleanOption((opt) =>
      opt
        .setName("delete")
        .setDescription("Supprimer le salon après fermeture")
        .setRequired(false)
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const channel = interaction.channel;
    const shouldDelete = interaction.options.getBoolean("delete") ?? false;

    const t = await getTicketByChannel(guildId, channel.id);
    if (!t) return interaction.reply({ content: "❌ Ce salon n'est pas un ticket.", ephemeral: true });

    if (String(t.status || "").toLowerCase() === "closed") {
      // Si déjà fermé, tu peux quand même vouloir delete le salon :
      if (shouldDelete) {
        await interaction.reply({
          content: "ℹ️ Ticket déjà fermé. 🗑️ Suppression du salon…",
          ephemeral: true,
        });
        try {
          await channel.delete(`Force-close delete par ${interaction.user.tag} (${interaction.user.id})`);
        } catch {
          // si delete échoue (permissions), on n'explose pas
        }
        return;
      }

      return interaction.reply({ content: "ℹ️ Ce ticket est déjà fermé.", ephemeral: true });
    }

    // On répond tôt (important si on delete le salon ensuite)
    await interaction.reply({
      content: shouldDelete ? "✅ Ticket fermé. 🗑️ Suppression du salon…" : "✅ Ticket fermé (force-close).",
      ephemeral: true,
    });

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

    // ✅ Suppression du salon si demandé
    if (shouldDelete) {
      // Sécurité légère : on évite de delete un truc bizarre (threads/forums/etc.)
      // (Si tu veux aussi supporter threads, dis-moi et je te fais la variante.)
      if (channel.type !== ChannelType.GuildText) return;

      try {
        await channel.delete(`Force-close delete par ${interaction.user.tag} (${interaction.user.id})`);
      } catch {}
    }
  },
};