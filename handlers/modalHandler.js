// handlers/modalHandler.js
const { checkPermsDb, deny } = require("../src/utils/permissionGuardDb");

module.exports = async (client, interaction) => {
  const modal = client.modals.get(interaction.customId);
  if (!modal) return;

  const itemKey = `modal:${interaction.customId}`;
  const res = await checkPermsDb(interaction, itemKey);
  if (!res.ok) return deny(interaction, res.reason);

  await modal.execute(interaction, client);
};
