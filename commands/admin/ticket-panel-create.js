const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const { createPanel, listTypes } = require("../../services/tickets.db");
const { buildPanelEmbed, buildPanelComponents } = require("../../src/utils/ticketViews");

function parseTypeList(raw) {
  return String(raw || "")
    .split(/[ ,;\n]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket-panel-create")
    .setDescription("Créer / mettre à jour un panel de tickets")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((o) => o.setName("id").setDescription("ID du panel").setRequired(true))
    .addChannelOption((o) => o.setName("channel").setDescription("Salon où poster le panel").setRequired(true))
    .addStringOption((o) => o.setName("title").setDescription("Titre embed").setRequired(true))
    .addStringOption((o) => o.setName("description").setDescription("Description embed").setRequired(true))
    .addStringOption((o) =>
      o
        .setName("types")
        .setDescription("IDs des types autorisés (séparés par espaces/virgules)")
        .setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName("style")
        .setDescription("Affichage")
        .addChoices({ name: "menu", value: "menu" }, { name: "boutons", value: "boutons" })
        .setRequired(false)
    )
    .addIntegerOption((o) => o.setName("color").setDescription("Couleur (nombre, ex: 16711680)").setRequired(false))
    .addRoleOption((o) => o.setName("required_role").setDescription("Rôle minimum pour ouvrir").setRequired(false))
    .addStringOption((o) => o.setName("logo_url").setDescription("Thumbnail URL").setRequired(false))
    .addStringOption((o) => o.setName("banner_url").setDescription("Image URL").setRequired(false)),

  async execute(interaction) {
    // DB + envoi de message peuvent dépasser le délai de réponse Discord.
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;

    const panelId = interaction.options.getString("id", true);
    const channel = interaction.options.getChannel("channel", true);
    const title = interaction.options.getString("title", true);
    const description = interaction.options.getString("description", true);
    const typeRaw = interaction.options.getString("types", true);
    const style = interaction.options.getString("style", false) || "menu";
    const color = interaction.options.getInteger("color", false);
    const requiredRole = interaction.options.getRole("required_role", false);
    const logoUrl = interaction.options.getString("logo_url", false);
    const bannerUrl = interaction.options.getString("banner_url", false);

    const allTypes = await listTypes(guildId);
    const allowed = new Set(allTypes.map((t) => t.id));
    const requested = parseTypeList(typeRaw);
    const typeIds = requested.filter((t) => allowed.has(t));

    // Le panel doit être posté dans un salon textuel (pas une catégorie/voice/etc.)
    if (!channel || typeof channel.send !== "function") {
      return interaction.editReply({
        content: "❌ Ce salon ne permet pas d'envoyer des messages. Choisis un salon texte.",
      });
    }

    if (!typeIds.length) {
      return interaction.editReply({
        content: "❌ Aucun type valide. Vérifie /ticket-type-create puis mets les IDs ici.",
      });
    }

    const panelPayload = {
      id: panelId,
      channelId: channel.id,
      title,
      description,
      color: color ?? null,
      style,
      requiredRoleId: requiredRole?.id || null,
      logoUrl: logoUrl || null,
      bannerUrl: bannerUrl || null,
      typeIds,
    };

    const types = allTypes.filter((t) => typeIds.includes(t.id));

    const msg = await channel.send({
      embeds: [buildPanelEmbed({
        title,
        description,
        color,
        logo_url: logoUrl,
        banner_url: bannerUrl,
      })],
      components: buildPanelComponents({ panel: { id: panelId, style }, types }),
    });

    await createPanel(guildId, { ...panelPayload, messageId: msg.id });

    return interaction.editReply({
      content: `✅ Panel **${panelId}** posté dans <#${channel.id}> (message: ${msg.id}).`,
    });
  },
};
