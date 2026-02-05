const { checkPermsDb, deny } = require("../src/utils/permissionGuardDb");
const logger = require("../src/utils/logger");

module.exports = async (client, interaction) => {
  let btn = client.buttons?.get(interaction.customId);

  if (!btn && Array.isArray(client.buttonsPrefix)) {
    // Prefer the most specific prefix (longest idPrefix) to avoid collisions.
    const matches = client.buttonsPrefix
      .filter((b) => interaction.customId.startsWith(b.idPrefix))
      .sort((a, b) => (b.idPrefix?.length || 0) - (a.idPrefix?.length || 0));
    btn = matches[0];
  }
  if (!btn) return;

  const itemKey = `button:${interaction.customId}`;
  const res = await checkPermsDb(interaction, itemKey);
  if (!res.ok) return deny(interaction, res.reason);

  try {
    await btn.execute(interaction, client);
  } catch (err) {
    // Discord "Unknown interaction" happens when the user clicks too late
    // or the interaction already got acknowledged.
    if (err?.code === 10062) return;

    logger.error(`Button handler error (${interaction.customId})`, err);

    // Best-effort user feedback (only if still possible).
    try {
      if (interaction.isRepliable?.() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "Une erreur est survenue sur ce bouton.", ephemeral: true });
      }
    } catch (_) {}
  }
};
