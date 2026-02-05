const { updatePanel, getPanel, listTypes } = require("../services/tickets.db");
const { buildPanelEmbed, buildPanelComponents } = require("../src/utils/ticketViews");

function parseColor(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;

  // accepte: 16711680 ou #FF0000 ou FF0000
  if (/^\d+$/.test(s)) return Number(s);

  const hex = s.startsWith("#") ? s.slice(1) : s;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return parseInt(hex, 16);
}

async function refreshPanelMessage(interaction, panelId) {
  const guildId = interaction.guildId;
  const panel = await getPanel(guildId, panelId);
  if (!panel) return;

  try {
    const ch = await interaction.guild.channels.fetch(panel.channel_id);
    if (!ch) return;
    if (!panel.message_id) return;

    const msg = await ch.messages.fetch(panel.message_id).catch(() => null);
    if (!msg) return;

    const allTypes = await listTypes(guildId);
    const typeIds = JSON.parse(panel.type_ids_json || "[]");
    const types = allTypes.filter((t) => typeIds.includes(t.id));

    await msg.edit({
      embeds: [buildPanelEmbed(panel)],
      components: buildPanelComponents({ panel, types }),
    });
  } catch {}
}

module.exports = {
  idPrefix: "ticketpanel:edit:text:",
  async execute(interaction) {
    const guildId = interaction.guildId;
    const parts = interaction.customId.split(":");
    // ticketpanel:edit:text:<panelId>:<field>
    const panelId = parts[3];
    const field = parts[4];

    const panel = await getPanel(guildId, panelId);
    if (!panel) return interaction.reply({ content: "❌ Panel introuvable.", flags: 64 });

    const value = interaction.fields.getTextInputValue("value")?.trim() || "";

    const patch = {};
    if (field === "title") patch.title = value || panel.title;
    else if (field === "description") patch.description = value || panel.description;
    else if (field === "logo_url") patch.logo_url = value || null;
    else if (field === "banner_url") patch.banner_url = value || null;
    else if (field === "color") patch.color = parseColor(value);

    await updatePanel(guildId, panelId, patch);
    await refreshPanelMessage(interaction, panelId);

    return interaction.reply({ content: "✅ Panel mis à jour.", flags: 64 });
  },
};
