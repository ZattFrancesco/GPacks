// commands/utility/set-defcon.js
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const defconDb = require("../../services/defcon.db");
const { auditLog } = require("../../src/utils/auditLog");

function buildDefconEmbed(level, cfg) {
  const e = new EmbedBuilder()
    .setTitle(`DEFCON ${level}`)
    .setDescription(cfg?.message || `DEFCON ${level} activé.`);

  if (cfg?.color !== null && cfg?.color !== undefined) e.setColor(Number(cfg.color));
  if (cfg?.footer) e.setFooter({ text: String(cfg.footer).slice(0, 255) });

  return e;
}

async function sendOrEditInChannel({ client, channelId, lastMessageId, payload }) {
  let channel = null;
  try {
    channel = await client.channels.fetch(channelId);
  } catch {
    channel = null;
  }

  if (!channel || !channel.isTextBased?.()) {
    return { ok: false, reason: "channel_not_found" };
  }

  // essaie d'éditer
  if (lastMessageId) {
    try {
      const msg = await channel.messages.fetch(lastMessageId);
      if (msg) {
        await msg.edit(payload);
        return { ok: true, edited: true, messageId: msg.id };
      }
    } catch {
      // on tombera sur send
    }
  }

  // sinon on envoie
  const sent = await channel.send(payload);
  return { ok: true, edited: false, messageId: sent.id };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("set-defcon")
    .setDescription("Active un niveau DEFCON (envoie dans tous les serveurs configurés)")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption((opt) =>
      opt
        .setName("niveau")
        .setDescription("DEFCON à envoyer")
        .setRequired(true)
        .addChoices(
          { name: "DEFCON 1", value: 1 },
          { name: "DEFCON 2", value: 2 },
          { name: "DEFCON 3", value: 3 },
          { name: "DEFCON 4", value: 4 },
          { name: "DEFCON 5", value: 5 }
        )
    ),
  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: "❌ Admin uniquement.", ephemeral: true });
    }

    const level = interaction.options.getInteger("niveau", true);
    const cfg = await defconDb.getDefconMessage(level);
    const embed = buildDefconEmbed(level, cfg);

    const configs = await defconDb.getAllChannelConfigs();
    if (!configs.length) {
      return interaction.reply({
        content: "❌ Aucun salon DEFCON n'est configuré. Utilise **/set-defcon-channel** dans chaque serveur.",
        ephemeral: true,
      });
    }

    let ok = 0;
    let edited = 0;
    let failed = 0;

    // On envoie dans TOUS les salons configurés (tous serveurs)
    for (const row of configs) {
      const mention = row.ping_role_id ? `<@&${row.ping_role_id}>` : null;

      const payload = {
        content: mention || undefined,
        embeds: [embed],
        allowedMentions: mention ? { roles: [row.ping_role_id] } : { parse: [] },
      };

      try {
        const r = await sendOrEditInChannel({
          client: interaction.client,
          channelId: row.channel_id,
          lastMessageId: row.last_message_id,
          payload,
        });

        if (r.ok) {
          ok += 1;
          if (r.edited) edited += 1;
          await defconDb.setLastDefconMessageId(row.guild_id, r.messageId);
        } else {
          failed += 1;
        }
      } catch {
        failed += 1;
      }
    }

    
    // ✅ LOG
    await auditLog(interaction.client, interaction.guildId, {
      module: "DEFCON",
      action: "SET_LEVEL",
      level: "INFO",
      userId: interaction.user.id,
      sourceChannelId: interaction.channelId,
      message: `DEFCON ${level} envoyé (${ok} ok, ${failed} échecs).`,
      meta: { level, ok, edited, failed },
    });

return interaction.reply({
      content: `✅ DEFCON ${level} envoyé dans ${ok} salon(s) configuré(s). (modifié: ${edited}, échec: ${failed})`,
      ephemeral: true,
    });
  },
};
