// src/utils/ticketOpen.js
// Logique d'ouverture d'un ticket depuis un panel.

const {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const { getPanel, getType, createTicket, setTicketControlMessageId } = require("../../services/tickets.db");
const { buildTicketControlEmbed, buildTicketOpenRows } = require("./ticketViews");
const { setOpenDraft } = require("./ticketDrafts");
const { isBlacklisted } = require("../../services/blacklist.db");
const { auditLog } = require("./auditLog");

function sanitizeChannelPart(s) {
  return String(s || "")
    .trim()
    // Discord n'autorise pas les accents dans les noms de salon.
    // On "désaccentue" d'abord (é -> e, è -> e, à -> a, ...)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

async function ensureNick(guild, member, prenom, nom) {
  const nick = `${String(prenom || "").trim()} ${String(nom || "").trim()}`.trim();
  if (!nick) return;
  try {
    await member.setNickname(nick.slice(0, 32));
  } catch {}
}

async function openTicketFromPanel(interaction, { panelId, typeId }) {
  const guild = interaction.guild;
  const guildId = interaction.guildId;
  const member = interaction.member;

  const panel = await getPanel(guildId, panelId);
  if (!panel) throw new Error("Panel introuvable");

  // Role requis
  if (panel.required_role_id && !member.roles?.cache?.has(panel.required_role_id)) {
    return interaction.reply({ content: "❌ Tu n'as pas le rôle requis pour ouvrir un ticket.", ephemeral: true });
  }

    // Blacklist
  const bl = await isBlacklisted(interaction.user.id);
  if (bl?.blacklisted) {
    const reason = bl.reason ? `\nRaison: **${bl.reason}**` : "";
    return interaction.reply({ content: `❌ Tu es blacklisté, tu ne peux pas ouvrir de ticket.${reason}`, ephemeral: true });
  }

// Type autorisé
  const typeIds = panel.type_ids || JSON.parse(panel.type_ids_json || "[]");
  if (!typeIds.includes(typeId)) {
    return interaction.reply({ content: "❌ Ce type n'est pas autorisé sur ce panel.", ephemeral: true });
  }

  const type = await getType(guildId, typeId);
  if (!type) return interaction.reply({ content: "❌ Type introuvable.", ephemeral: true });

  // Si namemodalrename : modal avant
  if (type.namemodalrename) {
    setOpenDraft(guildId, interaction.user.id, { panelId, typeId });
    const modal = require("../../modals/ticketOpenName.modal");
    return interaction.showModal(modal.build());
  }

  // Sinon : créer direct (nom/prénom = pseudo)
  const usernamePart = sanitizeChannelPart(interaction.user.username);
  return createTicketChannelAndMessages(interaction, { panel, type, nom: null, prenom: null, suffix: usernamePart });
}

async function createTicketChannelAndMessages(interaction, { panel, type, nom, prenom, suffix }) {
  const guild = interaction.guild;
  const guildId = interaction.guildId;
  const author = interaction.user;

  const labelPart = sanitizeChannelPart(type.label || type.id);
  const namePart = sanitizeChannelPart(suffix || `${prenom || ""}-${nom || ""}`);
  let channelName = `${labelPart}-${namePart}`.replace(/-+/g, "-").slice(0, 90);
  if (!channelName) channelName = `ticket-${author.id}`;

  const staffRoleIds = type.staff_role_ids || JSON.parse(type.staff_role_ids_json || "[]");

  const overwrites = [
    {
      id: guild.roles.everyone,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: author.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
    {
      id: interaction.client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
      ],
    },
  ];

  // Staff : accès au ticket, mais pas de ManageChannels (tout passe via les boutons)
  for (const rid of staffRoleIds) {
    overwrites.push({
      id: rid,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });
  }

const categoryId = type.category_opened_id || null;

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: categoryId || undefined,
    permissionOverwrites: overwrites,
    reason: `Ticket ${type.id} par ${author.tag}`,
  });

  // DB ticket
  const ticketId = await createTicket(guildId, {
    channelId: channel.id,
    panelId: panel.id,
    typeId: type.id,
    authorUserId: author.id,
    nom,
    prenom,
  });

  await auditLog(interaction.client, guildId, {
    module: "TICKETS",
    action: "OPEN",
    level: "INFO",
    userId: author.id,
    sourceChannelId: interaction.channelId,
    message: `Ticket ouvert (#${ticketId}) • type ${type.id}.`,
    meta: { ticketId, typeId: type.id, panelId: panel.id, ticketChannelId: channel.id },
  });


  // Embed de contrôle + boutons (envoyé en premier)
  const contentParts = [`<@${author.id}>`];
  if (type?.open_ping_role_id) contentParts.push(`<@&${type.open_ping_role_id}>`);

  const controlMsg = await channel.send({
    content: contentParts.join(" "),
    embeds: [
      buildTicketControlEmbed({
        ticket: {
          ticket_id: ticketId,
          author_user_id: author.id,
          type_id: type.id,
          panel_id: panel.id,
          status: "open",
          opened_at: new Date(),
          nom,
          prenom,
        },
        type,
        panel,
        channel,
      }),
    ],
    components: buildTicketOpenRows(ticketId, { isClosed: false }),
  });
  try {
    await setTicketControlMessageId(guildId, ticketId, controlMsg.id);
  } catch {}

  // Custom embed (informatif) — envoyé après l'embed de contrôle
  if (type.custom_embed_enabled && (type.custom_embed_title || type.custom_embed_description)) {
    await channel.send({
      embeds: [
        {
          title: type.custom_embed_title || undefined,
          description: type.custom_embed_description || undefined,
        },
      ],
    });
  }


  // Réponse propre au user (robuste contre les délais / modals)
  try {
    if (interaction.deferred && !interaction.replied) {
      // Cas typique: ModalSubmitInteraction.deferReply(...) puis traitement long
      await interaction.editReply({ content: `✅ Ticket créé : <#${channel.id}>` });
    } else if (interaction.replied) {
      await interaction.followUp({ content: `✅ Ticket créé : <#${channel.id}>`, ephemeral: true });
    } else {
      await interaction.reply({ content: `✅ Ticket créé : <#${channel.id}>`, ephemeral: true });
    }
  } catch {
    // best effort (évite crash si token expiré)
  }

  return { channel, ticketId };
}

module.exports = {
  openTicketFromPanel,
  createTicketChannelAndMessages,
  ensureNick,
};
