const { isOwner } = require("../src/utils/permissions");
const { normalizeUserId, addToBlacklist, isBlacklisted } = require("../services/blacklist.db");

module.exports = {
  id: "blacklist:add",

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: "❌ Réservé à l'owner.", ephemeral: true });
    }

    const rawUser = interaction.fields.getTextInputValue("user");
    const rawReason = interaction.fields.getTextInputValue("reason") || null;

    const userId = normalizeUserId(rawUser);
    if (!userId) {
      return interaction.reply({ content: "❌ User ID/mention invalide.", ephemeral: true });
    }

    if (userId === interaction.user.id) {
      return interaction.reply({ content: "❌ Tu ne peux pas te blacklist toi-même.", ephemeral: true });
    }

    const before = await isBlacklisted(userId);
    await addToBlacklist({ userId, reason: rawReason, addedBy: interaction.user.id });

    return interaction.reply({
      content:
        `✅ <@${userId}> est blacklisté.` +
        (rawReason ? `\n📝 Raison: ${rawReason}` : "") +
        (before.blacklisted ? "\nℹ️ (déjà blacklisté → infos mises à jour)" : ""),
      ephemeral: true,
    });
  },
};