// src/utils/rjDrafts.js
// Stockage temporaire en mémoire pour /rapport-jugement (wizard multi-modals)
// Expire au bout de 15 minutes.

const TTL_MS = 15 * 60 * 1000;
const drafts = new Map();

function keyOf(guildId, userId) {
  return `${guildId}:${userId}`;
}

function setDraft(guildId, userId, data) {
  drafts.set(keyOf(guildId, userId), {
    data,
    expiresAt: Date.now() + TTL_MS,
  });
}

function getDraft(guildId, userId) {
  const k = keyOf(guildId, userId);
  const entry = drafts.get(k);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    drafts.delete(k);
    return null;
  }
  return entry.data;
}

function updateDraft(guildId, userId, partial) {
  const d = getDraft(guildId, userId);
  if (!d) return null;

  const next = { ...d, ...partial };
  setDraft(guildId, userId, next);
  return next;
}

function clearDraft(guildId, userId) {
  drafts.delete(keyOf(guildId, userId));
}

// petit nettoyage automatique
setInterval(() => {
  const now = Date.now();
  for (const [k, entry] of drafts.entries()) {
    if (now > entry.expiresAt) drafts.delete(k);
  }
}, 60 * 1000).unref?.();

module.exports = {
  setDraft,
  getDraft,
  updateDraft,
  clearDraft,
};
