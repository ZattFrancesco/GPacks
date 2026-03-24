const { isSilentMuted } = require('../services/silentMute.db');
const { sendLog, DEFAULT_COLORS, userLabel, channelLabel, lines } = require('../src/utils/discordLogs');

module.exports = {
  name: 'voiceStateUpdate',
  once: false,
  async execute(client, oldState, newState) {
    const member = newState?.member || oldState?.member;
    if (!member || member.user?.bot) return;

    const joinedChannel = !oldState?.channelId && newState?.channelId;
    const leftChannel = oldState?.channelId && !newState?.channelId;
    const switchedChannel = oldState?.channelId && newState?.channelId && oldState.channelId !== newState.channelId;

    if (joinedChannel) {
      await sendLog(client, newState.guild.id, {
        color: DEFAULT_COLORS.success,
        title: '🔊 Connexion vocale',
        description: lines([
          `**Membre** : ${userLabel(member.user)}`,
          `**Salon** : ${channelLabel(newState.channel)}`,
        ]),
      });
    } else if (leftChannel) {
      await sendLog(client, oldState.guild.id, {
        color: DEFAULT_COLORS.danger,
        title: '🔇 Déconnexion vocale',
        description: lines([
          `**Membre** : ${userLabel(member.user)}`,
          `**Salon** : ${channelLabel(oldState.channel)}`,
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

    const justBecameConnected = joinedChannel || switchedChannel;
    if (!justBecameConnected) return;
    if (!(await isSilentMuted(newState.guild.id, member.id))) return;

    await sendLog(client, newState.guild.id, {
      color: DEFAULT_COLORS.danger,
      title: '🔕 Silent-mute vocal déclenché',
      description: lines([
        `**Membre** : ${userLabel(member.user)}`,
        `**Tentative de connexion** : ${channelLabel(newState.channel)}`,
      ]),
    });

    await member.voice.disconnect('Silent-mute actif').catch(() => {});
  },
};
