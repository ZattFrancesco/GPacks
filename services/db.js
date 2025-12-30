// services/db.js
const mysql = require("mysql2/promise");
const logger = require("../src/utils/logger");

let pool = null;

function env(name, fallback) {
  const v = process.env[name];
  if (v !== undefined && v !== "") return v;
  if (fallback) {
    const f = process.env[fallback];
    if (f !== undefined && f !== "") return f;
  }
  return undefined;
}

function getPool() {
  if (!pool) {
    const host = env("DB_HOST") || "127.0.0.1";
    const port = Number(env("DB_PORT") || 3306);
    const user = env("DB_USER") || "root";
    const password = env("DB_PASSWORD", "DB_PASS"); // ✅ accepte les 2 noms
    const database = env("DB_NAME");

    logger.info("Pool MySQL initialisé", {
      host,
      port,
      user,
      database,
      hasPassword: Boolean(password),
    });

    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
}

async function query(sql, params = []) {
  try {
    const p = getPool();
    const [rows] = await p.execute(sql, params);
    return rows;
  } catch (err) {
    logger.error("===== MYSQL ERROR =====");
    logger.error("code:", err?.code);
    logger.error("message:", err?.message);
    logger.error("sqlMessage:", err?.sqlMessage);
    logger.error("sql:", err?.sql);
    logger.error("params:", params);
    logger.error("=======================");
    throw err;
  }
}

module.exports = { query };