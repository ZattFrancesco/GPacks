// buttons/dojButtons.js
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const db = require("../services/jugement.db");
const { getDraft, updateDraft, clearDraft } = require("../src/utils/dojDrafts");
const { buildJugementEmbed } = require("../src/utils/jugementEmbed");

function wizardComponents(userId) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`doj:uploadCasier:${userId}`)
      .setLabel("📎 Upload casier")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`doj:uploadIndividu:${userId}`)
      .setLabel("📎 Upload individu")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`doj:nbCasiers:${userId}`)
      .setLabel("✏️ Nombre de casiers")
      .setStyle(ButtonStyle.Primary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`doj:send:${userId}`)
      .setLabel("✅ Valider et envoyer")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`doj:cancel:${userId}`)
      .setLabel("❌ Annuler")
      .setStyle(ButtonStyle.Danger),
  );

  return [row1, row2];
}

async function waitForAttachment(channel, userId, ms = 60_000) {
  return new Promise((resolve) => {
    const collector = channel.createMessageCollector({
      time: ms,
      filter: (m) => m.author?.id === userId,
    });

    collector.on("collect", (m) => {
      if (m.attachments && m.attachments.size > 0) {
        collector.stop("got_attachment");
        resolve(m);
      }
    });

    collector.on("end", (_collected, reason) => {
      if (reason !== "got_attachment") resolve(null);
    });
  });
}

async function tryDeleteMessage(message) {
  try {
    await message.delete();
  } catch {
    // ignore
  }
}

/**
 * ✅ Reposte les fichiers envoyés par l'agent via le bot
 * pour obtenir des URLs CDN stables (cdn.discordapp.com)
 */
async function repostAttachmentsForCdn(channel, message, label) {
  const files = [...message.attachments.values()].map((a) => ({
    attachment: a.url,
    name: a.name || "image",
  }));

  if (!files.length) return [];

  // On reposte dans le salon, et on récupère les URLs CDN générées.
  const sent = await channel.send({
    content: label || undefined,
    files,
  });

  return [...sent.attachments.values()].map((a) => a.url);
}

function onlyHttpUrls(arr) {
  return (arr || []).filter((u) => typeof u === "string" && /^https?:\/\/\S+$/i.test(u));
}

module.exports = {
  idPrefix: "doj:",

  async execute(interaction) {
    const [prefix, action, ownerId] = interaction.customId.split(":");
    if (prefix !== "doj") return;

    if (ownerId && interaction.user.id !== ownerId) {
      return interaction.reply({ content: "❌ Ce panneau ne t'appartient pas.", ephemeral: true });
    }

    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const channel = interaction.channel;

    if (!channel) {
      return interaction.reply({ content: "❌ Salon introuvable.", ephemeral: true });
    }

    if (action === "cancel") {
      clearDraft(guildId, userId);
      return interaction.update({ content: "✅ Demande annulée.", embeds: [], components: [] });
    }

    const draft = getDraft(guildId, userId);
    if (!draft) {
      return interaction.reply({
        content: "⏱️ Ton dossier a expiré (15 min). Relance `/demande-jugement`.",
        ephemeral: true,
      });
    }

    if (action === "nbCasiers") {
      const modal = new ModalBuilder()
        .setCustomId(`doj:nbcasiers:${userId}`)
        .setTitle("Nombre de casiers");

      const nb = new TextInputBuilder()
        .setCustomId("nbCasiers")
        .setLabel("Nombre de casier judiciaire")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(10)
        .setValue(String(draft.nbCasiers ?? "").slice(0, 10));

      modal.addComponents(new ActionRowBuilder().addComponents(nb));
      return interaction.showModal(modal);
    }

    if (action === "uploadCasier" || action === "uploadIndividu") {
      const isCasier = action === "uploadCasier";
      const what = isCasier ? "casier" : "individu";

      await interaction.reply({
        ephemeral: true,
        content:
          `📎 Envoie maintenant un **message dans ce salon** avec la/les **image(s)** du **${what}**.\n` +
          `Tu as 60 secondes.`,
      });

      const msg = await waitForAttachment(channel, userId, 60_000);
      if (!msg) {
        return interaction.followUp({
          ephemeral: true,
          content: "⏱️ Rien reçu. Réessaie en cliquant sur le bouton.",
        });
      }

      // On supprime le message de l'agent (si possible) pour garder le salon clean
      await tryDeleteMessage(msg);

      // ✅ Le bot reposte les images => URLs CDN garanties
      const cdnUrls = await repostAttachmentsForCdn(
        channel,
        msg,
        isCasier ? "Photo casier judiciaire:" : "Photo individu:"
      );

      const safeUrls = onlyHttpUrls(cdnUrls);

      const next = isCasier
        ? updateDraft(guildId, userId, {
            photoCasierUrls: [...(draft.photoCasierUrls || []), ...safeUrls],
          })
        : updateDraft(guildId, userId, {
            photoIndividuUrls: [...(draft.photoIndividuUrls || []), ...safeUrls],
          });

      return interaction.followUp({
        ephemeral: true,
        content: `✅ ${what} enregistré (${safeUrls.length} image(s)).`,
        embeds: [buildJugementEmbed(next)],
        components: wizardComponents(userId),
      });
    }

    if (action === "send") {
      const pingRoleIds = await db.getPingRoleIds(guildId);

      const pingLine = pingRoleIds.length
        ? `|| ${pingRoleIds.map((id) => `<@&${id}>`).join(" ")} ||`
        : null;

      // 1) Message principal : ping + embed
      await channel.send({
        content: pingLine || undefined,
        embeds: [buildJugementEmbed(draft)],
      });

      // 2) Message URLs brutes seules (preview fiable)
      const casierUrls = onlyHttpUrls(draft.photoCasierUrls);
      const individuUrls = onlyHttpUrls(draft.photoIndividuUrls);

      const blocks = [];

      if (casierUrls.length) {
        blocks.push("Photo casier judiciaire:");
        blocks.push(casierUrls.join("\n")); // URL seules
      }
      if (individuUrls.length) {
        if (blocks.length) blocks.push("");
        blocks.push("Photo individu:");
        blocks.push(individuUrls.join("\n"));
      }

      const photosContent = blocks.join("\n").trim();
      if (photosContent) {
        await channel.send({ content: photosContent });
      }

      clearDraft(guildId, userId);
      return interaction.update({ content: "✅ Dossier envoyé.", embeds: [], components: [] });
    }
  },
};

module.exports.wizardComponents = wizardComponents;