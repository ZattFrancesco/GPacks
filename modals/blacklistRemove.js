const { isOwner } = require("../src/utils/permissions");
const { normalizeUserId, removeFromBlacklist, isBlacklisted } = require("../services/blacklist.db");
const { auditLog } = require("../src/utils/auditLog");

module.exports = {
  id: "blacklist:remove",

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: "❌ Réservé à l'owner.", flags: 64 });
    }

    const rawUser = interaction.fields.getTextInputValue("user");
    const userId = normalizeUserId(rawUser);

    if (!userId) {
      return interaction.reply({ content: "❌ User ID/mention invalide.", flags: 64 });
    }

    const before = await isBlacklisted(userId);
    if (!before.blacklisted) {
      return interaction.reply({ content: `ℹ️ <@${userId}> n'est pas blacklisté.`, flags: 64 });
    }

    await removeFromBlacklist(userId);

    // ✅ Log classique
    await auditLog(interaction.client, interaction.guildId, {
      module: "BLACKLIST",
      action: "REMOVE",
      level: "INFO",
      userId: interaction.user.id,
      sourceChannelId: interaction.channelId,
      message: `<@${userId}> retiré de la blacklist.`,
      meta: { targetUserId: userId },
    }).catch(() => {});

    return interaction.reply({
      content: `✅ <@${userId}> a été retiré de la blacklist.`,
      flags: 64,
    });
  },
};