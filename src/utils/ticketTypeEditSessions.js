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

module.exports = {
  setTypeEditSession,
  getTypeEditSession,
  clearTypeEditSession,
};
