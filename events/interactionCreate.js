// events/interactionCreate.js
const logger = require("../src/utils/logger");

const handleButton = require("../handlers/buttonHandler");
const handleModal = require("../handlers/modalHandler");
const handleSelect = require("../handlers/selectMenuHandler");
const handleAuto = require("../handlers/autocompleteHandler");
const handleContext = require("../handlers/contextMenuHandler");

const { checkPermsDb, deny } = require("../src/utils/permissionGuardDb");

module.exports = {
  name: "interactionCreate",
  once: false,
  async execute(client, interaction) {
    try {
      // Slash
      if (interaction.isChatInputCommand()) {
        const cmd = client.commands.get(interaction.commandName);
        if (!cmd) return;

        const itemKey = `slash:${interaction.commandName}`;
        const res = await checkPermsDb(interaction, itemKey);
        if (!res.ok) return deny(interaction, res.reason);

        return cmd.execute(interaction, client);
      }

      // Context menu
      if (interaction.isContextMenuCommand()) {
        // si tu as un handler dédié
        if (typeof handleContext === "function") return handleContext(client, interaction);

        const cmd = client.commands.get(interaction.commandName);
        if (!cmd) return;

        const itemKey = `context:${interaction.commandName}`;
        const res = await checkPermsDb(interaction, itemKey);
        if (!res.ok) return deny(interaction, res.reason);

        return cmd.execute(interaction, client);
      }

      // Autocomplete
      if (interaction.isAutocomplete()) return handleAuto(client, interaction);

      // Buttons
      if (interaction.isButton()) return handleButton(client, interaction);

      // Select menus
      if (interaction.isAnySelectMenu()) return handleSelect(client, interaction);

      // Modals
      if (interaction.isModalSubmit()) return handleModal(client, interaction);
    } catch (err) {
      logger.error(`interactionCreate error: ${err?.stack || err}`);
      // on évite de spammer si déjà répondu
      try {
        if (!interaction.isAutocomplete?.() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: "❌ Erreur interne.", ephemeral: true });
        }
      } catch {}
    }
  },
};