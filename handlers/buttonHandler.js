module.exports = async (client, interaction) => {
  const btn = client.buttons.get(interaction.customId);
  if (!btn) return;
  await btn.execute(interaction, client);
};