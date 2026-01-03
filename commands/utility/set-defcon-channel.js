// commands/utility/set-defcon-channel.js
const { SlashCommandBuilder, ChannelType } = require("discord.js");
const defconDb = require("../../services/defcon.db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("set-defcon-channel")
    .setDescription("Configure le salon global d'envoi DEFCON")
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("Salon où envoyer les messages DEFCON")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true)
    )
    .addRoleOption((opt) =>
      opt
        .setName("ping_role")
        .setDescription("Rôle à mentionner quand un DEFCON est envoyé (optionnel)")
        .setRequired(false)
    ),
  async execute(interaction) {
    const ch = interaction.options.getChannel("channel", true);
    const role = interaction.options.getRole("ping_role", false);

    await defconDb.setDefconChannelConfig({ channelId: ch.id, pingRoleId: role?.id || null });
    // Nouveau salon => on oublie l'ancien message "pinned" DEFCON
    await defconDb.setLastDefconMessageId(null);
return interaction.reply({
      content: `✅ Salon DEFCON configuré sur ${ch}.${role ? `
🔔 Rôle mentionné: ${role}` : ""}`,
      ephemeral: true,
    });
  },
};
