// services/twitchPoller.js
//
// Démarre un poller qui vérifie toutes les N secondes (défaut : 60s)
// si les streamers suivis sont en live via l'API Twitch Helix.
//
// Variables d'environnement requises :
//   TWITCH_CLIENT_ID     — Client ID de ton app Twitch
//   TWITCH_CLIENT_SECRET — Client Secret de ton app Twitch
//
// Utilisation dans index.js (après que le client Discord est ready) :
//   const { startTwitchPoller } = require('./services/twitchPoller');
//   startTwitchPoller(client);

const logger = require('../src/utils/logger');
const { getAllAlerts, setLiveStatus } = require('./twitchAlerts.db');
const { EmbedBuilder } = require('discord.js');

// ── Token Twitch ──────────────────────────────────────────────────────────────

let _token     = null;
let _tokenExp  = 0;  // timestamp ms

async function getTwitchToken() {
  if (_token && Date.now() < _tokenExp - 60_000) return _token;

  const clientId     = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET manquants dans .env');
  }

  const url = `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`;

  const res  = await fetch(url, { method: 'POST' });
  const data = await res.json();

  if (!data.access_token) {
    throw new Error(`Twitch token error: ${JSON.stringify(data)}`);
  }

  _token    = data.access_token;
  _tokenExp = Date.now() + data.expires_in * 1000;

  logger.info('twitchPoller: nouveau token Twitch obtenu');
  return _token;
}

// ── Appel Helix /streams ──────────────────────────────────────────────────────

/**
 * Retourne un objet { login → streamData | null } pour une liste de logins.
 * On découpe en chunks de 100 (limite API Twitch).
 */
async function fetchLiveStreams(logins) {
  if (!logins.length) return {};

  const clientId = process.env.TWITCH_CLIENT_ID;
  const token    = await getTwitchToken();
  const liveMap  = {};

  // Chunks de 100
  for (let i = 0; i < logins.length; i += 100) {
    const chunk = logins.slice(i, i + 100);
    const qs    = chunk.map((l) => `user_login=${encodeURIComponent(l)}`).join('&');
    const url   = `https://api.twitch.tv/helix/streams?${qs}`;

    const res  = await fetch(url, {
      headers: {
        'Client-Id':     clientId,
        Authorization:   `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      logger.warn(`twitchPoller: Helix streams responded ${res.status}`);
      continue;
    }

    const data = await res.json();
    for (const stream of data.data ?? []) {
      liveMap[stream.user_login.toLowerCase()] = stream;
    }
  }

  // Les logins absents de la réponse sont hors-ligne
  for (const login of logins) {
    if (!(login in liveMap)) liveMap[login] = null;
  }

  return liveMap;
}

// ── Construction de l'embed d'alerte ─────────────────────────────────────────

function buildLiveEmbed(stream) {
  // Thumbnail avec timestamp pour contourner le cache Discord
  const thumb = (stream.thumbnail_url || '')
    .replace('{width}', '440')
    .replace('{height}', '248')
    + `?t=${Date.now()}`;

  return new EmbedBuilder()
    .setColor(0x9146ff)
    .setAuthor({
      name:    `${stream.user_name} est en live !`,
      iconURL: 'https://static.twitchstatic.com/favicon.ico',
      url:     `https://twitch.tv/${stream.user_login}`,
    })
    .setTitle(stream.title || 'Sans titre')
    .setURL(`https://twitch.tv/${stream.user_login}`)
    .addFields(
      { name: '🎮 Jeu',       value: stream.game_name || 'Inconnu', inline: true },
      { name: '👥 Viewers',   value: String(stream.viewer_count ?? 0), inline: true }
    )
    .setImage(thumb)
    .setTimestamp(new Date(stream.started_at));
}

// ── Boucle principale ─────────────────────────────────────────────────────────

let _started = false;

/**
 * Lance le poller Twitch.
 * @param {import('discord.js').Client} client
 * @param {number} intervalMs  Intervalle en ms (défaut : 60 000)
 */
function startTwitchPoller(client, intervalMs = 60_000) {
  if (_started) return;
  _started = true;

  logger.info(`twitchPoller: démarré (intervalle ${intervalMs / 1000}s)`);

  const tick = async () => {
    try {
      const alerts = await getAllAlerts();
      if (!alerts.length) return;

      // Déduplique les logins pour l'appel API
      const uniqueLogins = [...new Set(alerts.map((a) => a.twitch_login))];
      const liveMap      = await fetchLiveStreams(uniqueLogins);

      for (const alert of alerts) {
        const stream   = liveMap[alert.twitch_login] ?? null;
        const isLive   = stream !== null;
        const wasLive  = Boolean(Number(alert.live));

        // Transition offline → online
        if (isLive && !wasLive) {
          await setLiveStatus({
            guildId:     alert.guild_id,
            twitchLogin: alert.twitch_login,
            live:        true,
          });

          try {
            const channel = await client.channels.fetch(alert.channel_id).catch(() => null);
            if (!channel?.isTextBased()) continue;

            const content = alert.role_id ? `<@&${alert.role_id}>` : undefined;
            const embed   = buildLiveEmbed(stream);

            await channel.send({ content, embeds: [embed] });
          } catch (sendErr) {
            logger.warn(
              `twitchPoller: impossible d'envoyer dans ${alert.channel_id} — ${sendErr?.message}`
            );
          }
        }

        // Transition online → offline
        if (!isLive && wasLive) {
          await setLiveStatus({
            guildId:     alert.guild_id,
            twitchLogin: alert.twitch_login,
            live:        false,
          });
        }
      }
    } catch (err) {
      logger.error(`twitchPoller: erreur dans tick — ${err?.message || err}`);
    }
  };

  // Premier tick rapide (5s après le démarrage), puis toutes les intervalMs
  setTimeout(tick, 5_000);
  setInterval(tick, intervalMs);
}

module.exports = { startTwitchPoller };
