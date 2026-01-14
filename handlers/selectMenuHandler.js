const { checkPermsDb, deny } = require("../src/utils/permissionGuardDb");

module.exports = async (client, interaction) => {
  let menu = client.selectMenus?.get(interaction.customId);

  if (!menu && Array.isArray(client.selectMenusPrefix)) {
    // Prefer the most specific prefix (longest idPrefix) to avoid collisions.
    // Example: "ticketpanel:edit:" must win over "ticketpanel:".
    const matches = client.selectMenusPrefix
      .filter((m) => interaction.customId.startsWith(m.idPrefix))
      .sort((a, b) => (b.idPrefix?.length || 0) - (a.idPrefix?.length || 0));
    menu = matches[0];
  }
  if (!menu) return;

  const itemKey = `select:${interaction.customId}`;
  const res = await checkPermsDb(interaction, itemKey);
  if (!res.ok) return deny(interaction, res.reason);

  await menu.execute(interaction, client);
};