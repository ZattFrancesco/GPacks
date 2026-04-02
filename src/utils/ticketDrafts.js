// src/utils/ticketDrafts.js
// Drafts en mémoire pour enchaîner des interactions (panel -> modal -> action).

const openDrafts = new Map();
const typeCreateDrafts = new Map();

const TTL_MS = 10 * 60 * 1000; // 10 minutes

function key(guildId, userId) {
  return `${guildId}:${userId}`;
}

function getFrom(map, guildId, userId) {
  const v = map.get(key(guildId, userId));
  if (!v) return null;
  if (Date.now() - (v.at || 0) > TTL_MS) {
    map.delete(key(guildId, userId));
    return null;
  }
  return v;
}

function setOpenDraft(guildId, userId, data) {
  openDrafts.set(key(guildId, userId), { ...data, at: Date.now() });
}

function getOpenDraft(guildId, userId) {
  return getFrom(openDrafts, guildId, userId);
}

function clearOpenDraft(guildId, userId) {
  openDrafts.delete(key(guildId, userId));
}

function setTypeCreateDraft(guildId, userId, data) {
  typeCreateDrafts.set(key(guildId, userId), { ...data, at: Date.now() });
}

function getTypeCreateDraft(guildId, userId) {
  return getFrom(typeCreateDrafts, guildId, userId);
}

function clearTypeCreateDraft(guildId, userId) {
  typeCreateDrafts.delete(key(guildId, userId));
}

// Nettoyage automatique des drafts expirés
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of openDrafts.entries()) {
    if (now - (v.at || 0) > TTL_MS) openDrafts.delete(k);
  }
  for (const [k, v] of typeCreateDrafts.entries()) {
    if (now - (v.at || 0) > TTL_MS) typeCreateDrafts.delete(k);
  }
}, 60 * 1000).unref?.();

module.exports = {
  setOpenDraft,
  getOpenDraft,
  clearOpenDraft,
  setTypeCreateDraft,
  getTypeCreateDraft,
  clearTypeCreateDraft,
};
