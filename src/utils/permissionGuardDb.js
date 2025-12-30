// src/utils/permissionGuardDb.js
const logger = require("./logger");
const { getGlobalCategoryForItem } = require("../../services/registry.db");
const { isOwner } = require("./permissions");
const { isBlacklisted } = require("../../services/blacklist.db");

async function checkPermsDb(interaction, itemKey) {
  try {
    // ✅ Blacklist globale (owner jamais bloqué)
    const userId = interaction?.user?.id || interaction?.member?.user?.id;
    if (userId && !isOwner(userId)) {
      const bl = await isBlacklisted(userId);
      if (bl.blacklisted) {
        const msg = bl.reason
          ? `Tu es blacklisté du bot. Raison: ${bl.reason}`
          : "Tu es blacklisté du bot.";
        return { ok: false, reason: msg };
      }
    }

    // DB registry (optionnel / futur)
    const key = itemKey || interaction?.commandName || interaction?.customId || null;
    if (!key) return { ok: true };

    try {
      await getGlobalCategoryForItem(key);
    } catch (err) {
      logger.warn(`PermissionGuardDb: DB non dispo pour "${key}" (${err?.message || err})`);
    }

    return { ok: true };
  } catch (err) {
    logger.error(`PermissionGuardDb error: ${err?.stack || err}`);
    return { ok: true }; // fail-open
  }
}

async function deny(interaction, reason) {
  const content = reason ? `❌ ${reason}` : "❌ Accès refusé.";
  if (interaction?.isAutocomplete?.()) return;

  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content, ephemeral: true });
    } else {
      await interaction.reply({ content, ephemeral: true });
    }
  } catch {}
}

module.exports = { checkPermsDb, deny };