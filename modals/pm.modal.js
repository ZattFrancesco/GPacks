const { isOwner } = require("../src/utils/permissions");
const { sendOwnerMessageToUser } = require("../src/utils/modmail");
const { saveMapping } = require("../services/modmailMap.db");

module.exports = {
  idPrefix: "pm:send:",

  async execute(interaction, client) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        content: "❌ Cette action est réservée au propriétaire du bot.",
        flags: 64,
      });
    }

    const parts = interaction.customId.split(":");
    const userId = parts[2];
    const message = interaction.fields.getTextInputValue("message")?.trim();

    const result = await sendOwnerMessageToUser(client, {
      userId,
      senderUser: interaction.user,
      content: message,
      attachments: [],
      archiveInThread: true,
    }).catch((error) => {
      console.error("[pm modal] erreur envoi DM :", error);
      return { ok: false, code: "exception", error };
    });

    if (result?.ok) {
      // Mapping pour que les futures actions (édit/supp/réact/pin) marchent.
      if (result.threadMsgId && result.dmMsgId) {
        await saveMapping({
          threadId: result.thread?.id,
          threadMsgId: result.threadMsgId,
          dmChannelId: result.dmChannelId,
          dmMsgId: result.dmMsgId,
          userId: result.user.id,
          direction: 'outgoing',
          webhookId: result.webhookId,
        });
      }
      return interaction.reply({
        content: `✅ Message envoyé à **${result.user.tag}** (\`${result.user.id}\`).`,
        flags: 64,
      });
    }

    const reasonByCode = {
      invalid_id: "❌ ID utilisateur invalide.",
      empty: "❌ Le message est vide.",
      user_not_found: "❌ Utilisateur introuvable.",
      dm_failed: "❌ Impossible d'envoyer le message privé à cet utilisateur.",
    };

    return interaction.reply({
      content: reasonByCode[result?.code] || "❌ Échec de l'envoi du DM.",
      flags: 64,
    });
  },
};
