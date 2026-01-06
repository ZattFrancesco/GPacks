// src/utils/visaFormat.js

const { EmbedBuilder } = require("discord.js");

function safe(v, fallback = "/") {
  const t = (v ?? "").toString().trim();
  return t.length ? t : fallback;
}

function statutLabel(s) {
  const v = String(s || "").toLowerCase();
  if (v === "temporaire" || v === "temporary") return "Temporaire";
  if (v === "permanent") return "Permanent";
  if (v === "suspendu" || v === "suspended") return "Suspendu";
  if (v === "refuse" || v === "refusé" || v === "refused") return "Refusé";
  return safe(s, "Temporaire");
}

function factureLabel(s) {
  const v = String(s || "").toLowerCase();
  if (v === "payee" || v === "payée" || v === "paye" || v === "payé") return "Payée";
  if (v === "impayee" || v === "impayée" || v === "impaye" || v === "impayé") return "Impayée";
  return safe(s, "Impayée");
}

function buildVisaEmbed(visaRowOrPayload) {
  const v = visaRowOrPayload || {};

  const nom = safe(v.nom);
  const prenom = safe(v.prenom);
  const ident = safe(v.identity_id ?? v.identityId, "?");

  const statut = statutLabel(v.statut_visa ?? v.statutVisa);
  const facture = factureLabel(v.facture_statut ?? v.factureStatut);

  const createdTs = v.created_at
    ? Math.floor(new Date(v.created_at).getTime() / 1000)
    : (Number(v.createdAtUnix) || Math.floor(Date.now() / 1000));

  const expirationUnix = v.expiration_unix ?? v.expirationUnix;
  const expirationLine = expirationUnix
    ? `<t:${Number(expirationUnix)}:D>`
    : "/";

  const permis = safe(v.permis_validite ?? v.permisValidite);
  const entreprise = safe(v.entreprise);
  const poste = safe(v.poste);

  const raison = safe(v.raison, "/");

  const by = v.reporter_user_id ? `<@${v.reporter_user_id}>` : safe(v.reporterUserId ? `<@${v.reporterUserId}>` : "/");

  const lines = [];
  lines.push(`**Statut** : ${statut}`);
  lines.push(`**Facture** : ${facture}`);
  lines.push(`**Validé le** : <t:${createdTs}:F>`);
  if (statut === "Temporaire") lines.push(`**Expiration** : ${expirationLine}`);
  lines.push(`**Permis** : ${permis}`);
  lines.push(`**Entreprise** : ${entreprise}`);
  lines.push(`**Poste** : ${poste}`);
  if (statut === "Suspendu" || statut === "Refusé") lines.push(`**Raison** : ${raison}`);
  lines.push(`**Créé par** : ${by}`);

  return new EmbedBuilder()
    .setTitle(`🛂 Visa — ${nom} ${prenom} (ID: ${ident})`)
    .setDescription(lines.join("\n"))
    .setColor(0x2b2d31);
}

module.exports = {
  safe,
  statutLabel,
  factureLabel,
  buildVisaEmbed,
};
