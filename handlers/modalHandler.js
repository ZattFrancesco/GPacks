const { checkPermsDb, deny } = require("../src/utils/permissionGuardDb");

module.exports = async (client, interaction) => {
  let modal = client.modals?.get(interaction.customId);

  if (!modal && Array.isArray(client.modalsPrefix)) {
    modal = client.modalsPrefix.find((m) => interaction.customId.startsWith(m.idPrefix));
  }
  if (!modal) return;

  const itemKey = `modal:${interaction.customId}`;
  const res = await checkPermsDb(interaction, itemKey);
  if (!res.ok) return deny(interaction, res.reason);

  await modal.execute(interaction, client);
};