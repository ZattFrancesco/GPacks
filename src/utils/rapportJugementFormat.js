// src/utils/rapportJugementFormat.js

function parseUnixTimestamp(input) {
  const raw = (input ?? "").trim();
  if (!raw) return Math.floor(Date.now() / 1000);

  // Si l'utilisateur colle un timestamp Discord <t:1234567890:...>
  const m = raw.match(/<t:(\d{6,16})(?::[a-zA-Z])?>/);
  if (m) return Number(m[1]);

  // Numérique (secondes ou millisecondes)
  if (/^\d{6,16}$/.test(raw)) {
    const n = Number(raw);
    if (raw.length >= 13) return Math.floor(n / 1000); // ms -> s
    return n;
  }

  // Essai de parsing Date
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return Math.floor(d.getTime() / 1000);

  // Fallback: maintenant
  return Math.floor(Date.now() / 1000);
}

function parseOuiNon(input) {
  const v = (input ?? "").trim().toLowerCase();
  if (["oui", "o", "yes", "y", "1", "true"].includes(v)) return true;
  if (["non", "n", "no", "0", "false"].includes(v)) return false;
  return false;
}

function extractMentionUserId(text) {
  const t = (text ?? "").trim();
  const m = t.match(/<@!?(\d{15,25})>/);
  return m ? m[1] : null;
}

function normalizeJudgeKey(judgeUserId, judgeName) {
  if (judgeUserId) return `U:${judgeUserId}`;
  const t = (judgeName ?? "").trim().toLowerCase();
  return `T:${t || "inconnu"}`;
}

function buildRapportText(data) {
  const ts = data.date_jugement_unix ? Number(data.date_jugement_unix) : Math.floor(Date.now() / 1000);
  const tigTxt = data.tig ? "Oui" : "Non";
  const ent = data.tig ? (data.tig_entreprise?.trim() ? data.tig_entreprise.trim() : "/") : "/";

  return (
    "-----\n-----\n-----\n\n" +
    `Nom: ${data.nom || "à Remplir"}\n` +
    `Prénom: ${data.prenom || "à Remplir"}\n\n` +
    `Date de jugement : <t:${ts}:F>\n\n` +
    `Juge : ${data.judge_name || "à Remplir"}\n` +
    `Procureur : ${data.procureur || "à Remplir"}\n` +
    `Avocat : ${data.avocat || "à Remplir"}\n\n` +
    `Peine : ${data.peine || "à Remplir"}\n` +
    `Amende : ${data.amende || "à Remplir"}\n` +
    `T.I.G. : ${tigTxt}\n` +
    `Entreprise T.I.G. : ${ent}\n\n` +
    `Observation : ${data.observation || "à Remplir"}\n` +
    "\n-----\n-----\n-----"
  );
}

module.exports = {
  parseUnixTimestamp,
  parseOuiNon,
  extractMentionUserId,
  normalizeJudgeKey,
  buildRapportText,
};
