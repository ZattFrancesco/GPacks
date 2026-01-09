// commands/utility/planning-interne.js

const { SlashCommandBuilder } = require("discord.js");
const {
  ensureTables,
  getWeekMondayLocal,
  toMysqlDate,
  getPlanningMessage,
  upsertPlanningMessage,
} = require("../../services/internalPlanning.db");
const { buildWeeklyPlanningMessage } = require("../../src/utils/internalPlanningView");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("planning-interne")
    .setDescription("Créer / mettre à jour l'embed du planning interne (par semaine)"),

  async execute(interaction) {
    await ensureTables();

    const guildId = interaction.guildId;

    // semaine actuelle par défaut
    const monday = getWeekMondayLocal(new Date());
    const weekMonday = toMysqlDate(monday);

    // chercher un message existant
    let rec = await getPlanningMessage(guildId);

    let planningMessage = null;

    if (rec) {
      // essayer de fetch le message existant
      try {
        const ch = await interaction.guild.channels.fetch(String(rec.channel_id));
        if (ch && ch.isTextBased?.()) {
          planningMessage = await ch.messages.fetch(String(rec.message_id));
        }
      } catch (_) {
        planningMessage = null;
      }
    }

    // si pas trouvé -> créer dans le channel courant
    if (!planningMessage) {
      const { embed, components } = await buildWeeklyPlanningMessage({ guildId, weekMondayDate: weekMonday });
      planningMessage = await interaction.channel.send({ embeds: [embed], components });

      await upsertPlanningMessage({
        guildId,
        channelId: planningMessage.channelId,
        messageId: planningMessage.id,
        weekMonday: weekMonday,
      });

      return interaction.reply({ content: "✅ Planning interne créé.", ephemeral: true });
    }

    // si trouvé -> MAJ (et si le planning était ailleurs, on garde ce choix)
    const targetWeek = rec?.week_monday || weekMonday;
    const { embed, components } = await buildWeeklyPlanningMessage({ guildId, weekMondayDate: targetWeek });

    await planningMessage.edit({ embeds: [embed], components });

    // s'assurer que la DB est cohérente (au cas où)
    await upsertPlanningMessage({
      guildId,
      channelId: planningMessage.channelId,
      messageId: planningMessage.id,
      weekMonday: targetWeek,
    });

    return interaction.reply({ content: "✅ Planning interne mis à jour.", ephemeral: true });
  },
};
