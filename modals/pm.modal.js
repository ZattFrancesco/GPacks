const { isOwner } = require("../src/utils/permissions");

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

    if (!userId || !/^\d{17,20}$/.test(userId)) {
      return interaction.reply({
        content: "❌ ID utilisateur invalide.",
        flags: 64,
      });
    }

    if (!message) {
      return interaction.reply({
        content: "❌ Le message est vide.",
        flags: 64,
      });
    }

    try {
      const user = await client.users.fetch(userId);

      if (!user) {
        return interaction.reply({
          content: "❌ Utilisateur introuvable.",
          flags: 64,
        });
      }

      await user.send({
        content: message,
      });

      return interaction.reply({
        content: `✅ Message envoyé à **${user.tag}** (\`${user.id}\`).`,
        flags: 64,
      });
    } catch (error) {
      console.error("[pm modal] erreur envoi DM :", error);

      return interaction.reply({
        content: "❌ Impossible d'envoyer le message privé à cet utilisateur.",
        flags: 64,
      });
    }
  },
};