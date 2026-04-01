const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require("discord.js");
const { query } = require("../../services/db");
const { ensureTables } = require("../../services/tickets.db");

function guildDisplayName(interaction, guildId) {
  const g = interaction.client.guilds.cache.get(String(guildId));
  return g?.name || `Serveur inconnu (${guildId})`;
}

function buildSectionLines(guildName, items) {
  const lines = [`🖥️ **${guildName}**`];
  for (const t of items) {
    const emoji = t.emoji ? `${t.emoji} ` : "";
    lines.push(`- ${emoji}${t.label} (\`${t.id}\`)`);
  }
  lines.push("");
  return lines;
}

function buildEmbedsFromLines(title, lines, color = 0x2b2d31) {
  const embeds = [];
  let buf = "";

  for (const line of lines) {
    const add = (buf ? "\n" : "") + line;
    // 4096 = limite description embed
    if ((buf + add).length > 4000) {
      embeds.push(
        new EmbedBuilder().setTitle(title).setDescription(buf).setColor(color)
      );
      buf = line;
    } else {
      buf += add;
    }
  }

  if (buf.trim().length) {
    embeds.push(new EmbedBuilder().setTitle(title).setDescription(buf).setColor(color));
  }

  return embeds;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("types-list")
    .setDescription("Lister les types de tickets")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  async execute(interaction) {
    await ensureTables();

    const rows = await query(
      "SELECT guild_id, id, label, emoji FROM doj_ticket_types ORDER BY guild_id ASC, label ASC"
    );

    if (!rows || rows.length === 0) {
      return interaction.reply({ content: "❌ Aucun type de ticket trouvé.", flags: 64 });
    }

    const grouped = new Map();
    for (const r of rows) {
      const gid = String(r.guild_id);
      if (!grouped.has(gid)) grouped.set(gid, []);
      grouped.get(gid).push(r);
    }

    const lines = [];
    for (const [gid, items] of grouped.entries()) {
      lines.push(...buildSectionLines(guildDisplayName(interaction, gid), items));
    }

    const embeds = buildEmbedsFromLines("📋 Types de tickets", lines);
    return interaction.reply({ embeds, flags: 64 });
  },
};
