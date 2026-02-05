const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require("discord.js");
const { getPanel } = require("../../services/tickets.db");

function buildEditMenu(panelId) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`ticketpanel:edit:field:${panelId}`)
      .setPlaceholder("Choisis ce que tu veux modifier…")
      .addOptions(
        { label: "Titre", value: "title", emoji: "📝" },
        { label: "Description", value: "description", emoji: "🧾" },
        { label: "Types autorisés", value: "types", emoji: "🎫" },
        { label: "Style (menu / boutons)", value: "style", emoji: "🧩" },
        { label: "Couleur", value: "color", emoji: "🎨" },
        { label: "Rôle requis", value: "required_role_id", emoji: "🔒" },
        { label: "Logo URL", value: "logo_url", emoji: "🖼️" },
        { label: "Banner URL", value: "banner_url", emoji: "🧱" }
      )
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket-panel-edit")
    .setDescription("Modifier un panel via un menu (select + modal)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((o) => o.setName("id").setDescription("ID du panel").setRequired(true)),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const panelId = interaction.options.getString("id", true);

    const panel = await getPanel(guildId, panelId);
    if (!panel) return interaction.reply({ content: "❌ Panel introuvable.", flags: 64 });

    const embed = new EmbedBuilder()
      .setTitle(`🛠️ Édition du panel: ${panel.id}`)
      .setDescription("Choisis le champ à modifier dans le menu ci-dessous.\n\n*(Le panel Discord sera mis à jour automatiquement.)*")
      .addFields(
        { name: "📍 Salon", value: panel.channel_id ? `<#${panel.channel_id}>` : "—", inline: true },
        { name: "🧩 Style", value: panel.style || "menu", inline: true },
        { name: "🔒 Rôle requis", value: panel.required_role_id ? `<@&${panel.required_role_id}>` : "Aucun", inline: true }
      );

    return interaction.reply({
      flags: 64,
      embeds: [embed],
      components: [buildEditMenu(panel.id)],
    });
  },
};
