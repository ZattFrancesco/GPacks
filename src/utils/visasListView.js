// src/utils/visasListView.js

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { factureLabel, statutLabel, safe } = require("./visaFormat");
const { countVisas, listVisas } = require("../../services/visa.db");

function messageUrl(guildId, channelId, messageId) {
  if (!guildId || !channelId || !messageId) return null;
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

function trimText(str, max = 60) {
  const s = String(str || "").trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

function buildItemLine(guildId, v) {
  const statut = statutLabel(v.statut_visa);
  const facture = factureLabel(v.facture_statut);
  const createdTs = v.created_at ? Math.floor(new Date(v.created_at).getTime() / 1000) : null;
  const expTs = v.expiration_unix ? Number(v.expiration_unix) : null;
  const ident = safe(v.identity_id, "?");

  const base = `**#${v.id} — ${safe(v.nom)} ${safe(v.prenom)} (ID: ${ident})**`;
  const meta = `Statut: **${statut}** • Facture: **${facture}**`;

  const dates = createdTs
    ? `Validé: <t:${createdTs}:d>${statut === "Temporaire" && expTs ? ` • Exp: <t:${expTs}:d>` : ""}`
    : "";

  const perm = trimText(safe(v.permis_validite, "/"), 40);
  const ent = trimText(safe(v.entreprise, "/"), 28);
  const poste = trimText(safe(v.poste, "/"), 28);
  const infos = `Permis: ${perm} • ${ent}${poste !== "/" ? ` (${poste})` : ""}`;

  const url = messageUrl(guildId, v.channel_id, v.message_id);
  const open = url ? ` • [Ouvrir](${url})` : "";

  return `${base}\n${meta}${open}\n${dates}\n${infos}`;
}

function buildComponents(stateId, page, totalPages, hasQuery) {
  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`visaslistbtn:${stateId}:prev`)
      .setLabel("⬅️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(prevDisabled),
    new ButtonBuilder()
      .setCustomId(`visaslistbtn:${stateId}:next`)
      .setLabel("➡️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(nextDisabled),
    new ButtonBuilder()
      .setCustomId(`visaslistbtn:${stateId}:search`)
      .setLabel("🔎 Rechercher")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`visaslistbtn:${stateId}:reset`)
      .setLabel("♻️ Reset")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasQuery)
  );

  return [row];
}

async function buildVisasListMessage({ stateId, guildId, query, page, pageSize }) {
  const total = await countVisas(guildId, query);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const rows = await listVisas(guildId, { search: query, page: safePage, pageSize });

  const desc = rows.length
    ? rows.map((v) => buildItemLine(guildId, v)).join("\n\n")
    : (query ? "Aucun visa trouvé pour cette recherche." : "Aucun visa enregistré.");

  const embed = new EmbedBuilder()
    .setTitle("🛂 Visas")
    .setDescription(desc)
    .setFooter({ text: `Page ${safePage}/${totalPages} • Total: ${total}${query ? ` • Filtre: ${trimText(query, 30)}` : ""}` })
    .setColor(0x2b2d31);

  const components = buildComponents(stateId, safePage, totalPages, Boolean(String(query || "").trim()));

  return { embed, components, totalPages, safePage };
}

module.exports = {
  buildVisasListMessage,
};
