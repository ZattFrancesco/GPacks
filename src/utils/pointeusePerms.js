// src/utils/pointeusePerms.js
const { PermissionFlagsBits } = require("discord.js");

function isAdmin(member) {
  try {
    return Boolean(member?.permissions?.has(PermissionFlagsBits.Administrator));
  } catch {
    return false;
  }
}

function isStaff(member, settings) {
  if (!member) return false;
  if (isAdmin(member)) return true;
  const roles = settings?.staff_roles || [];
  if (!Array.isArray(roles) || roles.length === 0) return false;
  return roles.some((rid) => member.roles?.cache?.has(String(rid)));
}

module.exports = { isAdmin, isStaff };
