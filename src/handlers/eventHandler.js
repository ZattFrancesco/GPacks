// src/handlers/eventHandler.js
const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");

async function loadEvents(client) {
  const eventsDir = path.join(process.cwd(), "events");
  if (!fs.existsSync(eventsDir)) return;

  const files = fs.readdirSync(eventsDir).filter((f) => f.endsWith(".js"));
  for (const file of files) {
    const event = require(path.join(eventsDir, file));
    if (!event?.name || typeof event.execute !== "function") continue;

    if (event.once) client.once(event.name, (...args) => event.execute(client, ...args));
    else client.on(event.name, (...args) => event.execute(client, ...args));

    logger.info(`Event chargé: ${event.name}`);
  }
}

module.exports = { loadEvents };