// src/utils/internalPlanningDrafts.js

// Drafts en mémoire (simple et suffisant).
// Clé = `${guildId}:${userId}`
const drafts = new Map();

function key(guildId, userId) {
  return `${guildId}:${userId}`;
}

function setDraft(guildId, userId, data) {
  drafts.set(key(guildId, userId), { ...data });
}

function getDraft(guildId, userId) {
  return drafts.get(key(guildId, userId)) || null;
}

function clearDraft(guildId, userId) {
  drafts.delete(key(guildId, userId));
}

module.exports = { setDraft, getDraft, clearDraft };
