const { isOwner } = require("../src/utils/permissions");
const { sendOwnerMessageToUser } = require("../src/utils/modmail");

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

    // On construit un "authorMessage" minimal pour réutiliser l'embed récap.
    const fakeAuthorMessage = {
      author: interaction.user,
      content: message,
      attachments: { size: 0, map: () => [] },
      createdAt: new Date(),
    };

    const result = await sendOwnerMessageToUser(client, {
      userId,
      content: message,
      attachments: [],
      authorMessage: fakeAuthorMessage,
      archiveInThread: true,
    }).catch((error) => {
      console.error("[pm modal] erreur envoi DM :", error);
      return { ok: false, code: "exception", error };
    });

    if (result?.ok) {
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
