const { getType, updateType } = require("../services/tickets.db");
const { buildTypeEditView } = require("../src/utils/ticketTypeEditView");

module.exports = {
  idPrefix: "tickettype:edit:toggle:",

  async execute(interaction) {
    const guildId = interaction.guildId;
    // tickettype:edit:toggle:<typeId>:namemodalrename:1
    const parts = String(interaction.customId).split(":");
    const typeId = parts[3];
    const key = parts[4];
    const value = parts[5];

    const type = await getType(guildId, typeId);
    if (!type) return interaction.reply({ content: "❌ Type introuvable.", flags: 64 });

    if (key === "namemodalrename") {
      const v = value === "1" ? 1 : 0;
      await updateType(guildId, type.id, { namemodalrename: v });
      const fresh = await getType(guildId, type.id);
      const view = buildTypeEditView(interaction.guild, fresh);
      return interaction.update({ ...view });
    }

    if (key === "openping") {
      // value "0" => disable
      const v = value && value !== "0" ? String(value) : null;
      await updateType(guildId, type.id, { open_ping_role_id: v });
      const fresh = await getType(guildId, type.id);
      const view = buildTypeEditView(interaction.guild, fresh);
      return interaction.update({ ...view });
    }

    return interaction.reply({ content: "❌ Action inconnue.", flags: 64 });
  },
};
