// src/utils/ticketViews.js
// Helpers pour embeds + components du module Tickets.

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");

function safeColor(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < 0 || n > 0xffffff) return null;
  return n;
}

function buildPanelEmbed(panel) {
  const e = new EmbedBuilder()
    .setTitle(panel.title || "Tickets")
    .setDescription(panel.description || "")
    .setTimestamp(new Date());

  const c = safeColor(panel.color);
  if (c !== null) e.setColor(c);
  if (panel.logo_url) e.setThumbnail(panel.logo_url);
  if (panel.banner_url) e.setImage(panel.banner_url);
  return e;
}

function buildPanelComponents({ panel, types }) {
  const style = (panel.style || "menu").toLowerCase();

  if (style === "boutons" || style === "buttons") {
    const buttons = [];
    for (const t of types.slice(0, 10)) {
      const label = (t.emoji ? `${t.emoji} ` : "") + (t.label || t.id);
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`ticketopen:${panel.id}:${t.id}`)
          .setLabel(label.slice(0, 80))
          .setStyle(ButtonStyle.Primary)
      );
    }
    // Discord : 5 par row
    const rows = [];
    for (let i = 0; i < buttons.length; i += 5) {
      rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
    }
    return rows;
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`ticketpanel:${panel.id}`)
    .setPlaceholder("Choisis un type de ticket...")
    .addOptions(
      types.slice(0, 25).map((t) => ({
        label: (t.label || t.id).slice(0, 100),
        value: t.id,
        emoji: t.emoji || undefined,
        description: `Ouvrir : ${t.id}`.slice(0, 100),
      }))
    );

  return [new ActionRowBuilder().addComponents(menu)];
}

function toUnixSeconds(d) {
  try {
    const dt = d instanceof Date ? d : new Date(d);
    const ms = dt.getTime();
    if (!Number.isFinite(ms)) return null;
    return Math.floor(ms / 1000);
  } catch {
    return null;
  }
}

function statusMeta(status) {
  const st = String(status || "open").toLowerCase();
  if (st === "closed") return { label: "Fermé", emoji: "🔒", color: 0xf39c12 };
  if (st === "deleted") return { label: "Supprimé", emoji: "🗑️", color: 0xe74c3c };
  return { label: "Ouvert", emoji: "🟢", color: 0x2ecc71 };
}

function buildTicketControlEmbed({ ticket, type, panel, channel }) {
  const meta = statusMeta(ticket.status);

  const typeName = `${type?.emoji ? `${type.emoji} ` : ""}${type?.label || type?.id || ticket.type_id}`;
  const fullName = `${String(ticket.prenom || "").trim()} ${String(ticket.nom || "").trim()}`.trim();

  const openedTs = toUnixSeconds(ticket.opened_at || new Date());

  const e = new EmbedBuilder()
    .setTitle(`🎫 Ticket #${ticket.ticket_id} — ${typeName}`.slice(0, 256))
    .setColor(meta.color);

  e.addFields(
    { name: "👤 Créateur", value: `<@${ticket.author_user_id}>`, inline: true },
    { name: "📌 Statut", value: `${meta.emoji} **${meta.label}**`, inline: true },
    { name: "🗂️ Panel", value: `\`${panel?.id || ticket.panel_id}\``, inline: true },
  );

  if (fullName) {
    e.addFields({ name: "🧾 Identité", value: `\`${fullName}\``, inline: true });
  }

  e.addFields({
    name: "🕒 Ouvert le",
    value: openedTs ? `<t:${openedTs}:F>
(<t:${openedTs}:R>)` : "—",
    inline: true,
  });

  if (channel?.id) {
    e.addFields({ name: "💬 Salon", value: `<#${channel.id}>`, inline: true });
  }

  e.setFooter({
    text: `Type: ${type?.id || ticket.type_id} • Ticket ID: ${ticket.ticket_id}`,
  });

  return e;
}

function buildTicketOpenRows(ticketId, { isClosed }) {
  if (isClosed) {
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket:reopen:${ticketId}`)
          .setLabel("🔓 Ré-ouvrir")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`ticket:delete:${ticketId}`)
          .setLabel("🗑️ Supprimer")
          .setStyle(ButtonStyle.Danger)
      ),
    ];
  }

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket:close:${ticketId}`)
        .setLabel("🔒 Fermer")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`ticket:rename:${ticketId}`)
        .setLabel("✏️ Renommer")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`ticket:members:${ticketId}`)
        .setLabel("👥 Membres")
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

module.exports = {
  buildPanelEmbed,
  buildPanelComponents,
  buildTicketControlEmbed,
  buildTicketOpenRows,
};
