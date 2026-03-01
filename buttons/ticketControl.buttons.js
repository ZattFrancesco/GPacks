const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");

const {
  getTicketById,
  setTicketStatus,
  setPendingCloseMessage,
  clearPendingCloseMessage,
  getType,
  getPanel,
} = require("../services/tickets.db");

const { buildTicketControlEmbed, buildTicketOpenRows } = require("../src/utils/ticketViews");
const { auditLog } = require("../src/utils/auditLog");
const logsDb = require("../services/logs.db");
const { buildTranscriptAttachment } = require("../src/utils/ticketTranscript");
const { isOwner } = require("../src/utils/permissions");

function isStaff(member, staffRoleIds, userId) {
  // ✅ Owner bypass : le propriétaire du bot passe partout sur les actions tickets
  if (isOwner(userId)) return true;

  if (!member) return false;
  if (member.permissions?.has?.(PermissionFlagsBits.ManageChannels)) return true;
  const set = new Set(staffRoleIds || []);
  return member.roles?.cache?.some((r) => set.has(r.id)) || false;
}

function buildStaffRoleMentions(staffRoleIds) {
  const ids = (staffRoleIds || []).filter(Boolean);
  if (!ids.length) return "";
  // Mentions Discord: <@&roleId>
  return ids.map((id) => `<@&${id}>`).join(" ");
}

