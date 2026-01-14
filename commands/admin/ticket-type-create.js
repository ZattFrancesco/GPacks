const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createType } = require("../../services/tickets.db");
const { setTypeCreateDraft } = require("../../src/utils/ticketDrafts");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket-type-create")
    .setDescription("Créer / mettre à jour un type de ticket")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    // ✅ REQUIRED D'ABORD (obligatoires en premier)
    .addStringOption((o) => o.setName("id").setDescription("ID unique (ex: plainte)").setRequired(true))
    .addStringOption((o) => o.setName("label").setDescription("Label visible").setRequired(true))
    .addChannelOption((o) =>
      o
        .setName("categoryopened")
        .setDescription("Catégorie où créer les tickets")
        .addChannelTypes(4) // GuildCategory
        .setRequired(true)
    )
    .addRoleOption((o) => o.setName("staffrole1").setDescription("Rôle staff 1").setRequired(true))

    // ✅ ENSUITE les optionnels
    .addStringOption((o) => o.setName("emoji").setDescription("Emoji (optionnel)").setRequired(false))
    .addBooleanOption((o) =>
      o.setName("namemodalrename").setDescription("Demander Nom/Prénom + changer pseudo").setRequired(false)
    )
    .addRoleOption((o) => o.setName("staffrole2").setDescription("Rôle staff 2").setRequired(false))
    .addRoleOption((o) => o.setName("staffrole3").setDescription("Rôle staff 3").setRequired(false))
    .addRoleOption((o) => o.setName("staffrole4").setDescription("Rôle staff 4").setRequired(false))
    .addRoleOption((o) => o.setName("staffrole5").setDescription("Rôle staff 5").setRequired(false))
    .addBooleanOption((o) => o.setName("customembed").setDescription("Activer l'embed custom (modal)").setRequired(false)),

  async execute(interaction) {
    const guildId = interaction.guildId;

    const id = interaction.options.getString("id", true);
    const label = interaction.options.getString("label", true);
    const category = interaction.options.getChannel("categoryopened", true);

    const emoji = interaction.options.getString("emoji", false) || null;
    const nameModalRename = interaction.options.getBoolean("namemodalrename") || false;
    const customEmbed = interaction.options.getBoolean("customembed") || false;

    const staffRoleIds = [];
    for (let i = 1; i <= 5; i++) {
      const r = interaction.options.getRole(`staffrole${i}`, false);
      if (r) staffRoleIds.push(r.id);
    }

    // staffrole1 est required, donc on l’a forcément, mais on garde la sécurité
    if (!staffRoleIds.length) {
      return interaction.reply({ content: "❌ Tu dois mettre au moins 1 rôle staff.", ephemeral: true });
    }

    // Si custom embed : on enchaîne sur un modal
    if (customEmbed) {
      setTypeCreateDraft(guildId, interaction.user.id, {
        id,
        label,
        emoji,
        nameModalRename,
        categoryOpenedId: category.id,
        staffRoleIds,
        customEmbedEnabled: true,
      });

      const modal = require("../../modals/ticketTypeCustomEmbed.modal");
      return interaction.showModal(modal.build());
    }

    const finalId = await createType(guildId, {
      id,
      label,
      emoji,
      nameModalRename,
      categoryOpenedId: category.id,
      staffRoleIds,
      customEmbedEnabled: false,
    });

    return interaction.reply({
      content: `✅ Type **${finalId}** enregistré.`,
      ephemeral: true,
    });
  },
};