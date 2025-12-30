const { checkPermsDb, deny } = require("../src/utils/permissionGuardDb");

module.exports = async (client, interaction) => {
  let menu = client.selectMenus?.get(interaction.customId);

  if (!menu && Array.isArray(client.selectMenusPrefix)) {
    menu = client.selectMenusPrefix.find((m) => interaction.customId.startsWith(m.idPrefix));
  }
  if (!menu) return;

  const itemKey = `select:${interaction.customId}`;
  const res = await checkPermsDb(interaction, itemKey);
  if (!res.ok) return deny(interaction, res.reason);

  await menu.execute(interaction, client);
};