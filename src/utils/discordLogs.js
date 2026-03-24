const {
  EmbedBuilder,
  ChannelType,
  AuditLogEvent,
} = require('discord.js');
const logsDb = require('../../services/logs.db');
const logger = require('./logger');

const DEFAULT_COLORS = {
  info: 0x5865f2,
  success: 0x57f287,
  warning: 0xfee75c,
  danger: 0xed4245,
  neutral: 0x2b2d31,
};

function trim(value, max = 1024) {
  const str = String(value ?? '—');
  if (str.length <= max) return str;
  return `${str.slice(0, Math.max(0, max - 3))}...`;
}

function lines(parts = []) {
  return parts.filter(Boolean).join('\n');
}

function channelLabel(channel) {
  if (!channel) return '—';
  return `${channel} (\`${channel.name || channel.id}\`)`;
}

function userLabel(user) {
  if (!user) return '—';
  return `${user.tag || user.username || user.id} (\`${user.id}\`)`;
}

function roleLabel(role) {
  if (!role) return '—';
  return `${role} (\`${role.id}\`)`;
}

function diffPermissionNames(before, after) {
  const names = new Set([...(before?.toArray?.() || []), ...(after?.toArray?.() || [])]);
  const added = [];
  const removed = [];

  for (const name of names) {
    const hadBefore = before?.has?.(name);
    const hasAfter = after?.has?.(name);
    if (!hadBefore && hasAfter) added.push(name);
    if (hadBefore && !hasAfter) removed.push(name);
  }

  return { added, removed };
}

async function resolveAuditExecutor(guild, type, targetId) {
  try {
    if (!guild?.members?.me?.permissions?.has('ViewAuditLog')) return null;
    const fetched = await guild.fetchAuditLogs({ type, limit: 6 }).catch(() => null);
    const entry = fetched?.entries?.find((e) => {
      const sameTarget = !targetId || String(e.target?.id || e.targetId || '') === String(targetId);
      const recentEnough = Date.now() - e.createdTimestamp < 15000;
      return sameTarget && recentEnough;
    });
    return entry ? entry.executor : null;
  } catch {
    return null;
  }
}

async function getLogChannel(client, guildId) {
  if (!client || !guildId) return null;
  const cfg = await logsDb.getConfig(guildId).catch(() => null);
  const channelId = cfg?.channelId;
  if (!channelId) return null;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.()) return null;
  return channel;
}

async function sendLog(client, guildId, options = {}) {
  try {
    const channel = await getLogChannel(client, guildId);
    if (!channel) return false;

    const embed = new EmbedBuilder()
      .setColor(options.color || DEFAULT_COLORS.info)
      .setTitle(trim(options.title || 'Log', 256))
      .setDescription(trim(options.description || '—', 4096))
      .setTimestamp(options.timestamp ? new Date(options.timestamp) : new Date())
      .setFooter({ text: trim(options.footer || 'Ghost\'Packs • Logs', 2048) });

    if (options.author?.name) {
      embed.setAuthor({
        name: trim(options.author.name, 256),
        iconURL: options.author.iconURL || undefined,
      });
    }

    if (options.thumbnail) embed.setThumbnail(options.thumbnail);

    if (Array.isArray(options.fields?.length ? options.fields : options.fields)) {
      embed.addFields(
        options.fields
          .filter((f) => f && f.name)
          .slice(0, 25)
          .map((f) => ({
            name: trim(f.name, 256),
            value: trim(f.value || '—', 1024),
            inline: Boolean(f.inline),
          }))
      );
    }

    await channel.send({ embeds: [embed] });
    return true;
  } catch (err) {
    logger.warn(`sendLog error: ${err?.message || err}`);
    return false;
  }
}

async function sendBotLogToAllGuilds(client, options = {}) {
  if (!client?.guilds?.cache?.size) return;
  const guildIds = [...client.guilds.cache.keys()];
  await Promise.allSettled(guildIds.map((guildId) => sendLog(client, guildId, options)));
}

module.exports = {
  DEFAULT_COLORS,
  trim,
  lines,
  channelLabel,
  userLabel,
  roleLabel,
  diffPermissionNames,
  resolveAuditExecutor,
  sendLog,
  sendBotLogToAllGuilds,
  ChannelType,
  AuditLogEvent,
};
