// src/utils/jugementEmbed.js
const { EmbedBuilder } = require("discord.js");

/**
 * Retourne { dateStr: "dd/mm/yyyy", timeStr: "HH:MM" } pour Europe/Brussels.
 */
function formatBrussels(date) {
  const d = new Date(date);

  const parts = new Intl.DateTimeFormat("fr-BE", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (type) => parts.find((p) => p.type === type)?.value;
  const day = get("day");
  const month = get("month");
  const year = get("year");
  const hour = get("hour");
  const minute = get("minute");

  return {
    dateStr: `${day}/${month}/${year}`,
    timeStr: `${hour}:${minute}`,
  };
}

function truncate(str, max) {
  const s = String(str ?? "").trim();
  if (!s) return "—";
  if (s.length <= max) return s;
  // 3 chars pour "..."
  return `${s.slice(0, Math.max(0, max - 3))}...`;
}

/**
 * Construit l'embed "demande jugement" (sans codeblock) :
 * - Les infos sont en fields (plus clean)
 * - Les liens images doivent être envoyés en TEXTE PUR (content) pour afficher les previews.
 */
function buildJugementEmbed(payload) {
  const openedAt = payload?.openedAt ? new Date(payload.openedAt) : new Date();
  const { dateStr, timeStr } = formatBrussels(openedAt);

  const agentCharge = payload?.agentCharge;
  const suspect = payload?.suspect;
  const ppa = payload?.ppa;
  const faits = payload?.faits;
  const agentsPresents = payload?.agentsPresents;
  const rapport = payload?.rapport;
  const nbCasiers = payload?.nbCasiers;

  const embed = new EmbedBuilder()
    .setTitle("Demande de jugement")
    .setDescription(`**-- DOSSIER --**\nOuvert le **${dateStr}** à **${timeStr}**`)
    .addFields(
      { name: "Agent(s) en charge", value: truncate(agentCharge, 1024), inline: false },
      { name: "Nom / prénom du suspect", value: truncate(suspect, 1024), inline: true },
      { name: "PPA", value: truncate(ppa, 1024), inline: true },
      { name: "Faits reprochés", value: truncate(faits, 1024), inline: false },
      { name: "Agent(s) présent(s)", value: truncate(agentsPresents, 1024), inline: false },
      { name: "Rapport d’arrestation", value: truncate(rapport, 1024), inline: false },
      { name: "Nombre de casier judiciaire", value: truncate(nbCasiers, 1024), inline: true }
    )
    .setTimestamp(openedAt);

  return embed;
}

module.exports = {
  formatBrussels,
  buildJugementEmbed,
};