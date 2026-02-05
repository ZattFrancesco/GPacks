const { ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { getPanel } = require("../services/tickets.db");

function buildFieldMenu(panelId) {
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
  idPrefix: "ticketpanel:edit:",
  async execute(interaction) {
    const guildId = interaction.guildId;
    const cid = interaction.customId;

    // back button
    if (cid.startsWith("ticketpanel:edit:back:")) {
      const panelId = cid.split(":")[3];
      const panel = await getPanel(guildId, panelId);
      if (!panel) return interaction.reply({ content: "❌ Panel introuvable.", flags: 64 });

      return interaction.update({
        content: "Choisis un champ à modifier.",
        embeds: [],
        components: [buildFieldMenu(panelId)],
      });
    }

    // clear required role
    if (cid.startsWith("ticketpanel:edit:clearrole:")) {
      const panelId = cid.split(":")[3];
      const { updatePanel } = require("../services/tickets.db");
      const { buildPanelEmbed, buildPanelComponents } = require("../src/utils/ticketViews");
      const { listTypes } = require("../services/tickets.db");

      await updatePanel(guildId, panelId, { required_role_id: null });

      // refresh panel message best effort
      try {
        const panel = await getPanel(guildId, panelId);
        const ch = await interaction.guild.channels.fetch(panel.channel_id);
        const msg = await ch.messages.fetch(panel.message_id).catch(() => null);
        if (msg) {
          const allTypes = await listTypes(guildId);
          const typeIds = JSON.parse(panel.type_ids_json || "[]");
          const types = allTypes.filter((t) => typeIds.includes(t.id));

          await msg.edit({
            embeds: [buildPanelEmbed(panel)],
            components: buildPanelComponents({ panel, types }),
          });
        }
      } catch {}

      return interaction.update({
        content: "✅ Rôle requis retiré.",
        embeds: [],
        components: [buildFieldMenu(panelId)],
      });
    }
  },
};
