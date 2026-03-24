const { isSilentMuted } = require('../services/silentMute.db');

module.exports = {
  name: 'voiceStateUpdate',
  once: false,
  async execute(client, oldState, newState) {
    const member = newState?.member || oldState?.member;
    if (!member || member.user?.bot) return;

    const joinedChannel = !oldState?.channelId && newState?.channelId;
    const switchedChannel = oldState?.channelId && newState?.channelId && oldState.channelId !== newState.channelId;
    const justBecameConnected = joinedChannel || switchedChannel;

    if (!justBecameConnected) return;
    if (!(await isSilentMuted(newState.guild.id, member.id))) return;

    await member.voice.disconnect('Silent-mute actif').catch(() => {});
  },
};
