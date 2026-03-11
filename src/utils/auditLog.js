const logger = require('./logger');

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

async function auditLog(client, guildId, entry = {}) {
  const payload = {
    module: entry.module || 'SYSTEM',
    action: entry.action || 'EVENT',
    level: entry.level || 'INFO',
    userId: entry.userId || null,
    sourceChannelId: entry.sourceChannelId || null,
    message: entry.message || '',
    meta: entry.meta || null,
  };

  const prefix = `[AUDIT] [guild:${guildId || 'unknown'}] [${payload.module}] [${payload.action}]`;
  if (payload.meta) {
    logger.info(prefix, payload.message, safeStringify({
      userId: payload.userId,
      sourceChannelId: payload.sourceChannelId,
      meta: payload.meta,
    }));
  } else {
    logger.info(prefix, payload.message, safeStringify({
      userId: payload.userId,
      sourceChannelId: payload.sourceChannelId,
    }));
  }

  return true;
}

module.exports = { auditLog };