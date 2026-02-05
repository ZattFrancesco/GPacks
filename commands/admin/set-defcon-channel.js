// commands/utility/set-defcon-channel.js
const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require("discord.js");
const defconDb = require("../../services/defcon.db");
const { auditLog } = require("../../src/utils/auditLog");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("set-defcon-channel")
    .setDescription("Configure le salon DEFCON pour CE serveur")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("Salon où envoyer les messages DEFCON (sur ce serveur)")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true)
    )
    .addRoleOption((opt) =>
      opt
        .setName("ping_role")
        .setDescription("Rôle à mentionner à chaque DEFCON (optionnel)")
        .setRequired(false)
    ),
  async execute(interaction) {
    // sécurité en plus (au cas où)
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: "❌ Admin uniquement.", ephemeral: true });
    }

    const ch = interaction.options.getChannel("channel", true);
    const role = interaction.options.getRole("ping_role", false);

    await defconDb.setDefconChannelConfig({
      guildId: interaction.guildId,
      channelId: ch.id,
      pingRoleId: role?.id || null,
    });


    await auditLog(interaction.client, interaction.guildId, {
      module: "DEFCON",
      action: "CONFIG_CHANNEL",
      level: "INFO",
      userId: interaction.user.id,
      sourceChannelId: interaction.channelId,
      message: "Configuration du salon DEFCON mise à jour.",
      meta: { channelId: ch.id, pingRoleId: role ? role.id : null },
    });

    return interaction.reply({
      content:
        `✅ Salon DEFCON configuré sur ${ch}.` +
        (role ? `\n🔔 Rôle mentionné: ${role}` : ""),
      ephemeral: true,
    });
  },
};
