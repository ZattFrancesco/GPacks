// commands/owner/twitch.js
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');

const { isOwner } = require('../../src/utils/permissions');
const {
  addAlert,
  removeAlert,
  listAlerts,
} = require('../../services/twitchAlerts.db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('twitch')
    .setDescription('Gérer les alertes de live Twitch')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    // ── /twitch add ──────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Ajouter une alerte pour un streamer Twitch')
        .addStringOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Nom de la chaîne Twitch (ex: xqc)')
            .setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName('salon')
            .setDescription('Salon Discord où envoyer l\'alerte')
            .setRequired(true)
        )
        .addRoleOption((opt) =>
          opt
            .setName('role')
            .setDescription('Rôle à mentionner lors du live (optionnel)')
            .setRequired(false)
        )
    )

    // ── /twitch show ─────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub
        .setName('show')
        .setDescription('Lister toutes les alertes Twitch configurées')
    )

    // ── /twitch remove ───────────────────────────────────────────
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Supprimer une alerte Twitch')
        .addStringOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Nom de la chaîne Twitch à retirer')
            .setRequired(true)
        )
    ),

  // ─────────────────────────────────────────────────────────────
  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        content: '❌ Cette commande est réservée au propriétaire du bot.',
        flags: 64,
      });
    }

    const sub = interaction.options.getSubcommand(true);

    // ── ADD ──────────────────────────────────────────────────────
    if (sub === 'add') {
      const twitchLogin = interaction.options
        .getString('channel', true)
        .toLowerCase()
        .trim();
      const salon = interaction.options.getChannel('salon', true);
      const role  = interaction.options.getRole('role');

      // Vérification basique du nom (lettres, chiffres, underscore, 4-25 chars)
      if (!/^[a-z0-9_]{1,25}$/.test(twitchLogin)) {
        return interaction.reply({
          content: '❌ Nom de chaîne Twitch invalide.',
          flags: 64,
        });
      }

      const result = await addAlert({
        guildId:     interaction.guildId,
        twitchLogin,
        channelId:   salon.id,
        roleId:      role?.id ?? null,
        addedBy:     interaction.user.id,
      });

      if (!result.ok) {
        return interaction.reply({
          content: '❌ Une erreur est survenue lors de l\'ajout en base de données.',
          flags: 64,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x9146ff)
        .setTitle('✅ Alerte Twitch ajoutée')
        .addFields(
          { name: '🎮 Chaîne', value: `[${twitchLogin}](https://twitch.tv/${twitchLogin})`, inline: true },
          { name: '📢 Salon',  value: `<#${salon.id}>`, inline: true },
          { name: '🔔 Rôle',   value: role ? `<@&${role.id}>` : '*Aucun*', inline: true }
        )
        .setFooter({ text: `Ajouté par ${interaction.user.tag}` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], flags: 64 });
    }

    // ── SHOW ─────────────────────────────────────────────────────
    if (sub === 'show') {
      const alerts = await listAlerts(interaction.guildId);

      if (!alerts.length) {
        return interaction.reply({
          content: '📋 Aucune alerte Twitch configurée sur ce serveur.',
          flags: 64,
        });
      }

      const lines = alerts.map((a, i) => {
        const role   = a.role_id ? `<@&${a.role_id}>` : '*Aucun*';
        const status = a.live    ? '🔴 Live' : '⚫ Hors ligne';
        return `**${i + 1}.** [${a.twitch_login}](https://twitch.tv/${a.twitch_login}) → <#${a.channel_id}> | Ping : ${role} | ${status}`;
      });

      // Pagination simple si >25 entrées
      const chunks = [];
      for (let i = 0; i < lines.length; i += 20) {
        chunks.push(lines.slice(i, i + 20).join('\n'));
      }

      const embeds = chunks.map((chunk, idx) =>
        new EmbedBuilder()
          .setColor(0x9146ff)
          .setTitle(idx === 0 ? '📺 Alertes Twitch configurées' : '\u200b')
          .setDescription(chunk)
          .setFooter({ text: `${alerts.length} chaîne(s) suivie(s)` })
      );

      return interaction.reply({ embeds: embeds.slice(0, 10), flags: 64 });
    }

    // ── REMOVE ───────────────────────────────────────────────────
    if (sub === 'remove') {
      const twitchLogin = interaction.options
        .getString('channel', true)
        .toLowerCase()
        .trim();

      const result = await removeAlert({
        guildId: interaction.guildId,
        twitchLogin,
      });

      if (!result.ok) {
        return interaction.reply({
          content: '❌ Une erreur est survenue lors de la suppression.',
          flags: 64,
        });
      }

      if (!result.removed) {
        return interaction.reply({
          content: `❌ Aucune alerte trouvée pour **${twitchLogin}** sur ce serveur.`,
          flags: 64,
        });
      }

      return interaction.reply({
        content: `✅ L'alerte pour **${twitchLogin}** a été supprimée.`,
        flags: 64,
      });
    }
  },
};
