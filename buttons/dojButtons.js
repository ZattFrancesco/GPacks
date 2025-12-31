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

function extractAttachmentUrls(message) {
  if (!message?.attachments?.size) return [];
  const urls = [...message.attachments.values()]
    .map((a) => a.url)
    .filter((u) => typeof u === "string" && /^https?:\/\/\S+$/i.test(u));
  return urls;
}

function uniq(arr) {
  return [...new Set((arr || []).filter(Boolean))];
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

    // --- Upload Casier / Individu : on stocke les URLs CDN DIRECTES des attachments
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

      const urls = extractAttachmentUrls(msg);

      // On supprime le message de l'agent (si possible) pour garder le salon clean
      await tryDeleteMessage(msg);

      const next = isCasier
        ? updateDraft(guildId, userId, {
            photoCasierUrls: uniq([...(draft.photoCasierUrls || []), ...urls]),
          })
        : updateDraft(guildId, userId, {
            photoIndividuUrls: uniq([...(draft.photoIndividuUrls || []), ...urls]),
          });

      return interaction.followUp({
        ephemeral: true,
        content: `✅ ${what} enregistré (${urls.length} image(s)).`,
        embeds: [buildJugementEmbed(next)],
        components: wizardComponents(userId),
      });
    }

    // --- Envoi final : 1 message embed + 1 message avec URL BRUTES SEULES
    if (action === "send") {
      const pingRoleIds = await db.getPingRoleIds(guildId);

      const pingLine = pingRoleIds.length
        ? `|| ${pingRoleIds.map((id) => `<@&${id}>`).join(" ")} ||`
        : null;

      // 1) dossier
      await channel.send({
        content: pingLine || undefined,
        embeds: [buildJugementEmbed(draft)],
      });

      // 2) photos : on fait 2 messages "URL-only" (zero texte autour) => preview fiable
      const casierUrls = uniq(draft.photoCasierUrls).filter((u) => /^https?:\/\/\S+$/i.test(u));
      const individuUrls = uniq(draft.photoIndividuUrls).filter((u) => /^https?:\/\/\S+$/i.test(u));

      if (casierUrls.length) {
        await channel.send({ content: casierUrls.join("\n") }); // URL seules => preview
      }
      if (individuUrls.length) {
        await channel.send({ content: individuUrls.join("\n") }); // URL seules => preview
      }

      clearDraft(guildId, userId);
      return interaction.update({ content: "✅ Dossier envoyé.", embeds: [], components: [] });
    }
  },
};

module.exports.wizardComponents = wizardComponents;