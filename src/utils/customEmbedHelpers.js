// src/utils/customEmbedHelpers.js
const { EmbedBuilder } = require('discord.js');

/**
 * Parse une couleur hex (#RRGGBB ou RRGGBB) ou un nom basique vers un entier.
 * Retourne null si invalide.
 */
function parseColor(input) {
  if (input == null) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  // Couleurs nommées simples
  const named = {
    red: 0xed4245,
    green: 0x57f287,
    blue: 0x5865f2,
    yellow: 0xfee75c,
    purple: 0xeb459e,
    orange: 0xf57f1f,
    black: 0x000000,
    white: 0xffffff,
    blurple: 0x5865f2,
  };
  if (named[raw.toLowerCase()] != null) return named[raw.toLowerCase()];

  const hex = raw.startsWith('#') ? raw.slice(1) : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return parseInt(hex, 16);
}

function colorToHex(color) {
  if (color == null) return '';
  const n = Number(color);
  if (!Number.isFinite(n)) return '';
  return '#' + n.toString(16).padStart(6, '0').toUpperCase();
}

/**
 * Vérifie qu'une URL est une URL http(s) raisonnable.
 * Discord refusera silencieusement (ou via API error) une URL invalide,
 * donc on la nettoie ici.
 */
function isValidImageUrl(url) {
  if (!url) return false;
  const s = String(url).trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Remplace les variables et convertit les \n littéraux en vrais retours ligne.
 *   {user}        → mention de l'auteur de la commande
 *   {username}    → nom d'utilisateur
 *   {server}      → nom du serveur
 *   {membercount} → nombre de membres
 *   \n            → retour à la ligne
 */
function applyVariables(template, { user = null, guild = null } = {}) {
  if (!template) return '';
  const username = user?.username || user?.tag || 'utilisateur';
  const mention = user?.id ? `<@${user.id}>` : username;
  return String(template)
    .replace(/\\n/g, '\n')
    .replace(/\{user\}/gi, mention)
    .replace(/\{username\}/gi, username)
    .replace(/\{server\}/gi, guild?.name || 'le serveur')
    .replace(/\{membercount\}/gi, String(guild?.memberCount ?? '?'));
}

/**
 * Construit un EmbedBuilder à partir des données stockées en DB
 * (ou des données saisies dans le modal).
 */
function buildEmbed(data, { user = null, guild = null } = {}) {
  const embed = new EmbedBuilder();

  const title = data.title ? applyVariables(data.title, { user, guild }) : '';
  const description = data.description
    ? applyVariables(data.description, { user, guild })
    : '';
  const footer = data.footer ? applyVariables(data.footer, { user, guild }) : '';

  if (title) embed.setTitle(title.slice(0, 256));
  if (description) embed.setDescription(description.slice(0, 4096));
  if (footer) embed.setFooter({ text: footer.slice(0, 2048) });

  if (data.color != null) {
    embed.setColor(Number(data.color));
  } else {
    embed.setColor(0x5865f2);
  }

  if (isValidImageUrl(data.thumbnail)) {
    embed.setThumbnail(String(data.thumbnail).trim());
  }
  if (isValidImageUrl(data.image)) {
    embed.setImage(String(data.image).trim());
  }

  return embed;
}

module.exports = {
  parseColor,
  colorToHex,
  isValidImageUrl,
  applyVariables,
  buildEmbed,
};
