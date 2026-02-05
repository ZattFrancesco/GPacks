const { isOwner } = require("../src/utils/permissions");
const { normalizeUserId, addToBlacklist, isBlacklisted } = require("../services/blacklist.db");
const { auditLog } = require("../src/utils/auditLog");

module.exports = {
  id: "blacklist:add",

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: "❌ Réservé à l'owner.", flags: 64 });
    }

    const rawUser = interaction.fields.getTextInputValue("user");
    const rawReason = interaction.fields.getTextInputValue("reason") || null;

    const userId = normalizeUserId(rawUser);
    if (!userId) {
      return interaction.reply({ content: "❌ User ID/mention invalide.", flags: 64 });
    }

    if (userId === interaction.user.id) {
      return interaction.reply({ content: "❌ Tu ne peux pas te blacklist toi-même.", flags: 64 });
    }

    const before = await isBlacklisted(userId);
    await addToBlacklist({ userId, reason: rawReason, addedBy: interaction.user.id });

    // ✅ Log classique
    await auditLog(interaction.client, interaction.guildId, {
      module: "BLACKLIST",
      action: "ADD",
      level: "WARN",
      userId: interaction.user.id,
      sourceChannelId: interaction.channelId,
      message: `<@${userId}> ajouté à la blacklist${rawReason ? ` — Raison: ${rawReason}` : ""}`,
      meta: { targetUserId: userId, reason: rawReason || null, already: Boolean(before?.blacklisted) },
    }).catch(() => {});

    return interaction.reply({
      content:
        `✅ <@${userId}> est blacklisté.` +
        (rawReason ? `\n📝 Raison: ${rawReason}` : "") +
        (before.blacklisted ? "\nℹ️ (déjà blacklisté → infos mises à jour)" : ""),
      flags: 64,
    });
  },
};