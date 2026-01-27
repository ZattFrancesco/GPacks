// commands/admin/staff-pointage.js
const { SlashCommandBuilder } = require("discord.js");

const pointeuseDb = require("../../services/pointeuse.db");
const { isStaff } = require("../../src/utils/pointeusePerms");
const { ensureActiveWeek, publishOrUpdateRecap } = require("../../src/utils/pointeuseMessages");
const { sendLog, buildAdjustLog } = require("../../src/utils/pointeuseLogs");

function parseDuration(heures, minutes) {
  const h = Number(heures);
  const m = Number(minutes);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 0 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("staff-pointage")
    .setDescription("Ajouter ou retirer du temps de service à un membre")
    .setDMPermission(false)
    .addUserOption((opt) =>
      opt
        .setName("membre")
        .setDescription("Le membre concerné")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("action")
        .setDescription("Ajouter ou retirer")
        .setRequired(true)
        .addChoices(
          { name: "ajouter", value: "ajouter" },
          { name: "retirer", value: "retirer" }
        )
    )
    .addIntegerOption((opt) =>
      opt
        .setName("heures")
        .setDescription("Heures")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(999)
    )
    .addIntegerOption((opt) =>
      opt
        .setName("minutes")
        .setDescription("Minutes (0-59)")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(59)
    )
    .addStringOption((opt) =>
      opt
        .setName("raison")
        .setDescription("Raison (obligatoire)")
        .setRequired(true)
        .setMaxLength(500)
    ),

  async execute(interaction) {
    await pointeuseDb.ensureTables();
    const settings = await pointeuseDb.getSettings(interaction.guildId);

    // Staff roles + bypass admin
    if (!isStaff(interaction.member, settings)) {
      return interaction.reply({ content: "❌ Staff uniquement.", ephemeral: true });
    }

    const target = interaction.options.getUser("membre", true);
    const action = interaction.options.getString("action", true);
    const heures = interaction.options.getInteger("heures", true);
    const minutes = interaction.options.getInteger("minutes", true);
    const raison = interaction.options.getString("raison", true).trim();

    const durationMin = parseDuration(heures, minutes);
    if (durationMin === null || durationMin === 0) {
      return interaction.reply({ content: "❌ Durée invalide.", ephemeral: true });
    }

    const weekId = await ensureActiveWeek(interaction.guildId);

    const signedMinutes = action === "retirer" ? -durationMin : durationMin;
    if (action === "retirer") {
      const current = await pointeuseDb.getTotalForUserWeek(interaction.guildId, weekId, target.id);
      if (durationMin > current) {
        return interaction.reply({
          content: `❌ Impossible de retirer **${heures}h ${minutes}m** : total actuel = ${Math.floor(current / 60)}h ${current % 60}m.`,
          ephemeral: true,
        });
      }
    }

    await pointeuseDb.insertEntry({
      guildId: interaction.guildId,
      weekId,
      userId: target.id,
      minutes: signedMinutes,
      entryType: "adjust",
      createdBy: interaction.user.id,
      reason,
    });

    // Update recap (semaine active)
    await publishOrUpdateRecap(interaction.client, interaction.guildId, weekId).catch(() => null);

    // Logs
    await sendLog(
      interaction.client,
      interaction.guildId,
      buildAdjustLog({
        targetUserId: target.id,
        weekId,
        minutes: durationMin,
        action,
        staffId: interaction.user.id,
        reason,
      })
    );

    return interaction.reply({
      content:
        `✅ Ajustement effectué pour ${target} (**${action} ${heures}h ${minutes}m**).\n` +
        `Semaine: **${weekId}**`,
      ephemeral: true,
    });
  },
};
