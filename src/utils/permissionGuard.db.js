// src/utils/permissionGuardDb.js
const { PermissionFlagsBits } = require("discord.js");

const { getGuildRoles, getPermissionRule } = require("../../services/permissions.db");
const { getGlobalCategoryForItem } = require("../../services/registry.db");

function isOwner(userId) {
  return Boolean(process.env.OWNER_ID) && userId === process.env.OWNER_ID;
}

function memberHasRole(member, roleId) {
  if (!member || !roleId) return false;
  return member.roles?.cache?.has(roleId);
}

async function checkPermsDb(interaction, itemKey) {
  // DM: laisse passer (tu peux changer si tu veux)
  if (!interaction.guild) return { ok: true };

  const userId = interaction.user.id;
  const member = interaction.member;

  const categoryKey = await getGlobalCategoryForItem(itemKey);
  const rule = await getPermissionRule(interaction.guild.id, itemKey, categoryKey);
  const access = rule?.access || "public";

  if (access === "public") return { ok: true };
  if (access === "deny") return { ok: false, reason: "deny" };

  if (access === "owner") {
    return isOwner(userId) ? { ok: true } : { ok: false, reason: "owner_only" };
  }

  const roles = await getGuildRoles(interaction.guild.id);

  if (access === "admin") {
    const ok =
      memberHasRole(member, roles.admin_role_id) ||
      member.permissions.has(PermissionFlagsBits.Administrator);
    return ok ? { ok: true } : { ok: false, reason: "admin_only" };
  }

  if (access === "mod") {
    const ok =
      memberHasRole(member, roles.mod_role_id) ||
      member.permissions.has(PermissionFlagsBits.ManageGuild);
    return ok ? { ok: true } : { ok: false, reason: "mod_only" };
  }

  if (access === "staff") {
    const ok =
      memberHasRole(member, roles.staff_role_id) ||
      member.permissions.has(PermissionFlagsBits.ManageGuild);
    return ok ? { ok: true } : { ok: false, reason: "staff_only" };
  }

  // fallback
  return { ok: true };
}

async function deny(interaction, reason) {
  const map = {
    deny: "❌ Action désactivée.",
    owner_only: "❌ Réservé au propriétaire du bot.",
    admin_only: "❌ Réservé aux admins.",
    mod_only: "❌ Réservé aux modérateurs.",
    staff_only: "❌ Réservé au staff.",
  };
  const content = map[reason] || "❌ Accès refusé.";

  // autocomplete: pas de reply normal
  if (interaction.isAutocomplete?.()) return;

  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content, ephemeral: true });
    } else {
      await interaction.reply({ content, ephemeral: true });
    }
  } catch {}
}

module.exports = { checkPermsDb, deny };