const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { getType, updateType } = require("../../services/tickets.db");
const { setTypeCreateDraft } = require("../../src/utils/ticketDrafts");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket-type-edit")
    .setDescription("Modifier un type de ticket")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((o) => o.setName("id").setDescription("ID du type").setRequired(true))
    .addStringOption((o) =>
      o
        .setName("field")
        .setDescription("Champ à modifier")
        .setRequired(true)
        .addChoices(
          { name: "label", value: "label" },
          { name: "emoji", value: "emoji" },
          { name: "namemodalrename", value: "namemodalrename" },
          { name: "categoryopened", value: "category_opened_id" },
          { name: "staffroles", value: "staff_role_ids_json" },
          { name: "customembed", value: "customembed" }
        )
    )
    .addStringOption((o) => o.setName("value").setDescription("Valeur (selon le champ)").setRequired(false))
    .addChannelOption((o) =>
      o
        .setName("category")
        .setDescription("Catégorie (si field=categoryopened)")
        .addChannelTypes(4)
        .setRequired(false)
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const id = interaction.options.getString("id", true);
    const field = interaction.options.getString("field", true);

    const current = await getType(guildId, id);
    if (!current) return interaction.reply({ content: "❌ Type introuvable.", ephemeral: true });

    if (field === "customembed") {
      // Modal pour (dés)activer + contenu
      setTypeCreateDraft(guildId, interaction.user.id, {
        id,
        label: current.label,
        emoji: current.emoji,
        nameModalRename: Boolean(current.namemodalrename),
        categoryOpenedId: current.category_opened_id || null,
        staffRoleIds: current.staff_role_ids || [],
        customEmbedEnabled: true,
        editMode: true,
      });
      const modal = require("../../modals/ticketTypeCustomEmbed.modal");
      return interaction.showModal(modal.build({
        title: current.custom_embed_title || "",
        description: current.custom_embed_description || "",
        enabled: Boolean(current.custom_embed_enabled),
      }));
    }

    if (field === "category_opened_id") {
      const cat = interaction.options.getChannel("category", false);
      await updateType(guildId, id, { category_opened_id: cat?.id || null });
      return interaction.reply({ content: "✅ Catégorie mise à jour.", ephemeral: true });
    }

    const value = interaction.options.getString("value", false);

    if (field === "namemodalrename") {
      const b = String(value || "").toLowerCase();
      const yes = ["1", "true", "yes", "oui", "on"].includes(b);
      await updateType(guildId, id, { namemodalrename: yes ? 1 : 0 });
      return interaction.reply({ content: `✅ namemodalrename = ${yes ? "yes" : "no"}.`, ephemeral: true });
    }

    if (field === "staff_role_ids_json") {
      // value: "roleId,roleId,roleId"
      const ids = String(value || "")
        .split(/[ ,;\n]+/g)
        .map((s) => s.trim())
        .filter(Boolean);
      if (!ids.length) return interaction.reply({ content: "❌ Donne au moins 1 ID de rôle (séparés par virgules).", ephemeral: true });
      await updateType(guildId, id, { staff_role_ids_json: JSON.stringify(ids) });
      return interaction.reply({ content: "✅ Rôles staff mis à jour.", ephemeral: true });
    }

    if (field === "label") {
      if (!value) return interaction.reply({ content: "❌ value manquante.", ephemeral: true });
      await updateType(guildId, id, { label: value });
      return interaction.reply({ content: "✅ Label mis à jour.", ephemeral: true });
    }

    if (field === "emoji") {
      await updateType(guildId, id, { emoji: value || null });
      return interaction.reply({ content: "✅ Emoji mis à jour.", ephemeral: true });
    }

    return interaction.reply({ content: "❌ Champ non géré.", ephemeral: true });
  },
};
