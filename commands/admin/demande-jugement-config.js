const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  RoleSelectMenuBuilder,
} = require("discord.js");

const db = require("../../services/jugement.db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("demande-jugement-config")
    .setDescription("Configurer les rôles à ping pour les demandes de jugement")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const roleIds = await db.getPingRoleIds(guildId);

    const current = roleIds.length
      ? roleIds.map((id) => `<@&${id}>`).join(" ")
      : "Aucun";

    const menu = new RoleSelectMenuBuilder()
      .setCustomId("doj:config:roles")
      .setPlaceholder("Sélectionne les rôles à ping…")
      .setMinValues(0)
      .setMaxValues(10);

    const row = new ActionRowBuilder().addComponents(menu);

    return interaction.reply({
      content:
        `Rôles actuellement configurés : ${current}\n\n` +
        `➡️ Sélectionne les rôles dans le menu ci-dessous (0 = vider la liste).`,
      components: [row],
      ephemeral: true,
    });
  },
};
