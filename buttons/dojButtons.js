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

// --- UI
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

// Attend le prochain message du user dans le channel avec au moins 1 attachment
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
    // si le bot a la perm, ça évite de polluer le salon
    await message.delete();
  } catch {
    // on ignore si pas de perm
  }
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

    // --- Upload casier
    if (action === "uploadCasier") {
      await interaction.reply({
        ephemeral: true,
        content:
          "📎 Envoie maintenant un **message dans ce salon** avec la/les **image(s)** du **casier**.\n" +
          "Tu as 60 secondes. (Tu peux envoyer plusieurs images en une seule fois.)",
      });

      const msg = await waitForAttachment(channel, userId, 60_000);
      if (!msg) {
        return interaction.followUp({ ephemeral: true, content: "⏱️ Rien reçu. Réessaie en cliquant sur le bouton." });
      }

      const urls = [...msg.attachments.values()].map((a) => a.url);
      const next = updateDraft(guildId, userId, {
        photoCasierUrls: [...(draft.photoCasierUrls || []), ...urls],
      });

      await tryDeleteMessage(msg);

      return interaction.followUp({
        ephemeral: true,
        content: `✅ Casier enregistré (${urls.length} image(s)).`,
        embeds: [buildJugementEmbed(next)],
        components: wizardComponents(userId),
      });
    }

    // --- Upload individu
    if (action === "uploadIndividu") {
      await interaction.reply({
        ephemeral: true,
        content:
          "📎 Envoie maintenant un **message dans ce salon** avec l’/les **image(s)** de l’**individu**.\n" +
          "Tu as 60 secondes.",
      });

      const msg = await waitForAttachment(channel, userId, 60_000);
      if (!msg) {
        return interaction.followUp({ ephemeral: true, content: "⏱️ Rien reçu. Réessaie en cliquant sur le bouton." });
      }

      const urls = [...msg.attachments.values()].map((a) => a.url);
      const next = updateDraft(guildId, userId, {
        photoIndividuUrls: [...(draft.photoIndividuUrls || []), ...urls],
      });

      await tryDeleteMessage(msg);

      return interaction.followUp({
        ephemeral: true,
        content: `✅ Individu enregistré (${urls.length} image(s)).`,
        embeds: [buildJugementEmbed(next)],
        components: wizardComponents(userId),
      });
    }

    // --- Modal nb casiers
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

    // --- Envoi final
    if (action === "send") {
      const pingRoleIds = await db.getPingRoleIds(guildId);

      const pingLine = pingRoleIds.length
        ? `|| ${pingRoleIds.map((id) => `<@&${id}>`).join(" ")} ||`
        : null;

      // 1) Embed principal
      const embed = buildJugementEmbed(draft);
      await channel.send({
        content: pingLine || undefined,
        embeds: [embed],
      });

      // 2) Photos en texte pur (URL seules sur leur ligne => preview fiable)
      const casierUrls = (draft.photoCasierUrls || []).filter(Boolean);
      const individuUrls = (draft.photoIndividuUrls || []).filter(Boolean);

      const photoBlocks = [];

      if (casierUrls.length) {
        photoBlocks.push("Photo casier judiciaire:");
        // URL seules
        photoBlocks.push(casierUrls.join("\n"));
      }
      if (individuUrls.length) {
        if (photoBlocks.length) photoBlocks.push(""); // ligne vide
        photoBlocks.push("Photo individu:");
        photoBlocks.push(individuUrls.join("\n"));
      }

      const photosContent = photoBlocks.join("\n");

      if (photosContent.trim()) {
        await channel.send({ content: photosContent });
      }

      clearDraft(guildId, userId);
      return interaction.update({ content: "✅ Dossier envoyé.", embeds: [], components: [] });
    }
  },
};

module.exports.wizardComponents = wizardComponents;