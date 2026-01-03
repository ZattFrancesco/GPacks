const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { buildPaginationComponents } = require("../../utils/pagination");
const { listReportsWeek, countReportsWeek } = require("../../services/rapportJugement.db");

const PAGE_SIZE = 6; // 4 lignes par jugement => 6/jour safe. Monte à 8 si tes obs sont courtes.

function cut(str, max = 160) {
  if (!str) return "—";
  const s = String(str).replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function toDiscordDate(unixSeconds) {
  if (!unixSeconds) return null;
  const n = Number(unixSeconds);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `<t:${Math.floor(n)}:f>`;
}

function maybeMentionOrText(value) {
  if (!value) return null;
  const s = String(value).trim();
  // si déjà une mention discord du genre <@123> ou <@!123>, on garde
  if (/^<@!?\d{16,20}>$/.test(s)) return s;
  return s;
}

function formatJugement4Lignes(r) {
  const date =
    toDiscordDate(r.date_jugement_unix) ||
    toDiscordDate(Math.floor(new Date(r.created_at).getTime() / 1000)) ||
    "—";

  // JUGE : si judge_user_id est présent => mention, sinon judge_name
  const juge = r.judge_user_id ? `<@${r.judge_user_id}>` : (r.judge_name || "—");

  const proc = maybeMentionOrText(r.procureur);
  const avocat = maybeMentionOrText(r.avocat);

  const rolesLine = [ `👨‍⚖️ ${juge}`, proc ? `🧑‍⚖️ ${proc}` : null, avocat ? `🛡️ ${avocat}` : null ]
    .filter(Boolean)
    .join(" • ");

  const tigTxt = r.tig ? "Oui" : "Non";
  const ent = r.tig_entreprise || "—";

  return [
    `⚖️ **Jugement #${r.id}** — ${date}`,
    rolesLine,
    `⚙️ Peine: ${r.peine || "—"} • 💸 Amende: ${r.amende || "—"} • TIG: ${tigTxt} • 🏢 Entreprise: ${ent}`,
    `📝 ${cut(r.observation, 170)}`,
  ].join("\n");
}

function buildEmbed({ reports, page, maxPage, total }) {
  const embed = new EmbedBuilder()
    .setTitle("📄 Rapports de jugement — Semaine")
    .setColor(0x2b2d31)
    .setFooter({ text: `Page ${page} / ${maxPage} — Total: ${total}` });

  let desc = "";
  for (const r of reports) {
    const block = formatJugement4Lignes(r);
    const candidate = desc ? `${desc}\n\n${block}` : block;

    // marge safe pour éviter de dépasser les limites embed
    if (candidate.length > 3800) break;
    desc = candidate;
  }

  embed.setDescription(desc || "—");
  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rapport-semaine")
    .setDescription("Afficher les rapports de jugement de la semaine (condensé + pagination)"),

  async execute(interaction) {
    if (!interaction.guildId) {
      return interaction.reply({ content: "❌ Utilisable uniquement dans un serveur.", ephemeral: true });
    }

    const guildId = interaction.guildId;
    const page = 1;

    const total = await countReportsWeek(guildId);
    if (!total) {
      return interaction.reply({ content: "❌ Aucun rapport de jugement cette semaine.", ephemeral: true });
    }

    const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const offset = (page - 1) * PAGE_SIZE;

    const reports = await listReportsWeek(guildId, offset, PAGE_SIZE);

    const embed = buildEmbed({ reports, page, maxPage, total });

    const msg = await interaction.reply({ embeds: [embed], fetchReply: true });

    await interaction.editReply({
      components: buildPaginationComponents({ page, maxPage, messageId: msg.id }),
    });
  },
};