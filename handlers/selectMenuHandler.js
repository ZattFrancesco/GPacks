// handlers/selectMenuHandler.js
const { checkPermsDb, deny } = require("../src/utils/permissionGuardDb");

module.exports = async (client, interaction) => {
  const menu = client.selectMenus.get(interaction.customId);
  if (!menu) return;

  const itemKey = `select:${interaction.customId}`;
  const res = await checkPermsDb(interaction, itemKey);
  if (!res.ok) return deny(interaction, res.reason);

  await menu.execute(interaction, client);
};