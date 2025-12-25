module.exports = async (client, interaction) => {
  const menu = client.selectMenus.get(interaction.customId);
  if (!menu) return;
  await menu.execute(interaction, client);
};