// src/utils/rapportJugementFormat.js

/**
 * Convertit une date saisie dans le modal en timestamp UNIX (secondes).
 * Accepte :
 * - vide -> maintenant
 * - "1735689600" (timestamp)
 * - "<t:1735689600>" ou "<t:1735689600:F>"
 * - "2025-12-31 18:00"
 * - "2025-12-31"
 */
function parseJudgementDate(raw) {
  const now = Math.floor(Date.now() / 1000);
  if (!raw) return now;

  const s = String(raw).trim();
  if (!s) return now;

  // <t:1234567890> ou <t:1234567890:F>
  const m = s.match(/<t:(\d{9,12})(?::[a-zA-Z])?>/);
  if (m) return Number(m[1]);

  // timestamp brut
  if (/^\d{9,12}$/.test(s)) return Number(s);

  // date texte
  // accepte "YYYY-MM-DD" ou "YYYY-MM-DD HH:mm"
  const normalized = s.replace("T", " ").trim();
  const d = new Date(normalized);

  if (!Number.isNaN(d.getTime())) {
    return Math.floor(d.getTime() / 1000);
  }

  // fallback -> maintenant
  return now;
}

function yn(v) {
  return v ? "Oui" : "Non";
}

function safeText(v, fallback = "/") {
  const t = (v ?? "").toString().trim();
  return t.length ? t : fallback;
}

/**
 * Génère ton pattern texte final.
 */
function formatRapportJugement(payload) {
  const ts = payload.dateJugement || Math.floor(Date.now() / 1000);

  return [
    "-----",
    "-----",
    "-----",
    "",
    `Nom: ${safeText(payload.nom, "à Remplir")}`,
    `Prénom: ${safeText(payload.prenom, "à Remplir")}`,
    "",
    `Date de jugement : <t:${ts}:F>`,
    "",
    `Juge : ${safeText(payload.juge, "à Remplir")}`,
    `Procureur : ${safeText(payload.procureur, "à Remplir")}`,
    `Avocat : ${safeText(payload.avocat, "à Remplir")}`,
    "",
    `Peine : ${safeText(payload.peine, "à Remplir")}`,
    `Amande : ${safeText(payload.amende, "à Remplir")}`,
    `T.I.G. : ${yn(!!payload.tig)}`,
    `Entreprise T.I.G. : ${safeText(payload.tigEntreprise, "/")}`,
    "",
    `Observation : ${safeText(payload.observation, "à Remplir")}`,
    "-----",
    "-----",
    "-----",
  ].join("\n");
}

module.exports = {
  parseJudgementDate,
  formatRapportJugement,
};