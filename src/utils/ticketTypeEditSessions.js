const sessions = new Map();
const TTL_MS = 15 * 60 * 1000;

function makeKey(guildId, userId, typeId, field) {
  return [guildId || '', userId || '', typeId || '', field || ''].join(':');
}

function setTypeEditSession({ guildId, userId, typeId, field, channelId, messageId }) {
  const key = makeKey(guildId, userId, typeId, field);
  sessions.set(key, {
    guildId,
    userId,
    typeId,
    field,
    channelId: channelId || null,
    messageId: messageId || null,
    createdAt: Date.now(),
  });
}

function getTypeEditSession({ guildId, userId, typeId, field }) {
  const key = makeKey(guildId, userId, typeId, field);
  const session = sessions.get(key);
  if (!session) return null;
  if (Date.now() - session.createdAt > TTL_MS) {
    sessions.delete(key);
    return null;
  }
  return session;
}

function clearTypeEditSession({ guildId, userId, typeId, field }) {
  const key = makeKey(guildId, userId, typeId, field);
  sessions.delete(key);
}

// Nettoyage automatique
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of sessions.entries()) {
    if (now - (v.createdAt || 0) > TTL_MS) sessions.delete(k);
  }
}, 60 * 1000).unref?.();

module.exports = {
  setTypeEditSession,
  getTypeEditSession,
  clearTypeEditSession,
};
