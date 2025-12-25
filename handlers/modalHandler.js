module.exports = async (client, interaction) => {
  const modal = client.modals.get(interaction.customId);
  if (!modal) return;
  await modal.execute(interaction, client);
};