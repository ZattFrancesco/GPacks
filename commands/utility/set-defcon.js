// commands/utility/set-defcon.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const defconDb = require("../../services/defcon.db");

function buildDefconEmbed(level, cfg) {
  const e = new EmbedBuilder()
    .setTitle(`DEFCON ${level}`)
    .setDescription(cfg?.message || `DEFCON ${level} activé.`);

  if (cfg?.color !== null && cfg?.color !== undefined) e.setColor(Number(cfg.color));
  if (cfg?.footer) e.setFooter({ text: String(cfg.footer).slice(0, 255) });

  return e;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("set-defcon")
    .setDescription("Envoie le message DEFCON configuré")
    .addIntegerOption((opt) =>
      opt
        .setName("niveau")
        .setDescription("DEFCON à envoyer")
        .setRequired(true)
        .addChoices(
          { name: "DEFCON 1", value: 1 },
          { name: "DEFCON 2", value: 2 },
          { name: "DEFCON 3", value: 3 }
        )
    ),
  async execute(interaction) {
    const level = interaction.options.getInteger("niveau", true);

    const settings = await defconDb.getDefconSettings();
    const channelId = settings.channel_id;
    if (!channelId) {
      return interaction.reply({
        content: "❌ Aucun salon DEFCON configuré. Fais d'abord **/set-defcon-channel**.",
        ephemeral: true,
      });
    }

    const cfg = await defconDb.getDefconMessage(level);

    let channel;
    try {
      channel = await interaction.client.channels.fetch(channelId);
    } catch {
      channel = null;
    }

    if (!channel || !channel.isTextBased?.()) {
      return interaction.reply({
        content: "❌ Le salon DEFCON configuré est invalide ou inaccessible. Reconfigure avec **/set-defcon-channel**.",
        ephemeral: true,
      });
    }

    
const embed = buildDefconEmbed(level, cfg);

const mention = settings.ping_role_id ? `<@&${settings.ping_role_id}>` : null;
const payload = {
  content: mention || undefined,
  embeds: [embed],
  allowedMentions: mention ? { roles: [settings.ping_role_id] } : { parse: [] },
};

// 🔁 Au lieu de renvoyer un nouveau message à chaque fois:
// - si on a un last_message_id, on essaye de modifier ce message
// - sinon on envoie un nouveau message et on sauvegarde son id
let edited = false;

if (settings.last_message_id) {
  try {
    const msg = await channel.messages.fetch(settings.last_message_id);
    if (msg) {
      await msg.edit(payload);
      edited = true;
    }
  } catch {
    edited = false;
  }
}

if (!edited) {
  const sent = await channel.send(payload);
  await defconDb.setLastDefconMessageId(sent.id);
}

return interaction.reply({
      content: `✅ DEFCON ${level} publié dans <#${channelId}>.`,
      ephemeral: true,
    });
  },
};
