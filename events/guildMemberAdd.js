const { EmbedBuilder } = require('discord.js');
const { sendLog, DEFAULT_COLORS, userLabel, lines, timestampLabel } = require('../src/utils/discordLogs');
const autoroleDb = require('../services/autorole.db');
const { getWelcomeMessage, applyVariables } = require('../services/welcomeMessage.db');
const logger = require('../src/utils/logger');

module.exports = {
  name: 'guildMemberAdd',
  once: false,
  async execute(client, member) {
    // ---- Autorole (comportement existant)
    try {
      const cfg = await autoroleDb.getAutorole(member.guild.id);
      if (cfg?.roleId) {
        let role = member.guild.roles.cache.get(cfg.roleId) || null;

        if (!role) {
          try {
            role = await member.guild.roles.fetch(cfg.roleId);
          } catch {
            role = null;
          }
        }

        if (!role) {
          await autoroleDb.clearAutorole(member.guild.id);
          logger.warn(`Autorole nettoyé automatiquement: rôle ${cfg.roleId} introuvable sur ${member.guild.id}`);
        } else if (!role.managed && role.editable) {
          try {
            await member.roles.add(role, { reason: "Autorole automatique à l'arrivée" });
          } catch (err) {
            logger.warn(`Impossible d'attribuer l'autorole ${role.id} à ${member.user?.tag || member.id}: ${err?.message || err}`);
          }
        } else {
          logger.warn(`Autorole non attribuable sur ${member.guild.id}: rôle ${role.id}`);
        }
      }
    } catch (err) {
      logger.warn(`guildMemberAdd autorole: ${err?.message || err}`);
    }

    // ---- Welcome DM
    try {
      if (!member.user?.bot) {
        const welcome = await getWelcomeMessage(member.guild.id);
        if (welcome?.message) {
          const renderedTitle = welcome.title
            ? applyVariables(welcome.title, { member, guild: member.guild })
            : null;
          const renderedMessage = applyVariables(welcome.message, { member, guild: member.guild });

          // Couleur : utilise la couleur du rôle le plus haut du bot, fallback bleu Discord.
          const color = member.guild.members?.me?.displayColor || 0x5865f2;

          const embed = new EmbedBuilder()
            .setColor(color)
            .setDescription(renderedMessage.slice(0, 4096))
            .setTimestamp(new Date());
          if (renderedTitle) embed.setTitle(renderedTitle.slice(0, 256));
          if (member.guild.iconURL?.()) embed.setThumbnail(member.guild.iconURL());
          embed.setFooter({ text: member.guild.name || '' });

          try {
            await member.send({ embeds: [embed] });
          } catch (err) {
            // DMs fermés / bot bloqué → fail silencieux, juste un warn.
            logger.warn(`Welcome DM impossible pour ${member.user?.tag || member.id} sur ${member.guild.id}: ${err?.message || err}`);
          }
        }
      }
    } catch (err) {
      logger.warn(`guildMemberAdd welcome: ${err?.message || err}`);
    }

    // ---- Log Discord (comportement existant)
    await sendLog(client, member.guild.id, {
      type: 'guild_member_add',
      color: DEFAULT_COLORS.success,
      title: '📥 Membre rejoint',
      description: lines([
        `**Membre** : ${userLabel(member.user)}`,
        `**Compte créé** : ${timestampLabel(member.user.createdTimestamp)}`,
        `**Nombre de membres** : **${member.guild.memberCount}**`,
      ]),
      thumbnail: member.user.displayAvatarURL?.(),
    });
  },
};
