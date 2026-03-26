const { listPanels, listTypes } = require("../../services/tickets.db");
const { buildPanelEmbed, buildPanelComponents } = require("./ticketViews");

async function refreshPanelsUsingType(guild, typeId) {
  if (!guild || !typeId) return;

  const guildId = guild.id;
  const allPanels = await listPanels(guildId);
  const affectedPanels = allPanels.filter((panel) =>
    Array.isArray(panel.type_ids) && panel.type_ids.map(String).includes(String(typeId))
  );

  if (!affectedPanels.length) return;

  const allTypes = await listTypes(guildId);

  for (const panel of affectedPanels) {
    try {
      if (!panel.channel_id || !panel.message_id) continue;

      const channel = await guild.channels.fetch(panel.channel_id).catch(() => null);
      if (!channel || typeof channel.messages?.fetch !== "function") continue;

      const message = await channel.messages.fetch(panel.message_id).catch(() => null);
      if (!message) continue;

      const panelTypes = allTypes.filter((type) =>
        Array.isArray(panel.type_ids) && panel.type_ids.map(String).includes(String(type.id))
      );

      await message.edit({
        embeds: [buildPanelEmbed(panel)],
        components: buildPanelComponents({ panel, types: panelTypes }),
      });
    } catch (error) {
      console.error(`[Tickets] Impossible de refresh le panel ${panel.id}:`, error);
    }
  }
}

module.exports = {
  refreshPanelsUsingType,
};
