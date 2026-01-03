const { checkPermsDb, deny } = require("../src/utils/permissionGuardDb");

module.exports = async (client, interaction) => {
  let btn = client.buttons?.get(interaction.customId);

  if (!btn && Array.isArray(client.buttonsPrefix)) {
    btn = client.buttonsPrefix.find((b) => interaction.customId.startsWith(b.idPrefix));
  }
  if (!btn) return;

  const itemKey = `button:${interaction.customId}`;
  const res = await checkPermsDb(interaction, itemKey);
  if (!res.ok) return deny(interaction, res.reason);

  await btn.execute(interaction, client);
};