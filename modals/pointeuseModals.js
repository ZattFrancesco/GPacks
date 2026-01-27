// modals/pointeuseModals.js
const pointeuseDb = require("../services/pointeuse.db");
const { isStaff, isAdmin } = require("../src/utils/pointeusePerms");
const { ensureActiveWeek, publishOrUpdateRecap } = require("../src/utils/pointeuseMessages");
const { sendLog, buildClockLog } = require("../src/utils/pointeuseLogs");

function parseDurationFromModal(interaction) {
  const hRaw = interaction.fields.getTextInputValue("hours");
  const mRaw = interaction.fields.getTextInputValue("minutes");
  const h = Number(String(hRaw || "").trim());
  const m = Number(String(mRaw || "").trim());

  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 0 || m < 0 || m > 59) return null;
  const total = h * 60 + m;
  if (total <= 0) return null;
  return { hours: h, minutes: m, totalMinutes: total };
}

async function isCooldownOk(guildId, userId) {
  const last = await pointeuseDb.getLastEntryAt(guildId, userId);
  if (!last) return { ok: true, remainingSec: 0 };
  const now = Date.now();
  const diffMs = now - last.getTime();
  const minMs = 10 * 60 * 1000;
  if (diffMs >= minMs) return { ok: true, remainingSec: 0 };
  return { ok: false, remainingSec: Math.ceil((minMs - diffMs) / 1000) };
}

module.exports = {
  id: "pointeuse:clock:submit",
  async execute(interaction) {
    await pointeuseDb.ensureTables();
    const settings = await pointeuseDb.getSettings(interaction.guildId);
    const duration = parseDurationFromModal(interaction);
    if (!duration) {
      return interaction.reply({ content: "❌ Durée invalide (heures + minutes 0-59).", ephemeral: true });
    }

    // Cooldown 10 minutes (bypass staff/admin)
    const bypass = isStaff(interaction.member, settings) || isAdmin(interaction.member);
    if (!bypass) {
      const cd = await isCooldownOk(interaction.guildId, interaction.user.id);
      if (!cd.ok) {
        const min = Math.ceil(cd.remainingSec / 60);
        return interaction.reply({
          content: `❌ Attends encore environ **${min} min** avant de repointer.`,
          ephemeral: true,
        });
      }
    }

    const weekId = await ensureActiveWeek(interaction.guildId);

    await pointeuseDb.insertEntry({
      guildId: interaction.guildId,
      weekId,
      userId: interaction.user.id,
      minutes: duration.totalMinutes,
      entryType: "clock",
      createdBy: interaction.user.id,
      reason: null,
    });

    await publishOrUpdateRecap(interaction.client, interaction.guildId, weekId).catch(() => null);
    await sendLog(
      interaction.client,
      interaction.guildId,
      buildClockLog({ userId: interaction.user.id, weekId, minutes: duration.totalMinutes })
    );

    return interaction.reply({
      content: `✅ Pointage ajouté: **${duration.hours}h ${duration.minutes}m** (semaine **${weekId}**).`,
      ephemeral: true,
    });
  },
};
