// src/utils/permissions.js
function isOwner(userId) {
  return Boolean(process.env.OWNER_ID) && userId === process.env.OWNER_ID;
}

function isDev(userId) {
  // dev = owner par défaut. (Tu peux étendre plus tard)
  if (isOwner(userId)) return true;

  // optionnel: liste d'IDs dans .env -> DEV_IDS=1,2,3
  const list = (process.env.DEV_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return list.includes(userId);
}

function canUseDevPrefix(message) {
  // Dev prefix dispo partout, mais réservé owner/dev
  return isDev(message.author.id);
}

module.exports = { isOwner, isDev, canUseDevPrefix };