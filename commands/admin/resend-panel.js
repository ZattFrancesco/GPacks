const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const {
  ensureTables,
  getPanel,
  updatePanel,
  listTypes,
} = require("../../services/tickets.db");

const {
  buildPanelEmbed,
  buildPanelComponents,
} = require("../../src/utils/ticketViews");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("resend-panel")
    .setDescription("Reposter un panel")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((o) =>
      o
        .setName("id")
        .setDescription("ID du panel")
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const guildId = interaction.guildId;
    const panelId = interaction.options.getString("id", true);

    await ensureTables();

    const panel = await getPanel(guildId, panelId);
    if (!panel) {
      return interaction.editReply({
        content: `❌ Aucun panel trouvé avec l'id \`${panelId}\`.`,
      });
    }

    const channel = interaction.guild.channels.cache.get(panel.channel_id)
      || await interaction.guild.channels.fetch(panel.channel_id).catch(() => null);

    if (!channel || typeof channel.send !== "function") {
      return interaction.editReply({
        content: `❌ Le salon enregistré pour ce panel est introuvable ou n'accepte pas les messages.\nSalon enregistré : \`${panel.channel_id}\``,
      });
    }

    const allTypes = await listTypes(guildId);
    const types = allTypes.filter((t) => panel.type_ids.includes(t.id));

    if (!types.length) {
      return interaction.editReply({
        content: `❌ Impossible de renvoyer le panel \`${panel.id}\` : aucun type valide n'est encore lié à ce panel.`,
      });
    }

    let oldDeleted = false;
    let oldDeleteError = null;

    if (panel.message_id) {
      try {
        const oldMessage = await channel.messages.fetch(panel.message_id).catch(() => null);
        if (oldMessage) {
          await oldMessage.delete().catch((err) => {
            oldDeleteError = err;
          });
          if (!oldDeleteError) oldDeleted = true;
        }
      } catch (err) {
        oldDeleteError = err;
      }
    }

    const newMessage = await channel.send({
      embeds: [
        buildPanelEmbed({
          id: panel.id,
          title: panel.title,
          description: panel.description,
          color: panel.color,
          logo_url: panel.logo_url,
          banner_url: panel.banner_url,
        }),
      ],
      components: buildPanelComponents({
        panel: {
          id: panel.id,
          style: panel.style,
        },
        types,
      }),
    });

    await updatePanel(guildId, panel.id, {
      message_id: newMessage.id,
      channel_id: channel.id,
    });

    let content = `✅ Panel \`${panel.id}\` renvoyé dans <#${channel.id}>.\n🆕 Nouveau message : \`${newMessage.id}\``;

    if (panel.message_id) {
      if (oldDeleted) {
        content += `\n🗑️ Ancien message supprimé : \`${panel.message_id}\``;
      } else {
        content += `\n⚠️ Ancien message non supprimé automatiquement : \`${panel.message_id}\``;
      }
    }

    return interaction.editReply({ content });
  },
};