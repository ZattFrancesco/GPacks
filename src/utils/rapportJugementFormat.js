// src/utils/rapportJugementFormat.js
const { EmbedBuilder } = require("discord.js");

/**
 * Convertit une date saisie en timestamp UNIX
 */
function parseJudgementDate(raw) {
  const now = Math.floor(Date.now() / 1000);
  if (!raw) return now;

  const s = String(raw).trim();
  if (!s) return now;

  const m = s.match(/<t:(\d{9,12})(?::[a-zA-Z])?>/);
  if (m) return Number(m[1]);

  if (/^\d{9,12}$/.test(s)) return Number(s);

  const d = new Date(s.replace("T", " "));
  if (!Number.isNaN(d.getTime())) {
    return Math.floor(d.getTime() / 1000);
  }

  return now;
}

function safe(v, fallback = "/") {
  const t = (v ?? "").toString().trim();
  return t.length ? t : fallback;
}

/**
 * Génère l'embed du rapport
 */
function buildRapportJugementEmbed(payload) {
  const ts = payload.dateJugement;

  return new EmbedBuilder()
    .setTitle("📄 Rapport de Jugement")
    .setColor(0x2b2d31)
    .addFields(
      {
        name: "👤 Identité",
        value:
          `**Nom :** ${safe(payload.nom)}\n` +
          `**Prénom :** ${safe(payload.prenom)}\n` +
          `**Date de jugement :** <t:${ts}:F>`,
      },
      {
        name: "⚖️ Rôles",
        value:
          `**Juge :** ${safe(payload.juge)}\n` +
          `**Procureur :** ${safe(payload.procureur)}\n` +
          `**Avocat :** ${safe(payload.avocat)}`,
      },
      {
        name: "⛓️ Sanctions",
        value:
          `**Peine :** ${safe(payload.peine)}\n` +
          `**Amende :** ${safe(payload.amende)}\n` +
          `**T.I.G. :** ${payload.tig ? "Oui" : "Non"}\n` +
          `**Entreprise T.I.G. :** ${safe(payload.tigEntreprise)}`,
      },
      {
        name: "📝 Observation",
        value: safe(payload.observation, "Aucune"),
      }
    )
    .setFooter({ text: "DOJ Helper • Rapport judiciaire" })
    .setTimestamp(ts * 1000);
}

module.exports = {
  parseJudgementDate,
  buildRapportJugementEmbed,
};