// modals/visaEditModals.js

const { getVisaById, updateVisa } = require("../services/visa.db");
const { buildVisaEmbed } = require("../src/utils/visaFormat");

function isManager(interaction) {
  try { return interaction.memberPermissions?.has("ManageGuild"); } catch { return false; }
}

function safeVal(interaction, id) {
  try { return interaction.fields.getTextInputValue(id); } catch { return null; }
}

async function refreshVisaMessage(interaction, visaRow) {
  if (!visaRow?.channel_id || !visaRow?.message_id) return;
  const ch = await interaction.client.channels.fetch(visaRow.channel_id);
  const msg = await ch.messages.fetch(visaRow.message_id);
  await msg.edit({ embeds: [buildVisaEmbed(visaRow)] });
}

module.exports = {
  idPrefix: "visaEdit:",

  async execute(interaction) {
    // visaEdit:<type>:<visaId>:<ownerId>
    const parts = String(interaction.customId).split(":");
    const type = parts[1];
    const visaId = parts[2];
    const ownerId = parts[3];

    if (interaction.user.id !== ownerId) {
      return interaction.reply({ content: "❌ Pas à toi.", ephemeral: true });
    }

    const row = await getVisaById(interaction.guildId, visaId);
    if (!row) return interaction.reply({ content: "❌ Visa introuvable.", ephemeral: true });

    const can = interaction.user.id === row.reporter_user_id || isManager(interaction);
    if (!can) return interaction.reply({ content: "❌ Tu n'as pas la permission.", ephemeral: true });

    if (type === "exp") {
      const y = Number(safeVal(interaction, "year"));
      const m = Number(safeVal(interaction, "month"));
      const d = Number(safeVal(interaction, "day"));
      if (!Number.isFinite(y) || y < 2000 || y > 2100 || !Number.isFinite(m) || m < 1 || m > 12 || !Number.isFinite(d) || d < 1 || d > 31) {
        return interaction.reply({ content: "❌ Date invalide. Exemple: 2026 / 1 / 6", ephemeral: true });
      }
      const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      const ts = Math.floor(dt.getTime() / 1000);
      await updateVisa(visaId, { expiration_unix: ts });
      const fresh = await getVisaById(interaction.guildId, visaId);
      await refreshVisaMessage(interaction, fresh);
      return interaction.reply({ content: "✅ Expiration mise à jour.", ephemeral: true });
    }

    if (type === "emploi") {
      await updateVisa(visaId, {
        entreprise: safeVal(interaction, "entreprise") || null,
        poste: safeVal(interaction, "poste") || null,
      });
      const fresh = await getVisaById(interaction.guildId, visaId);
      await refreshVisaMessage(interaction, fresh);
      return interaction.reply({ content: "✅ Emploi mis à jour.", ephemeral: true });
    }

    if (type === "permis") {
      await updateVisa(visaId, { permis_validite: safeVal(interaction, "permis") || null });
      const fresh = await getVisaById(interaction.guildId, visaId);
      await refreshVisaMessage(interaction, fresh);
      return interaction.reply({ content: "✅ Permis mis à jour.", ephemeral: true });
    }

    if (type === "raison") {
      await updateVisa(visaId, { raison: safeVal(interaction, "raison") || null });
      const fresh = await getVisaById(interaction.guildId, visaId);
      await refreshVisaMessage(interaction, fresh);
      return interaction.reply({ content: "✅ Raison mise à jour.", ephemeral: true });
    }

    return interaction.reply({ content: "❌ Modal inconnu.", ephemeral: true });
  },
};
