const { sendLog, DEFAULT_COLORS, userLabel, channelLabel, lines, resolveAuditEntry, AuditLogEvent } = require('../src/utils/discordLogs');
const { isGolemActive, getGolemChannelId, leaveGolem } = require('../src/utils/golemVoice');
const tempVoiceDb = require('../services/tempVoice.db');
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const logger = require('../src/utils/logger');

// ─── Helpers internes ─────────────────────────────────────────────────────────

/**
 * Crée un salon vocal temporaire pour un membre qui vient de rejoindre un hub.
 */
async function handleTempVoiceJoin(client, newState, member) {
  const config = await tempVoiceDb.getConfig(newState.guild.id, newState.channelId);
  if (!config) return; // Ce salon n'est pas un hub configuré

  const guild = newState.guild;
  const me    = guild.members.me;

  // Résoudre la catégorie cible (config > même catégorie que le hub > aucune)
  const hubChannel     = guild.channels.cache.get(config.hubChannelId);
  const targetCategory = config.categoryId
    ? guild.channels.cache.get(config.categoryId) ?? hubChannel?.parent ?? null
    : hubChannel?.parent ?? null;

  // Vérifier les permissions du bot
  const targetPerms = targetCategory
    ? targetCategory.permissionsFor(me)
    : guild.members.me.permissions;

  if (!targetPerms?.has(PermissionFlagsBits.ManageChannels)) {
    logger.warn(`[TempVoice] Pas la permission ManageChannels pour créer dans ${targetCategory?.name ?? 'la guilde'}`);
    return;
  }

  // Générer le nom du salon
  const channelName = tempVoiceDb.applyTemplate(config.template, { member });

  try {
    // Créer le salon vocal
    const tempChannel = await guild.channels.create({
      name:   channelName,
      type:   ChannelType.GuildVoice,
      parent: targetCategory ?? null,
      permissionOverwrites: [
        // Le membre owner voit et gère son propre salon
        {
          id:    member.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.Stream,
            PermissionFlagsBits.MuteMembers,
            PermissionFlagsBits.DeafenMembers,
            PermissionFlagsBits.MoveMembers,
            PermissionFlagsBits.ManageChannels,
          ],
        },
        // Héritage des permissions de la catégorie (sinon tout le monde)
        ...(targetCategory ? [] : [
          {
            id:    guild.roles.everyone.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
          },
        ]),
      ],
    });

    // Déplacer le membre dans son nouveau salon
    await member.voice.setChannel(tempChannel);

    // Enregistrer en base
    await tempVoiceDb.registerActive({
      channelId:    tempChannel.id,
      guildId:      guild.id,
      ownerId:      member.id,
      hubChannelId: config.hubChannelId,
    });

    logger.info(`[TempVoice] Salon créé : "${channelName}" (${tempChannel.id}) pour ${member.user.tag}`);
  } catch (err) {
    logger.error(`[TempVoice] Erreur création salon : ${err?.message || err}`);
  }
}

/**
 * Supprime une vocale temporaire si elle est vide.
 */
async function handleTempVoiceLeave(client, oldState) {
  const active = await tempVoiceDb.getActive(oldState.channelId);
  if (!active) return; // Ce salon n'est pas une vocale temporaire

  // Récupérer le salon depuis le cache (ou l'API)
  const channel = oldState.guild.channels.cache.get(oldState.channelId)
    ?? await oldState.guild.channels.fetch(oldState.channelId).catch(() => null);

  if (!channel) {
    // Salon introuvable → nettoyer la DB quand même
    await tempVoiceDb.removeActive(oldState.channelId);
    return;
  }

  // Ne supprimer que si le salon est vide
  if (channel.members.size > 0) return;

  try {
    await channel.delete('Vocale temporaire vide');
    await tempVoiceDb.removeActive(oldState.channelId);
    logger.info(`[TempVoice] Salon supprimé : "${channel.name}" (${oldState.channelId})`);
  } catch (err) {
    logger.warn(`[TempVoice] Impossible de supprimer "${channel.name}" : ${err?.message || err}`);
    // Nettoyer la DB si le salon a déjà été supprimé (erreur 10003)
    if (err?.code === 10003) await tempVoiceDb.removeActive(oldState.channelId);
  }
}

// ─── Event ────────────────────────────────────────────────────────────────────

