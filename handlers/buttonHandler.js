// handlers/buttonHandler.js
const { checkPermsDb, deny } = require("../src/utils/permissionGuardDb");

module.exports = async (client, interaction) => {
  const btn = client.buttons.get(interaction.customId);
  if (!btn) return;

  const itemKey = `button:${interaction.customId}`;
  const res = await checkPermsDb(interaction, itemKey);
  if (!res.ok) return deny(interaction, res.reason);

  await btn.execute(interaction, client);
};