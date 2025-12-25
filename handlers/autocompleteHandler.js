module.exports = async (client, interaction) => {
  const auto = client.autocomplete.get(interaction.commandName);
  if (!auto) return;
  await auto.execute(interaction, client);
};