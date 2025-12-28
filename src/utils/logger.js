// src/utils/logger.js
function now() {
  return new Date().toISOString().replace("T", " ").split(".")[0];
}

function log(level, msg) {
  console.log(`[${now()}] [${level}] ${msg}`);
}

module.exports = {
  info: (m) => log("INFO", m),
  warn: (m) => log("WARN", m),
  error: (m) => log("ERROR", m),
};