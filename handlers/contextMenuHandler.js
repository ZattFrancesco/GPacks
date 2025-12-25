module.exports = async (client, interaction) => {
  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) return;
  await cmd.execute(interaction, client);
};