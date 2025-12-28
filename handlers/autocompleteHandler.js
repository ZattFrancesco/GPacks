// handlers/autocompleteHandler.js
const { checkPermsDb } = require("../src/utils/permissionGuardDb");

module.exports = async (client, interaction) => {
  const auto = client.autocomplete.get(interaction.commandName);
  if (!auto) return;

  const itemKey = `autocomplete:${interaction.commandName}`;
  const res = await checkPermsDb(interaction, itemKey);
  if (!res.ok) return;

  await auto.execute(interaction, client);
};