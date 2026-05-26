// src/utils/golemVoice.js
// Gestion centralisée des connexions vocales "golem".
//
// Le bot rejoint un salon vocal via /golem et n'en sort JAMAIS de lui-même.
// Il ne quitte que dans deux cas :
//   1. Un utilisateur le kick / déconnecte du salon vocal (géré dans events/voiceStateUpdate.js)
//   2. La commande owner /golem-stop est utilisée
//
// On garde une connexion active par serveur (guildId).

const {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState,
} = require("@discordjs/voice");

const logger = require("./logger");

// Map<guildId, channelId> : mémorise le salon ciblé pour chaque connexion active.
const activeChannels = new Map();

/**
 * Fait rejoindre le bot dans un salon vocal et l'y maintient.
 * @param {import('discord.js').VoiceBasedChannel} channel
 * @returns {import('@discordjs/voice').VoiceConnection}
 */
function joinGolem(channel) {
  const guildId = channel.guild.id;

  // Si déjà connecté quelque part sur ce serveur, on détruit l'ancienne connexion.
  const existing = getVoiceConnection(guildId);
  if (existing) {
    try {
      existing.destroy();
    } catch (_) {}
  }

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false,
  });

  activeChannels.set(guildId, channel.id);

  // Reconnexion automatique si Discord coupe la connexion pour une raison
  // réseau (et NON parce qu'un humain a kické le bot — ce cas est traité
  // dans voiceStateUpdate, qui appellera leaveGolem avant que ceci ne s'active).
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    // Si on a volontairement retiré l'entrée (kick / stop), on ne reconnecte pas.
    if (!activeChannels.has(guildId)) {
      try {
        connection.destroy();
      } catch (_) {}
      return;
    }

    try {
      // On laisse une petite chance à une reconnexion réseau "propre".
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
      // Reconnexion réseau en cours, on ne fait rien.
    } catch (_) {
      // Vraie déconnexion : on nettoie.
      try {
        connection.destroy();
      } catch (_) {}
      activeChannels.delete(guildId);
      logger.info(`[golem] Connexion perdue sur ${guildId}, nettoyée.`);
    }
  });

  logger.info(`[golem] Bot connecté au salon ${channel.id} (guild ${guildId}).`);
  return connection;
}

/**
 * Fait quitter le bot du salon vocal sur un serveur donné.
 * @param {string} guildId
 * @returns {boolean} true si une connexion a été détruite, false sinon.
 */
function leaveGolem(guildId) {
  activeChannels.delete(guildId);
  const connection = getVoiceConnection(guildId);
  if (!connection) return false;

  try {
    connection.destroy();
  } catch (_) {}
  logger.info(`[golem] Bot déconnecté (guild ${guildId}).`);
  return true;
}

/**
 * Indique si le bot a une connexion golem active sur ce serveur.
 * @param {string} guildId
 */
function isGolemActive(guildId) {
  return activeChannels.has(guildId) && Boolean(getVoiceConnection(guildId));
}

/**
 * Renvoie l'ID du salon ciblé sur ce serveur (ou null).
 * @param {string} guildId
 */
function getGolemChannelId(guildId) {
  return activeChannels.get(guildId) || null;
}

module.exports = {
  joinGolem,
  leaveGolem,
  isGolemActive,
  getGolemChannelId,
};
