const { isOwner } = require("../src/utils/permissions");
const { normalizeUserId, removeFromBlacklist, isBlacklisted } = require("../services/blacklist.db");

module.exports = {
  id: "blacklist:remove",

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: "❌ Réservé à l'owner.", ephemeral: true });
    }

    const rawUser = interaction.fields.getTextInputValue("user");
    const userId = normalizeUserId(rawUser);

    if (!userId) {
      return interaction.reply({ content: "❌ User ID/mention invalide.", ephemeral: true });
    }

    const before = await isBlacklisted(userId);
    if (!before.blacklisted) {
      return interaction.reply({ content: `ℹ️ <@${userId}> n'est pas blacklisté.`, ephemeral: true });
    }

    await removeFromBlacklist(userId);

    return interaction.reply({
      content: `✅ <@${userId}> a été retiré de la blacklist.`,
      ephemeral: true,
    });
  },
};