function buildClosedActionsRow(ticketId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket:reopen:${ticketId}`)
      .setLabel("🔓 Ré-ouvrir")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`ticket:delete:${ticketId}`)
      .setLabel("🗑️ Supprimer")
      .setStyle(ButtonStyle.Danger)
  );
}

async function refreshControlMessage(channel, client, ticket, type, panel) {
  try {
    let botMsg = null;

    // ✅ On privilégie l'ID stocké en DB (fiable)
    if (ticket.control_message_id) {
      try {
        botMsg = await channel.messages.fetch(String(ticket.control_message_id));
      } catch {
        botMsg = null;
      }
    }

    // Fallback : cherche dans les derniers messages
    if (!botMsg) {
      const msgs = await channel.messages.fetch({ limit: 25 });
      botMsg = [...msgs.values()].find((m) => m.author?.id === client.user.id && m.embeds?.length);
    }

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

    // ---------------------------------------------------------------------
    // Cas spécial: gestion membres -> ticket:member:add:<ticketId>:<userId>
    // Ici, parts[2] = subAction, parts[3] = ticketId.
    // ---------------------------------------------------------------------
    if (action === "member") {
      const subAction = parts[2];
      const realTicketId = parts[3];
      const targetUserId = parts[4];

      if (!subAction || !realTicketId || !targetUserId) {
        return interaction.reply({ content: "❌ Action membre invalide.", flags: 64 });
      }

      const ticket = await getTicketById(guildId, realTicketId);
      if (!ticket) {
        return interaction.reply({ content: "❌ Ticket introuvable (DB).", flags: 64 });
      }

      const type = await getType(guildId, ticket.type_id);
      const panel = await getPanel(guildId, ticket.panel_id);
      const staffRoleIds = type?.staff_role_ids || JSON.parse(type?.staff_role_ids_json || "[]");

      if (!isStaff(interaction.member, staffRoleIds, interaction.user.id)) {
        return interaction.reply({ content: "❌ Réservé au staff.", flags: 64 });
      }

      try {
        if (subAction === "add") {
          await channel.permissionOverwrites.edit(targetUserId, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
          });
          return interaction.reply({ content: `✅ <@${targetUserId}> ajouté au ticket.`, flags: 64 });
        }

        if (subAction === "remove") {
          // On retire la visibilité : le user ne voit plus le salon
          await channel.permissionOverwrites.edit(targetUserId, {
            ViewChannel: false,
          });
          return interaction.reply({ content: `✅ <@${targetUserId}> retiré du ticket.`, flags: 64 });
        }

        return interaction.reply({ content: "❌ Sous-action inconnue.", flags: 64 });
      } catch {
        return interaction.reply({ content: "❌ Impossible de modifier les permissions (vérifie les perms du bot).", flags: 64 });
      }
    }

    // --- Helper charge ticket (cas standard: ticket:<action>:<ticketId>) ---
    const ticket = ticketId ? await getTicketById(guildId, ticketId) : null;
    if (ticketId && !ticket) {
      return interaction.reply({ content: "❌ Ticket introuvable (DB).", flags: 64 });
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
          ].includes(action);

    if (needStaff && !isStaff(interaction.member, staffRoleIds, interaction.user.id)) {
      return interaction.reply({ content: "❌ Réservé au staff.", flags: 64 });
    }

    // ---------------- CLOSE (demande confirmation au créateur) ----------------
    if (action === "close") {
      if (ticket.status === "closed") {
        return interaction.reply({ content: "ℹ️ Déjà fermé.", flags: 64 });
      }

      // Anti-spam : si une confirmation est déjà en attente, on évite d'en envoyer une nouvelle.
      if (ticket.pending_close_message_id) {
        try {
          await channel.messages.fetch(String(ticket.pending_close_message_id));
          return interaction.reply({
            content: "ℹ️ Une demande de confirmation est déjà en attente dans ce ticket.",
            flags: 64,
          });
        } catch {
          // Le message n'existe plus -> on nettoie et on continue.
          try {
            await clearPendingCloseMessage(guildId, ticket.ticket_id);
          } catch {}
        }
      }

      const staffMentions = buildStaffRoleMentions(staffRoleIds);

      const embed = {
        title: "🔒 Confirmation de fermeture",
        description: `<@${ticket.author_user_id}>, <@${interaction.user.id}> souhaiterait clôturer ce ticket.\nMerci de confirmer la fermeture ci-dessous.`,
      };

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket:closeconfirm:${ticket.ticket_id}`)
          .setLabel("Cloturer le ticket")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`ticket:closecancel:${ticket.ticket_id}`)
          .setLabel("Garder le ticket ouvert")
          .setStyle(ButtonStyle.Secondary)
      );

      const msg = await channel.send({
        // ✅ On ping le créateur + les rôles staff (notification), mais le texte ne ping que créateur + staff qui ferme.
        content: `<@${ticket.author_user_id}>`,
        embeds: [embed],
        components: [row],
      });

      // Stocke l'ID du message de confirmation (anti-spam)
      try {
        await setPendingCloseMessage(guildId, ticket.ticket_id, msg.id);
      } catch {}

      await auditLog(client, guildId, {
        module: "TICKETS",
        action: "CLOSE_REQUEST",
        level: "INFO",
        userId: interaction.user.id,
        sourceChannelId: channel.id,
        message: `Demande de fermeture ticket #${ticket.ticket_id}.`,
        meta: { ticketId: ticket.ticket_id, ticketChannelId: channel.id, authorUserId: ticket.author_user_id, requestedBy: interaction.user.id },
      });

      return interaction.reply({ content: "✅ Demande de confirmation envoyée au créateur.", flags: 64 });
    }

    if (action === "closeconfirm") {
      if (interaction.user.id !== ticket.author_user_id) {
        return interaction.reply({ content: "❌ Seul le créateur peut confirmer.", flags: 64 });
      }

      try {
        await channel.permissionOverwrites.edit(ticket.author_user_id, { ViewChannel: false });
      } catch {}

      await setTicketStatus(guildId, ticket.ticket_id, "closed");

      await auditLog(client, guildId, {
        module: "TICKETS",
        action: "CLOSE_CONFIRM",
        level: "INFO",
        userId: interaction.user.id,
        sourceChannelId: channel.id,
        message: `Ticket fermé (#${ticket.ticket_id}).`,
        meta: { ticketId: ticket.ticket_id, ticketChannelId: channel.id, authorUserId: ticket.author_user_id },
      });
      try { await clearPendingCloseMessage(guildId, ticket.ticket_id); } catch {}
      const updated = { ...ticket, status: "closed" };
      await refreshControlMessage(channel, client, updated, type, panel);

      // ✅ Le message de confirmation devient le "panneau" des actions de ticket fermé.
      // On retire les boutons Confirmer/Annuler, et on place Ré-ouvrir/Supprimer ici.
      try {
        await interaction.message.edit({
          embeds: [
            {
              title: "✅ Ticket fermé",
              description:
                `Ce ticket est maintenant fermé.\n\n` +
                `🔧 **Actions staff :** utilise les boutons ci-dessous.`,
            },
          ],
          components: [buildClosedActionsRow(ticket.ticket_id)],
        });
      } catch {}

      return interaction.reply({ content: "✅ Ticket fermé.", flags: 64 });
    }

    if (action === "closecancel") {
      if (interaction.user.id !== ticket.author_user_id) {
        return interaction.reply({ content: "❌ Seul le créateur peut annuler.", flags: 64 });
      }

      // On supprime le message de confirmation si on garde le ticket ouvert
      try {
        await interaction.message.delete();
      } catch {
        try {
          await interaction.message.edit({ components: [] });
        } catch {}
      }
      try { await clearPendingCloseMessage(guildId, ticket.ticket_id); } catch {}
      return interaction.reply({ content: "✅ Ticket gardé ouvert.", flags: 64 });
    }

    // ---------------- REOPEN ----------------
    if (action === "reopen") {
      if (ticket.status !== "closed") {
        return interaction.reply({ content: "❌ Ce ticket n'est pas fermé.", flags: 64 });
      }

      try {
        await channel.permissionOverwrites.edit(ticket.author_user_id, { ViewChannel: true });
      } catch {}

      await setTicketStatus(guildId, ticket.ticket_id, "open");

      await auditLog(client, guildId, {
        module: "TICKETS",
        action: "REOPEN",
        level: "INFO",
        userId: interaction.user.id,
        sourceChannelId: channel.id,
        message: `Ticket ré-ouvert (#${ticket.ticket_id}).`,
        meta: { ticketId: ticket.ticket_id, ticketChannelId: channel.id },
      });
      const updated = { ...ticket, status: "open" };
      await refreshControlMessage(channel, client, updated, type, panel);

      // ✅ Si le bouton vient du message de confirmation, on supprime ce message.
      // (Le message principal de contrôle est celui stocké en DB: control_message_id)
      try {
        if (interaction.message?.id && String(interaction.message.id) !== String(ticket.control_message_id || "")) {
          await interaction.message.delete();
        }
      } catch {}

      return interaction.reply({ content: "✅ Ticket ré-ouvert.", flags: 64 });
    }

    // ---------------- RENAME ----------------
    if (action === "rename") {
      const modal = new ModalBuilder()
        .setCustomId(`ticket:renameModal:${ticket.ticket_id}`)
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
        flags: 64,
      });
    }

    // ---------------- DELETE (suppression directe) ----------------
    if (action === "delete") {
      await interaction.reply({ content: "✅ Suppression en cours...", flags: 64 });
      return deleteTicketNow({ interaction, client, ticket });
    }


    // Les actions "member" / modals / selects sont gérées ailleurs
    return;
  },
};

