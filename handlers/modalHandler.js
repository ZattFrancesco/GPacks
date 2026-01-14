const { checkPermsDb, deny } = require("../src/utils/permissionGuardDb");

module.exports = async (client, interaction) => {
  let modal = client.modals?.get(interaction.customId);

  if (!modal && Array.isArray(client.modalsPrefix)) {
    // Prefer the most specific prefix (longest idPrefix) to avoid collisions.
    const matches = client.modalsPrefix
      .filter((m) => interaction.customId.startsWith(m.idPrefix))
      .sort((a, b) => (b.idPrefix?.length || 0) - (a.idPrefix?.length || 0));
    modal = matches[0];
  }
  if (!modal) return;

  const itemKey = `modal:${interaction.customId}`;
  const res = await checkPermsDb(interaction, itemKey);
  if (!res.ok) return deny(interaction, res.reason);

  await modal.execute(interaction, client);
};