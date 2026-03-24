const { EmbedBuilder, AuditLogEvent, PermissionsBitField } = require('discord.js');
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

function userLabel(user) {
  if (!user) return '—';
  return `${user.tag || user.username || 'Utilisateur inconnu'} (\`${user.id || '—'}\`)`;
}

function memberLabel(member) {
  if (!member) return '—';
  return `${member} (\`${member.id}\`)`;
}

function channelLabel(channel) {
  if (!channel) return '—';
  return `${channel} (\`${channel.id || channel.name || '—'}\`)`;
}

function roleLabel(role) {
  if (!role) return '—';
  return `${role} (\`${role.id}\`)`;
}

function boolLabel(v) {
  return v ? 'Oui' : 'Non';
}

function timestampLabel(ms) {
  if (!ms) return '—';
  return `<t:${Math.floor(ms / 1000)}:F>`;
}

function permissionsToNames(perms) {
  if (!perms) return [];
  if (typeof perms.toArray === 'function') return perms.toArray();
  try {
    return new PermissionsBitField(perms).toArray();
  } catch {
    return [];
  }
}

function diffPermissionNames(before, after) {
  const names = new Set([...permissionsToNames(before), ...permissionsToNames(after)]);
  const added = [];
  const removed = [];
  for (const name of names) {
    const hadBefore = permissionsToNames(before).includes(name);
    const hasAfter = permissionsToNames(after).includes(name);
    if (!hadBefore && hasAfter) added.push(name);
    if (hadBefore && !hasAfter) removed.push(name);
  }
  return { added, removed };
}

function describeOverwriteTarget(guild, overwrite) {
  if (!overwrite) return 'Cible inconnue';
  const role = guild?.roles?.cache?.get?.(overwrite.id);
  if (role) return `Rôle ${roleLabel(role)}`;
  const member = guild?.members?.cache?.get?.(overwrite.id);
  if (member) return `Membre ${memberLabel(member)}`;
  return `ID \`${overwrite.id}\``;
}

function diffOverwriteMaps(oldChannel, newChannel) {
  const oldMap = new Map((oldChannel?.permissionOverwrites?.cache || []).map((ow) => [ow.id, ow]));
  const newMap = new Map((newChannel?.permissionOverwrites?.cache || []).map((ow) => [ow.id, ow]));
  const ids = new Set([...oldMap.keys(), ...newMap.keys()]);
  const changes = [];

  for (const id of ids) {
    const before = oldMap.get(id);
    const after = newMap.get(id);

    if (!before && after) {
      changes.push(`➕ ${describeOverwriteTarget(newChannel.guild, after)} ajouté`);
      const diff = diffPermissionNames([], after.allow);
      const denyDiff = diffPermissionNames([], after.deny);
      if (diff.added.length) changes.push(`• Allow : ${trim(diff.added.join(', '), 900)}`);
      if (denyDiff.added.length) changes.push(`• Deny : ${trim(denyDiff.added.join(', '), 900)}`);
      continue;
    }

    if (before && !after) {
      changes.push(`➖ ${describeOverwriteTarget(oldChannel.guild, before)} supprimé`);
      continue;
    }

    const allowDiff = diffPermissionNames(before.allow, after.allow);
    const denyDiff = diffPermissionNames(before.deny, after.deny);
    if (!allowDiff.added.length && !allowDiff.removed.length && !denyDiff.added.length && !denyDiff.removed.length) continue;

    changes.push(`🛠️ ${describeOverwriteTarget(newChannel.guild, after)}`);
    if (allowDiff.added.length) changes.push(`• Allow + : ${trim(allowDiff.added.join(', '), 900)}`);
    if (allowDiff.removed.length) changes.push(`• Allow - : ${trim(allowDiff.removed.join(', '), 900)}`);
    if (denyDiff.added.length) changes.push(`• Deny + : ${trim(denyDiff.added.join(', '), 900)}`);
    if (denyDiff.removed.length) changes.push(`• Deny - : ${trim(denyDiff.removed.join(', '), 900)}`);
  }

  return changes;
}

async function resolveAuditEntry(guild, type, targetId, extraMatch) {
  try {
    if (!guild?.members?.me?.permissions?.has('ViewAuditLog')) return null;
    const fetched = await guild.fetchAuditLogs({ type, limit: 8 }).catch(() => null);
    const entry = fetched?.entries?.find((e) => {
      const sameTarget = !targetId || String(e.target?.id || e.targetId || '') === String(targetId);
      const recentEnough = Date.now() - e.createdTimestamp < 20000;
      const extraOk = typeof extraMatch === 'function' ? extraMatch(e) : true;
      return sameTarget && recentEnough && extraOk;
    });
    return entry || null;
  } catch {
    return null;
  }
}

async function resolveAuditExecutor(guild, type, targetId, extraMatch) {
  const entry = await resolveAuditEntry(guild, type, targetId, extraMatch);
  return entry?.executor || null;
}

async function getLogChannel(client, guildId) {
  if (!client || !guildId) return null;
  const cfg = await logsDb.getConfig(guildId).catch(() => null);
  if (!cfg?.channelId) return null;
  const channel = await client.channels.fetch(cfg.channelId).catch(() => null);
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
      .setFooter({ text: trim(options.footer || "Ghost'Packs • Logs serveur", 2048) });

    if (options.author?.name) {
      embed.setAuthor({
        name: trim(options.author.name, 256),
        iconURL: options.author.iconURL || undefined,
      });
    }

    if (options.thumbnail) embed.setThumbnail(options.thumbnail);
    if (options.image) embed.setImage(options.image);

    if (Array.isArray(options.fields)) {
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

async function sendUserUpdateToMutualGuilds(client, user, options = {}) {
  if (!client?.guilds?.cache?.size || !user?.id) return;
  const guildIds = await logsDb.listEnabledGuildIds().catch(() => []);
  const targetGuildIds = guildIds.filter((guildId) => client.guilds.cache.get(guildId)?.members?.cache?.has?.(user.id));
  await Promise.allSettled(targetGuildIds.map((guildId) => sendLog(client, guildId, options)));
}

module.exports = {
  DEFAULT_COLORS,
  trim,
  lines,
  userLabel,
  memberLabel,
  channelLabel,
  roleLabel,
  boolLabel,
  timestampLabel,
  permissionsToNames,
  diffPermissionNames,
  diffOverwriteMaps,
  resolveAuditEntry,
  resolveAuditExecutor,
  sendLog,
  sendUserUpdateToMutualGuilds,
  AuditLogEvent,
};
