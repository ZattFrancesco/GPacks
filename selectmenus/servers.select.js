const { EmbedBuilder, ChannelType } = require("discord.js");
const { isOwner } = require("../src/utils/permissions");

module.exports = {
  id: "servers:invite",

  async execute(interaction, client) {
    // Owner-only guard
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        content: "❌ Réservé au propriétaire du bot.",
        flags: 64,
      });
    }

    const guildId = interaction.values[0];
    const guild = client.guilds.cache.get(guildId);

    if (!guild) {
      return interaction.reply({
        content: "❌ Serveur introuvable (le bot l'a peut-être quitté).",
        flags: 64,
      });
    }

    await interaction.deferReply({ flags: 64 });

    try {
      // 1) Try to find an existing, non-expired invite
      let invite = null;

      if (guild.members.me?.permissions.has("ManageGuild")) {
        const invites = await guild.invites.fetch().catch(() => null);
        if (invites?.size) {
          // Pick a permanent invite (maxAge === 0) if possible
          invite = invites.find((i) => i.maxAge === 0) || invites.first();
        }
      }

      // 2) If no existing invite, create one on the first text channel we can
      if (!invite) {
        const channel = guild.channels.cache.find(
          (c) =>
            (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) &&
            c.permissionsFor(guild.members.me)?.has("CreateInstantInvite")
        );

        if (!channel) {
          return interaction.editReply({
            content:
              "❌ Impossible de créer une invitation — aucun salon textuel accessible avec la permission `CREATE_INSTANT_INVITE`.",
          });
        }

        invite = await channel.createInvite({
          maxAge: 86400, // 24h
          maxUses: 1,
          unique: true,
          reason: `Invitation demandée par l'owner via /servers`,
        });
      }

      // 3) Send invite via DM
      const dmEmbed = new EmbedBuilder()
        .setTitle(`📩 Invitation pour ${guild.name}`)
        .setDescription(
          [
            `**Serveur** : ${guild.name}`,
            `**ID** : \`${guild.id}\``,
            `**Membres** : ${guild.memberCount || "?"}`,
            ``,
            `🔗 **[Rejoindre le serveur](${invite.url || `https://discord.gg/${invite.code}`})**`,
          ].join("\n")
        )
        .setColor(0x57f287)
        .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }) || null)
        .setTimestamp();

      try {
        await interaction.user.send({ embeds: [dmEmbed] });
        return interaction.editReply({
          content: `✅ Invitation pour **${guild.name}** envoyée en MP !`,
        });
      } catch {
        // DMs closed — fallback to ephemeral reply
        return interaction.editReply({
          content: `⚠️ Impossible d'envoyer en MP. Voici le lien :\n${invite.url || `https://discord.gg/${invite.code}`}`,
        });
      }
    } catch (err) {
      return interaction.editReply({
        content: `❌ Erreur lors de la génération de l'invitation : \`${(err?.message || String(err)).slice(0, 300)}\``,
      });
    }
  },
};
