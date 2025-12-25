const handleButton = require("../handlers/buttonHandler");
const handleModal = require("../handlers/modalHandler");
const handleSelect = require("../handlers/selectMenuHandler");
const handleAuto = require("../handlers/autocompleteHandler");
const handleContext = require("../handlers/contextMenuHandler");

module.exports = {
  name: "interactionCreate",
  async execute(client, interaction) {

    if (interaction.isChatInputCommand()) {
      const cmd = client.commands.get(interaction.commandName);
      if (!cmd) return;
      return cmd.execute(interaction, client);
    }

    if (interaction.isContextMenuCommand()) {
      return handleContext(client, interaction);
    }

    if (interaction.isButton()) {
      return handleButton(client, interaction);
    }

    if (interaction.isAnySelectMenu()) {
      return handleSelect(client, interaction);
    }

    if (interaction.isModalSubmit()) {
      return handleModal(client, interaction);
    }

    if (interaction.isAutocomplete()) {
      return handleAuto(client, interaction);
    }
  }
};