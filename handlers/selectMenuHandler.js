const { checkPermsDb, deny } = require("../src/utils/permissionGuardDb");

module.exports = async (client, interaction) => {
  let menu = client.selectMenus?.get(interaction.customId);

  if (!menu && Array.isArray(client.selectMenusPrefix)) {
    menu = client.selectMenusPrefix.find((m) => interaction.customId.startsWith(m.idPrefix));
  }
  if (!menu) return;

  const itemKey = `select:${interaction.customId}`;
  const res = await checkPermsDb(interaction, itemKey);
  if (!res.ok) return deny(interaction, res.reason);

  try {
    await menu.execute(interaction, client);
  } catch (err) {
    console.error("[selectMenuHandler]", err);
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({ content: "❌ Une erreur est survenue avec ce menu.", ephemeral: true });
      }
    } catch (_) {}
  }
};