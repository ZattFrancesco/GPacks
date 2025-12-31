// src/utils/rjDrafts.js

const TTL = 15 * 60 * 1000; // 15 minutes
const drafts = new Map();

function keyOf(guildId, userId) {
  return `${guildId}:${userId}`;
}

function updateDraft(guildId, userId, data) {
  const key = keyOf(guildId, userId);
  const existing = drafts.get(key) || {};

  drafts.set(key, {
    ...existing,
    ...data,
    _expiresAt: Date.now() + TTL,
  });
}

function getDraft(guildId, userId) {
  const key = keyOf(guildId, userId);
  const draft = drafts.get(key);

  if (!draft) return null;
  if (Date.now() > draft._expiresAt) {
    drafts.delete(key);
    return null;
  }

  return draft;
}

function clearDraft(guildId, userId) {
  drafts.delete(keyOf(guildId, userId));
}

module.exports = {
  updateDraft,
  getDraft,
  clearDraft,
};