async function deleteTicketNow({ interaction, client, ticket }) {
  const guildId = interaction.guildId;
  const channel = interaction.channel;

  // ------------------------------------------------------------------
  // 1) Transcript (TXT) -> envoyé dans les logs + lien bouton en MP
  // ------------------------------------------------------------------
  let transcriptUrl = null;
  let transcriptName = null;

  try {
    const safeGuildName = (interaction.guild?.name || "server").replace(/[^a-z0-9_-]+/gi, "-");
    const base = `ticket-${ticket.ticket_id}-${safeGuildName}`.slice(0, 80);
    const att = await buildTranscriptAttachment(channel, `${base}-transcript`);
    transcriptName = att?.name || null;

    // 1.a) Try send to configured logs channel
    const cfg = await logsDb.getConfig(guildId).catch(() => null);
    const logChannelId = cfg?.channelId || null;
    if (logChannelId && client) {
      const logCh = await client.channels.fetch(logChannelId).catch(() => null);
      if (logCh && logCh.isTextBased?.()) {
        const embed = new EmbedBuilder()
          .setTitle("🎫 Transcript de ticket")
          .setDescription(
            `Ticket **#${ticket.ticket_id}** supprimé après fermeture.\n` +
              `Créateur : <@${ticket.author_user_id}>\n` +
              `Salon : **${channel?.name || channel?.id || "—"}**`
          )
          .setFooter({ text: "Service Public" })
          .setTimestamp(new Date());

        const msg = await logCh.send({ embeds: [embed], files: [att] }).catch(() => null);
        const file = msg?.attachments?.first?.();
        transcriptUrl = file?.url || null;
      }
    }

    // 1.b) If no log channel URL, upload to a DM message to get a URL anyway
    if (!transcriptUrl) {
      const authorUser = await client.users.fetch(ticket.author_user_id).catch(() => null);
      if (authorUser) {
        const dmMsg = await authorUser.send({ files: [att] }).catch(() => null);
        const file = dmMsg?.attachments?.first?.();
        transcriptUrl = file?.url || null;
      }
    }
  } catch {
    // transcript is best-effort
  }

  // ------------------------------------------------------------------
  // 2) MP au créateur (embed + bouton transcript)
  // ------------------------------------------------------------------
  try {
    const authorUser = await client.users.fetch(ticket.author_user_id).catch(() => null);
    if (authorUser) {
      const closedBy = interaction.member?.displayName || interaction.user?.username || interaction.user?.tag || "—";
      const serverName = interaction.guild?.name || "ce serveur";

      const dmEmbed = new EmbedBuilder()
        .setTitle("🎫 Ticket Fermé")
        .setDescription(
          `Bonjour <@${ticket.author_user_id}>,\n` +
            `Votre ticket a été fermé sur **${serverName}**.\n` +
            `Fermé par : **${closedBy}**\n\n` +
            `Si vous n’avez pas vu la réponse, nous vous invitons à consulter le transcript du ticket.`
        )
        .setFooter({ text: "Service Public" })
        .setTimestamp(new Date());

      const components = [];
      if (transcriptUrl) {
        components.push(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Link)
              .setLabel("📄 Transcript")
              .setURL(transcriptUrl)
          )
        );
      }

      await authorUser.send({ embeds: [dmEmbed], components }).catch(() => null);
    }
  } catch {
    // DM is best-effort
  }

  // DB
  try {
    await setTicketStatus(guildId, ticket.ticket_id, "deleted");
  } catch {}

  // Log
  try {
    await auditLog(client, guildId, {
      module: "TICKETS",
      action: "DELETE",
      level: "INFO",
      userId: interaction.user.id,
      sourceChannelId: channel.id,
      message: `Ticket supprimé (#${ticket.ticket_id}).${transcriptUrl ? " Transcript envoyé aux logs." : ""}`,
      meta: {
        ticketId: ticket.ticket_id,
        ticketChannelId: channel.id,
        authorUserId: ticket.author_user_id,
        transcriptUrl: transcriptUrl || null,
        transcriptName: transcriptName || null,
      },
    });
  } catch {}

  // Delete channel
  try {
    await channel.delete(`Ticket deleted #${ticket.ticket_id}`);
  } catch {
    try {
      await interaction.followUp({ content: "⚠️ Je n'ai pas pu supprimer le salon (permissions ?).", flags: 64 });
    } catch {}
  }
}
