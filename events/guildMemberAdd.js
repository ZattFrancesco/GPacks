const { sendLog, DEFAULT_COLORS, userLabel, lines, timestampLabel } = require('../src/utils/discordLogs');
const autoroleDb = require('../services/autorole.db');
const logger = require('../src/utils/logger');

module.exports = {
  name: 'guildMemberAdd',
  once: false,
  async execute(client, member) {
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