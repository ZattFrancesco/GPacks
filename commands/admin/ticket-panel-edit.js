const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { getPanel, updatePanel, listTypes } = require("../../services/tickets.db");
const { buildPanelEmbed, buildPanelComponents } = require("../../src/utils/ticketViews");

function parseTypeList(raw) {
  return String(raw || "")
    .split(/[ ,;\n]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket-panel-edit")
    .setDescription("Modifier un panel de tickets")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((o) => o.setName("id").setDescription("ID du panel").setRequired(true))
    .addStringOption((o) =>
      o
        .setName("field")
        .setDescription("Champ")
        .setRequired(true)
        .addChoices(
          { name: "title", value: "title" },
          { name: "description", value: "description" },
          { name: "types", value: "types" },
          { name: "style", value: "style" },
          { name: "color", value: "color" },
          { name: "required_role", value: "required_role_id" },
          { name: "logo_url", value: "logo_url" },
          { name: "banner_url", value: "banner_url" }
        )
    )
    .addStringOption((o) => o.setName("value").setDescription("Valeur (texte)").setRequired(false))
    .addIntegerOption((o) => o.setName("color").setDescription("Couleur (si field=color)").setRequired(false))
    .addRoleOption((o) => o.setName("role").setDescription("Rôle (si field=required_role)").setRequired(false)),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const panelId = interaction.options.getString("id", true);
    const field = interaction.options.getString("field", true);
    const panel = await getPanel(guildId, panelId);
    if (!panel) return interaction.reply({ content: "❌ Panel introuvable.", ephemeral: true });

    const patch = {};

    if (field === "color") {
      const c = interaction.options.getInteger("color", false);
      patch.color = c ?? null;
    } else if (field === "required_role_id") {
      const r = interaction.options.getRole("role", false);
      patch.required_role_id = r?.id || null;
    } else if (field === "types") {
      const raw = interaction.options.getString("value", true);
      const requested = parseTypeList(raw);
      const allTypes = await listTypes(guildId);
      const allowed = new Set(allTypes.map((t) => t.id));
      const typeIds = requested.filter((t) => allowed.has(t));
      if (!typeIds.length) {
        return interaction.reply({ content: "❌ Aucun type valide.", ephemeral: true });
      }
      patch.type_ids_json = JSON.stringify(typeIds);
    } else {
      const value = interaction.options.getString("value", false);
      if (field === "title") patch.title = value || panel.title;
      if (field === "description") patch.description = value || panel.description;
      if (field === "style") patch.style = (value || panel.style || "menu").toLowerCase();
      if (field === "logo_url") patch.logo_url = value || null;
      if (field === "banner_url") patch.banner_url = value || null;
    }

    await updatePanel(guildId, panelId, patch);

    // Refresh le message du panel si possible
    try {
      const channel = await interaction.client.channels.fetch(panel.channel_id);
      const msg = await channel?.messages.fetch(panel.message_id);
      if (msg) {
        const newPanel = { ...panel, ...patch };
        const allTypes = await listTypes(guildId);
        const typeIds = JSON.parse(newPanel.type_ids_json || "[]");
        const types = allTypes.filter((t) => typeIds.includes(t.id));
        await msg.edit({
          embeds: [buildPanelEmbed(newPanel)],
          components: buildPanelComponents({ panel: newPanel, types }),
        });
      }
    } catch {}

    return interaction.reply({ content: "✅ Panel mis à jour.", ephemeral: true });
  },
};
