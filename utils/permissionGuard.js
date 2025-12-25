// src/utils/permissionGuard.js
const { PermissionFlagsBits } = require("discord.js");

/**
 * Règles supportées (mets seulement ce dont tu as besoin) :
 * perms = {
 *   ownerOnly: true,
 *   devOnly: true,
 *   devIds: ["..."],              // optionnel
 *   staffOnly: true,
 *   staffRoleIds: ["..."],        // optionnel
 *   userPermissions: [PermissionFlagsBits.ManageMessages], // optionnel
 *   botPermissions:  [PermissionFlagsBits.SendMessages],   // optionnel
 * }
 */

function getUserId(interaction) {
  return interaction?.user?.id || interaction?.author?.id;
}

function getMember(interaction) {
  // En DM, interaction.member est null/undefined
  return interaction?.member || null;
}

function isOwner(userId) {
  return Boolean(process.env.OWNER_ID) && userId === process.env.OWNER_ID;
}

function isDev(userId, perms) {
  // Si devIds est fourni, on l'utilise. Sinon devOnly = owner par défaut.
  if (Array.isArray(perms?.devIds) && perms.devIds.length > 0) {
    return perms.devIds.includes(userId) || isOwner(userId);
  }
  return isOwner(userId);
}

function hasAnyRole(member, roleIds) {
  if (!member || !Array.isArray(roleIds) || roleIds.length === 0) return false;
  return roleIds.some((id) => member.roles?.cache?.has(id));
}

function hasPermissions(member, permsArray) {
  if (!member || !Array.isArray(permsArray) || permsArray.length === 0) return true;
  return permsArray.every((p) => member.permissions?.has(p));
}

function botHasPermissions(interaction, permsArray) {
  if (!Array.isArray(permsArray) || permsArray.length === 0) return true;

  // DM: pas de permissions serveur à vérifier
  if (!interaction.guild) return true;

  const me = interaction.guild.members.me;
  if (!me) return true;

  return permsArray.every((p) => me.permissions.has(p));
}

/**
 * Retour :
 * { ok: true }  ou  { ok: false, reason: "..." }
 */
function checkPerms(interaction, perms) {
  if (!perms) return { ok: true };

  const userId = getUserId(interaction);
  const member = getMember(interaction);

  // 1) Owner only
  if (perms.ownerOnly) {
    if (!isOwner(userId)) return { ok: false, reason: "owner_only" };
  }

  // 2) Dev only
  if (perms.devOnly) {
    if (!isDev(userId, perms)) return { ok: false, reason: "dev_only" };
  }

  // 3) Staff only (via rôle staff ou permission admin/mod)
  if (perms.staffOnly) {
    const byRole = hasAnyRole(member, perms.staffRoleIds || []);
    const byAdmin = member?.permissions?.has(PermissionFlagsBits.Administrator);
    const byMod = member?.permissions?.has(PermissionFlagsBits.ManageGuild);
    if (!byRole && !byAdmin && !byMod) return { ok: false, reason: "staff_only" };
  }

  // 4) Permissions utilisateur spécifiques (serveur)
  if (perms.userPermissions) {
    if (!interaction.guild) return { ok: false, reason: "guild_only" };
    if (!hasPermissions(member, perms.userPermissions)) return { ok: false, reason: "missing_user_perms" };
  }

  // 5) Permissions bot spécifiques
  if (perms.botPermissions) {
    if (!botHasPermissions(interaction, perms.botPermissions)) return { ok: false, reason: "missing_bot_perms" };
  }

  return { ok: true };
}

async function deny(interaction, reason) {
  const map = {
    owner_only: "❌ Réservé au propriétaire du bot.",
    dev_only: "❌ Réservé aux développeurs du bot.",
    staff_only: "❌ Réservé au staff.",
    guild_only: "❌ Cette action ne marche que sur un serveur.",
    missing_user_perms: "❌ Tu n’as pas les permissions nécessaires.",
    missing_bot_perms: "❌ Je n’ai pas les permissions nécessaires pour faire ça."
  };

  const content = map[reason] || "❌ Accès refusé.";

  // Autocomplete : on ne peut pas reply comme une commande
  if (interaction.isAutocomplete?.()) return;

  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content, ephemeral: true });
    } else {
      await interaction.reply({ content, ephemeral: true });
    }
  } catch {}
}

module.exports = { checkPerms, deny };