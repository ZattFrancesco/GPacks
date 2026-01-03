// src/utils/rjReportSessions.js
// Sessions en mémoire pour pagination + recherche.

const TTL = 15 * 60 * 1000; // 15 minutes
const sessions = new Map();

function makeSessionId() {
  return `s_${Math.random().toString(36).slice(2, 10)}`;
}

function keyOf(guildId, ownerId, sessionId) {
  return `${guildId}:${ownerId}:${sessionId}`;
}

function createSession(guildId, ownerId, data = {}) {
  const sessionId = makeSessionId();
  sessions.set(keyOf(guildId, ownerId, sessionId), {
    ...data,
    _expiresAt: Date.now() + TTL,
  });
  return sessionId;
}

function getSession(guildId, ownerId, sessionId) {
  const key = keyOf(guildId, ownerId, sessionId);
  const sess = sessions.get(key);
  if (!sess) return null;
  if (Date.now() > sess._expiresAt) {
    sessions.delete(key);
    return null;
  }
  return sess;
}

function updateSession(guildId, ownerId, sessionId, data = {}) {
  const key = keyOf(guildId, ownerId, sessionId);
  const existing = sessions.get(key);
  if (!existing) return false;
  sessions.set(key, {
    ...existing,
    ...data,
    _expiresAt: Date.now() + TTL,
  });
  return true;
}

function clearSession(guildId, ownerId, sessionId) {
  sessions.delete(keyOf(guildId, ownerId, sessionId));
}

module.exports = {
  createSession,
  getSession,
  updateSession,
  clearSession,
};
