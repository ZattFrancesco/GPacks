// src/utils/env.js
const path = require("path");
const dotenv = require("dotenv");

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  dotenv.config({ path: envPath });
}

module.exports = { loadEnv };