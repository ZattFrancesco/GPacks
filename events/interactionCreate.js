// events/interactionCreate.js
const logger = require("../src/utils/logger");

const handleButton = require("../handlers/buttonHandler");
const handleModal = require("../handlers/modalHandler");
const handleSelect = require("../handlers/selectMenuHandler");
const handleAuto = require("../handlers/autocompleteHandler");
const handleContext = require("../handlers/contextMenuHandler");

const { checkPermsDb, deny } = require("../src/utils/permissionGuardDb");
const { isSilentMuted } = require("../services/silentMute.db");

module.exports = {
  name: "interactionCreate",
  once: false,
  async execute(client, interaction) {
    try {
      if (interaction.guildId && interaction.user && !interaction.user.bot) {
        const silentMuted = await isSilentMuted(interaction.guildId, interaction.user.id);
        if (silentMuted) {
          if (interaction.isChatInputCommand?.() || interaction.isContextMenuCommand?.()) {
            if (!interaction.deferred && !interaction.replied) {
              await interaction.deferReply().catch(() => {});
            }
            return;
          }

          if (interaction.isButton?.() || interaction.isAnySelectMenu?.()) {
            if (!interaction.deferred && !interaction.replied) {
              await interaction.deferUpdate().catch(() => {});
            }
            return;
          }

          if (interaction.isModalSubmit?.()) {
            if (!interaction.deferred && !interaction.replied) {
              await interaction.deferReply({ flags: 64 }).catch(() => {});
            }
            return;
          }

          if (interaction.isAutocomplete?.()) {
            await interaction.respond([]).catch(() => {});
            return;
          }
        }
      }

      // Blacklist globale + guard DB : on bloque TOUTES les interactions
      const inferKey = () => {
        if (interaction.isChatInputCommand?.()) return `slash:${interaction.commandName}`;
        if (interaction.isContextMenuCommand?.()) return `context:${interaction.commandName}`;
        if (interaction.isButton?.()) return `button:${interaction.customId}`;
        if (interaction.isModalSubmit?.()) return `modal:${interaction.customId}`;
        if (interaction.isAnySelectMenu?.()) return `select:${interaction.customId}`;
        if (interaction.isAutocomplete?.()) return `autocomplete:${interaction.commandName}`;
        return interaction?.customId || interaction?.commandName || null;
      };

      const pre = await checkPermsDb(interaction, inferKey());
      if (!pre.ok) return deny(interaction, pre.reason);

      // Slash
      if (interaction.isChatInputCommand()) {
        const cmd = client.commands.get(interaction.commandName);
        if (!cmd) return;
        return cmd.execute(interaction, client);
      }

      // Context menu
      if (interaction.isContextMenuCommand()) {
        if (typeof handleContext === "function") return handleContext(client, interaction);
        const cmd = client.commands.get(interaction.commandName);
        if (!cmd) return;
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
      try {
        if (!interaction.isAutocomplete?.() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: "❌ Erreur interne.", flags: 64 });
        }
      } catch {}
    }
  },
};