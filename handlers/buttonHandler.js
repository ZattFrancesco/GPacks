// handlers/buttonHandler.js
const { EmbedBuilder } = require("discord.js");
const { buildPaginationComponents } = require("../utils/pagination");
const {
  listReportsWeek,
  listReportsAll,
  countReportsWeek,
  countReportsAll,
} = require("../services/rapportJugement.db");

const PAGE_SIZE = 10;

/**
 * Handler boutons (GENERIC)
 * - support exact customId (client.buttons)
 * - support idPrefix (client.buttonsPrefix)
 * - fallback legacy pagination "rapport_prev/rapport_next"
 */
module.exports = async (client, interaction) => {
  try {
    if (!interaction?.isButton?.()) return;

    // 1) Exact match
    let btn = client.buttons?.get(interaction.customId);

    // 2) Prefix match
    if (!btn && Array.isArray(client.buttonsPrefix)) {
      btn = client.buttonsPrefix.find((b) =>
        interaction.customId.startsWith(b.idPrefix)
      );
    }

    // ✅ Si on a trouvé un module bouton, on l’exécute
    if (btn) {
      return btn.execute(interaction, client);
    }

    // 3) Fallback legacy pagination (rapport_prev / rapport_next)
    if (
      interaction.customId.startsWith("rapport_prev:") ||
      interaction.customId.startsWith("rapport_next:")
    ) {
      return handleLegacyRapportPagination(interaction);
    }

    // Sinon on ignore (bouton inconnu)
    return;
  } catch (err) {
    console.error("[buttonHandler]", err);
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({
          content: "❌ Une erreur est survenue avec ce bouton.",
          ephemeral: true,
        });
      }
    } catch {}
  }
};

async function handleLegacyRapportPagination(interaction) {
  // boutons: rapport_prev:<messageId> ou rapport_next:<messageId>
  const [action, messageId] = interaction.customId.split(":");

  if (!messageId || interaction.message.id !== messageId) {
    return interaction.reply({
      content: "❌ Bouton expiré ou invalide.",
      ephemeral: true,
    });
  }

  if (!interaction.guildId) {
    return interaction.reply({
      content: "❌ Cette action doit être utilisée dans un serveur.",
      ephemeral: true,
    });
  }

  const guildId = interaction.guildId;

  const footer = interaction.message.embeds[0]?.footer?.text || "";
  let page = Number(footer.match(/Page (\d+)/)?.[1]) || 1;

  if (action === "rapport_prev") page--;
  if (action === "rapport_next") page++;

  const isWeek = interaction.message.embeds[0]?.title?.includes("Semaine");

  const total = isWeek
    ? await countReportsWeek(guildId)
    : await countReportsAll(guildId);

  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  page = Math.min(Math.max(page, 1), maxPage);

  const offset = (page - 1) * PAGE_SIZE;

  const reports = isWeek
    ? await listReportsWeek(guildId, offset, PAGE_SIZE)
    : await listReportsAll(guildId, offset, PAGE_SIZE);

  const embed = new EmbedBuilder()
    .setTitle(isWeek ? "📄 Rapports – Semaine" : "📚 Rapports – Tous")
    .setColor(0x2b2d31)
    .setFooter({ text: `Page ${page} / ${maxPage}` });

  for (const r of reports) {
    embed.addFields({
      name: `Rapport #${r.id}`,
      value: (r.observation || "—").slice(0, 700),
    });
  }

  await interaction.update({
    embeds: [embed],
    components: buildPaginationComponents({
      page,
      maxPage,
      messageId,
    }),
  });
}