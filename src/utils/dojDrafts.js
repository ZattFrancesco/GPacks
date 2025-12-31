// src/utils/dojDrafts.js
// Stockage TEMPORAIRE (en mémoire) des dossiers "demande-jugement".
// - Clean: simple, pas de DB, expire automatiquement.

const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 min

/** @type {Map<string, {payload: any, expiresAt: number, timeout: NodeJS.Timeout}>} */
const drafts = new Map();

function makeKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

function setDraft(guildId, userId, payload, ttlMs = DEFAULT_TTL_MS) {
  const k = makeKey(guildId, userId);

  // clear old
  const prev = drafts.get(k);
  if (prev?.timeout) clearTimeout(prev.timeout);

  const expiresAt = Date.now() + ttlMs;
  const timeout = setTimeout(() => {
    drafts.delete(k);
  }, ttlMs);

  drafts.set(k, { payload, expiresAt, timeout });
  return payload;
}

function getDraft(guildId, userId) {
  const k = makeKey(guildId, userId);
  const item = drafts.get(k);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    if (item.timeout) clearTimeout(item.timeout);
    drafts.delete(k);
    return null;
  }
  return item.payload;
}

function clearDraft(guildId, userId) {
  const k = makeKey(guildId, userId);
  const item = drafts.get(k);
  if (item?.timeout) clearTimeout(item.timeout);
  drafts.delete(k);
}

module.exports = {
  setDraft,
  getDraft,
  clearDraft,
};
