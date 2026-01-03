const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { buildPaginationComponents } = require("../../utils/pagination");
const { listReportsAll, countReportsAll } = require("../../services/rapportJugement.db");

const PAGE_SIZE = 8; // ajuste si tu veux + ou -

function cut(str, max = 140) {
  if (!str) return "—";
  const s = String(str).replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function mention(id) {
  return id ? `<@${id}>` : null;
}

function toUnixSeconds(dateValue) {
  if (!dateValue) return null;

  if (typeof dateValue === "number") {
    return dateValue > 10_000_000_000 ? Math.floor(dateValue / 1000) : dateValue;
  }

  const d = new Date(dateValue);
  if (!isNaN(d.getTime())) return Math.floor(d.getTime() / 1000);

  return null;
}

function formatJugementCompact(r) {
  const id = r.id ?? "—";

  const ts = toUnixSeconds(r.date_jugement || r.dateJugement || r.created_at || r.createdAt);
  const dateTxt = ts ? `<t:${ts}:f>` : (r.date_jugement || r.dateJugement || "—");

  const juge = mention(r.juge_user_id || r.judge_user_id || r.jugeUserId);
  const proc = mention(r.procureur_user_id || r.proc_user_id || r.procUserId);
  const avocat = mention(r.avocat_user_id || r.avocatUserId);

  const rolesLine = [
    juge ? `👨‍⚖️ ${juge}` : null,
    proc ? `🧑‍⚖️ ${proc}` : null,
    avocat ? `🛡️ ${avocat}` : null,
  ].filter(Boolean).join(" • ") || "👨‍⚖️ — • 🧑‍⚖️ —";

  const peine = r.peine ?? "—";
  const amende = r.amende ?? "—";

  const tigVal = r.tig ?? r.t_i_g ?? r.tig_flag;
  const tig = (tigVal === true || tigVal === 1 || tigVal === "Oui") ? "Oui" : "Non";

  const entreprise = r.entreprise_tig || r.entrepriseTig || r.entreprise || "—";

  const observation = cut(r.observation || r.obs || r.note || r.commentaire, 160);

  return [
    `⚖️ Jugement #${id} — ${dateTxt}`,
    rolesLine,
    `⚙️ Peine: ${peine} • 💸 Amende: ${amende} • TIG: ${tig} • 🏢 Ent: ${entreprise}`,
    `📝 ${observation}`,
  ].join("\n");
}

function buildEmbedCondense({ reports, page, maxPage, total }) {
  const embed = new EmbedBuilder()
    .setTitle("📚 Rapports de Jugement — Tous")
    .setColor(0x2b2d31)
    .setFooter({ text: `Page ${page} / ${maxPage} — Total: ${total}` });

  const blocks = reports.map(formatJugementCompact);

  let description = "";
  for (const b of blocks) {
    const candidate = description ? `${description}\n\n${b}` : b;
    if (candidate.length > 3800) break;
    description = candidate;
  }

  embed.setDescription(description || "—");
  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rapport-alltime")
    .setDescription("Afficher tous les rapports de jugement (condensé, paginé)"),

  async execute(interaction) {
    if (!interaction.guildId) {
      return interaction.reply({
        content: "❌ Cette commande doit être utilisée dans un serveur.",
        ephemeral: true,
      });
    }

    const guildId = interaction.guildId;
    const page = 1;

    const total = await countReportsAll(guildId);
    if (!total) {
      return interaction.reply({
        content: "❌ Aucun rapport de jugement enregistré.",
        ephemeral: true,
      });
    }

    const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const offset = (page - 1) * PAGE_SIZE;

    const reports = await listReportsAll(guildId, offset, PAGE_SIZE);

    const embed = buildEmbedCondense({ reports, page, maxPage, total });

    const msg = await interaction.reply({
      embeds: [embed],
      fetchReply: true,
    });

    await interaction.editReply({
      components: buildPaginationComponents({ page, maxPage, messageId: msg.id }),
    });
  },
};