module.exports = {
  name: 'voiceStateUpdate',
  once: false,
  async execute(client, oldState, newState) {
    const member = newState?.member || oldState?.member;

    // --- Gestion du Golem (bot maintenu en vocale) ---
    // Si l'état vocal qui change est celui du BOT lui-même et qu'un golem est
    // actif sur ce serveur, on détecte un éventuel kick / déconnexion / déplacement
    // pour libérer proprement la connexion. Le bot ne quitte JAMAIS de lui-même :
    // ce nettoyage n'a lieu que si un humain l'a sorti du salon.
    if (member?.id === client.user?.id) {
      const guildId = (newState?.guild || oldState?.guild)?.id;
      if (guildId && isGolemActive(guildId)) {
        const targetChannelId = getGolemChannelId(guildId);
        const currentChannelId = newState?.channelId || null;

        // Le bot n'est plus dans le salon ciblé (déconnecté ou déplacé ailleurs)
        if (currentChannelId !== targetChannelId) {
          leaveGolem(guildId);
        }
      }
      // On ne logue pas l'état vocal du bot dans les logs classiques.
      return;
    }

    if (!member || member.user?.bot) return;

    const joinedChannel   = !oldState?.channelId &&  newState?.channelId;
    const leftChannel     =  oldState?.channelId && !newState?.channelId;
    const switchedChannel =  oldState?.channelId &&  newState?.channelId && oldState.channelId !== newState.channelId;

    // ── Vocales temporaires ──────────────────────────────────────────────────
    // Quand un membre rejoint un hub  → créer une voc temp et l'y déplacer
    if (joinedChannel || switchedChannel) {
      await handleTempVoiceJoin(client, newState, member);
    }

    // Quand un membre quitte (ou change de salon) → vérifier si l'ancien salon doit être supprimé
    if (leftChannel || switchedChannel) {
      await handleTempVoiceLeave(client, oldState);
    }
    // ─────────────────────────────────────────────────────────────────────────

    if (joinedChannel) {
      await sendLog(client, newState.guild.id, {
      type: 'voice_state_update',
        color: DEFAULT_COLORS.success,
        title: '🔊 Connexion vocale',
        description: lines([
          `**Membre** : ${userLabel(member.user)}`,
          `**Salon** : ${channelLabel(newState.channel)}`,
        ]),
      });
    } else if (leftChannel) {
      const disconnectEntry = await resolveAuditEntry(oldState.guild, AuditLogEvent.MemberDisconnect, member.id);
      await sendLog(client, oldState.guild.id, {
        color: DEFAULT_COLORS.danger,
        title: disconnectEntry ? '⛔ Déconnexion vocale forcée' : '🔇 Déconnexion vocale',
        description: lines([
          `**Membre** : ${userLabel(member.user)}`,
          `**Salon** : ${channelLabel(oldState.channel)}`,
          disconnectEntry?.executor ? `**Par** : ${userLabel(disconnectEntry.executor)}` : null,
        ]),
      });
    } else if (switchedChannel) {
      await sendLog(client, newState.guild.id, {
        color: DEFAULT_COLORS.warning,
        title: '🔁 Déplacement vocal',
        description: lines([
          `**Membre** : ${userLabel(member.user)}`,
          `**Avant** : ${channelLabel(oldState.channel)}`,
          `**Après** : ${channelLabel(newState.channel)}`,
        ]),
      });
    }

    const statusChanges = [];
    if (oldState.serverMute !== newState.serverMute) statusChanges.push(`**Mute serveur** : ${oldState.serverMute ? 'Oui' : 'Non'} → ${newState.serverMute ? 'Oui' : 'Non'}`);
    if (oldState.serverDeaf !== newState.serverDeaf) statusChanges.push(`**Deaf serveur** : ${oldState.serverDeaf ? 'Oui' : 'Non'} → ${newState.serverDeaf ? 'Oui' : 'Non'}`);
    if (oldState.selfMute !== newState.selfMute) statusChanges.push(`**Self mute** : ${oldState.selfMute ? 'Oui' : 'Non'} → ${newState.selfMute ? 'Oui' : 'Non'}`);
    if (oldState.selfDeaf !== newState.selfDeaf) statusChanges.push(`**Self deaf** : ${oldState.selfDeaf ? 'Oui' : 'Non'} → ${newState.selfDeaf ? 'Oui' : 'Non'}`);
    if (oldState.streaming !== newState.streaming) statusChanges.push(`**Stream** : ${oldState.streaming ? 'Oui' : 'Non'} → ${newState.streaming ? 'Oui' : 'Non'}`);
    if (oldState.selfVideo !== newState.selfVideo) statusChanges.push(`**Caméra** : ${oldState.selfVideo ? 'Oui' : 'Non'} → ${newState.selfVideo ? 'Oui' : 'Non'}`);
    if (oldState.suppress !== newState.suppress) statusChanges.push(`**Suppress** : ${oldState.suppress ? 'Oui' : 'Non'} → ${newState.suppress ? 'Oui' : 'Non'}`);

    if (statusChanges.length) {
      await sendLog(client, newState.guild.id, {
        color: DEFAULT_COLORS.info,
        title: '🎙️ État vocal mis à jour',
        description: lines([
          `**Membre** : ${userLabel(member.user)}`,
          ...statusChanges,
        ]),
      });
    }
  },
};
