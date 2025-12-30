// src/utils/logger.js

function now() {
  return new Date().toISOString().replace("T", " ").split(".")[0];
}

function log(level, ...parts) {
  // ✅ Supporte plusieurs arguments (string, objets, erreurs, etc.)
  console.log(`[${now()}] [${level}]`, ...parts);
}

module.exports = {
  info: (...m) => log("INFO", ...m),
  warn: (...m) => log("WARN", ...m),
  error: (...m) => log("ERROR", ...m),
};