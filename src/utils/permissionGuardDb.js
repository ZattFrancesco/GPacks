// src/utils/permissionGuardDb.js
const logger = require("./logger");
const { getGlobalCategoryForItem } = require("../../services/registry.db");

/**
 * checkPermsDb(interaction, itemKey)
 * - Retourne un objet { ok: boolean, reason?: string }
 * - Pour l'instant c'est permissif : on autorise tout (sauf erreur critique),
 *   mais la structure est déjà prête pour ajouter des règles DB.
 */
async function checkPermsDb(interaction, itemKey) {
  try {
    // Si on ne sait pas identifier l'item, on laisse passer
    const key =
      itemKey ||
      interaction?.commandName ||
      interaction?.customId ||
      null;

    if (!key) return { ok: true };

    // Exemple d’appel DB (utile pour futur système de catégories)
    // Si la DB n'est pas prête, ça ne doit pas casser le bot.
    try {
      await getGlobalCategoryForItem(key);
    } catch (err) {
      logger.warn(`PermissionGuardDb: DB non dispo pour "${key}" (${err?.message || err})`);
    }

    // ✅ Mode permissif (tu pourras remplacer par tes règles plus tard)
    return { ok: true };
  } catch (err) {
    logger.error(`PermissionGuardDb error: ${err?.stack || err}`);
    // On ne bloque pas le bot sur une erreur : on autorise.
    return { ok: true };
  }
}

/**
 * Envoie un refus propre et évite les "Unknown interaction" / spam.
 */
async function deny(interaction, reason) {
  const content = reason ? `❌ ${reason}` : "❌ Accès refusé.";

  // Autocomplete : pas de reply classique
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
