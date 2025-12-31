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

/**
 * Construit l'embed "demande jugement" dans le style demandé.
 * On met le bloc principal dans un code block pour préserver les espaces/alignements.
 */
function buildJugementEmbed(payload) {
  const openedAt = payload?.openedAt ? new Date(payload.openedAt) : new Date();
  const { dateStr, timeStr } = formatBrussels(openedAt);

  const agentCharge = payload?.agentCharge || "";
  const suspect = payload?.suspect || "";
  const ppa = payload?.ppa || "";
  const faits = payload?.faits || "";
  const agentsPresents = payload?.agentsPresents || "";
  const rapport = payload?.rapport || "";
  const photoCasier = payload?.photoCasier || "";
  const nbCasiers = payload?.nbCasiers ?? "";
  const photoIndividu = payload?.photoIndividu || "";

  const block = [
    " -- DOSSIER --",
    "",
    `Agent(s) en charge:        ${agentCharge}`,
    "",
    `Nom prénom du suspect:    ${suspect}`,
    `PPA:    ${ppa}`,
    "",
    `Faits reprochés:    ${faits}`,
    `Agent(s) présent(s):            ${agentsPresents}`,
    `Rapport d'arrestation:    ${rapport}`,
    "",
    "Photo casier judiciaire",
    `Nombre de casier judiciaire:    ${nbCasiers}`,
    `Photo individu :    ${photoIndividu}`,
  ].join("\n");

  const desc = [
    `**------ * Ouvert le    ${dateStr}    à    ${timeStr} * ------**`,
    "",
    "```",
    block,
    "```",
    photoCasier ? `**Photo casier judiciaire :** ${photoCasier}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const embed = new EmbedBuilder()
    .setTitle("Demande de jugement")
    .setDescription(desc)
    .setTimestamp(openedAt);

  return embed;
}

module.exports = {
  formatBrussels,
  buildJugementEmbed,
};
