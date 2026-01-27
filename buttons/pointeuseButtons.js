// buttons/pointeuseButtons.js
const {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
} = require("discord.js");

const pointeuseDb = require("../services/pointeuse.db");
const { isStaff } = require("../src/utils/pointeusePerms");
const { ensureActiveWeek, publishOrUpdatePanel, publishOrUpdateRecap } = require("../src/utils/pointeuseMessages");
const { buildDashboard } = require("../src/utils/pointeuseSetupView");
const { getIsoWeekId, addWeeks } = require("../src/utils/pointeuseWeek");
const { sendLog, buildResetLog } = require("../src/utils/pointeuseLogs");

function buildClockModal() {
  const modal = new ModalBuilder()
    .setCustomId("pointeuse:clock:submit")
    .setTitle("Pointer");

  const hours = new TextInputBuilder()
    .setCustomId("hours")
    .setLabel("Heures effectuées")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("ex: 7");

  const minutes = new TextInputBuilder()
    .setCustomId("minutes")
    .setLabel("Minutes")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("ex: 30");

  modal.addComponents(
    new ActionRowBuilder().addComponents(hours),
    new ActionRowBuilder().addComponents(minutes)
  );

  return modal;
}

async function handleSetupPublish(interaction, kind) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: "❌ Admin uniquement.", ephemeral: true });
  }

  await pointeuseDb.ensureSettingsRow(interaction.guildId);
  let res;
  try {
    if (kind === "panel") res = await publishOrUpdatePanel(interaction.client, interaction.guildId);
    else res = await publishOrUpdateRecap(interaction.client, interaction.guildId);
  } catch (err) {
    return interaction.reply({ content: `❌ ${err?.message || "Erreur"}`, ephemeral: true });
  }

  const settings = await pointeuseDb.getSettings(interaction.guildId);
  const payload = buildDashboard(settings);

  await interaction.update({ ...payload });
  return interaction.followUp({
    content: `✅ ${kind === "panel" ? "Panel" : "Recap"} publié${res.updated ? " (mis à jour)" : ""}.`,
    ephemeral: true,
  });
}

module.exports = [
  // Panel button -> open modal
  {
    id: "pointeuse:clock",
    async execute(interaction) {
      return interaction.showModal(buildClockModal());
    },
  },

  // Setup dashboard buttons
  {
    id: "pointeuse:setup:publish_panel",
    async execute(interaction) {
      return handleSetupPublish(interaction, "panel");
    },
  },
  {
    id: "pointeuse:setup:publish_recap",
    async execute(interaction) {
      return handleSetupPublish(interaction, "recap");
    },
  },
  {
    id: "pointeuse:setup:close",
    async execute(interaction) {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: "❌ Admin uniquement.", ephemeral: true });
      }
      return interaction.update({ content: "✅ Dashboard fermé.", embeds: [], components: [] });
    },
  },

  // Recap navigation / reset (prefix handlers)
  {
    idPrefix: "pointeuse:week:prev:",
    async execute(interaction) {
      const parts = String(interaction.customId).split(":");
      const currentWeek = parts.slice(3).join(":");
      const prevWeek = addWeeks(currentWeek, -1);
      await publishOrUpdateRecap(interaction.client, interaction.guildId, prevWeek);
      return interaction.deferUpdate();
    },
  },
  {
    idPrefix: "pointeuse:week:next:",
    async execute(interaction) {
      const parts = String(interaction.customId).split(":");
      const currentWeek = parts.slice(3).join(":");
      const nextWeek = addWeeks(currentWeek, 1);
      await publishOrUpdateRecap(interaction.client, interaction.guildId, nextWeek);
      return interaction.deferUpdate();
    },
  },
  {
    idPrefix: "pointeuse:week:reset:",
    async execute(interaction) {
      await pointeuseDb.ensureTables();
      const settings = await pointeuseDb.getSettings(interaction.guildId);
      if (!isStaff(interaction.member, settings)) {
        return interaction.reply({ content: "❌ Staff uniquement.", ephemeral: true });
      }

      const parts = String(interaction.customId).split(":");
      const displayedWeek = parts.slice(3).join(":");
      const activeWeek = (await ensureActiveWeek(interaction.guildId)) || getIsoWeekId(new Date());

      if (displayedWeek !== activeWeek) {
        return interaction.reply({
          content: `❌ Tu ne peux reset que la semaine active (**${activeWeek}**).`,
          ephemeral: true,
        });
      }

      const nextWeek = addWeeks(activeWeek, 1);
      await pointeuseDb.setActiveWeekId(interaction.guildId, nextWeek);
      await publishOrUpdateRecap(interaction.client, interaction.guildId, nextWeek).catch(() => null);

      await sendLog(
        interaction.client,
        interaction.guildId,
        buildResetLog({ fromWeekId: activeWeek, toWeekId: nextWeek, staffId: interaction.user.id })
      );

      return interaction.reply({ content: `✅ Semaine reset → **${nextWeek}**`, ephemeral: true });
    },
  },
];
