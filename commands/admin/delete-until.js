const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("delete-until")
    .setDescription("Supprime les messages jusqu'à un message spécifique")
    .addStringOption(option =>
      option
        .setName("messageid")
        .setDescription("ID du message cible")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {

    await interaction.deferReply({ ephemeral: true });

    const targetId = interaction.options.getString("messageid");
    const channel = interaction.channel;

    let totalDeleted = 0;
    let done = false;

    while (!done) {

      const messages = await channel.messages.fetch({
        limit: 100
      });

      if (!messages.size) break;

      const toDelete = [];

      for (const msg of messages.values()) {

        if (msg.id === targetId) {
          toDelete.push(msg);
          done = true;
          break;
        }

        toDelete.push(msg);
      }

      if (!toDelete.length) break;

      const filtered = toDelete.filter(m => {
        const age = Date.now() - m.createdTimestamp;
        return age < 1209600000; // 14 jours
      });

      if (filtered.length) {
        const deleted = await channel.bulkDelete(filtered, true);
        totalDeleted += deleted.size;
      }

      if (messages.has(targetId)) {
        done = true;
      }

      if (messages.size < 100) break;
    }

    return interaction.editReply({
      content: `🧹 **${totalDeleted} messages supprimés jusqu'au message cible.**`
    });

  }
};