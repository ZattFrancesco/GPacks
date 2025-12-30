// services/db.js
const mysql = require("mysql2/promise");
const logger = require("../src/utils/logger");

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    logger.info("Pool MySQL initialisé");
  }
  return pool;
}

async function query(sql, params = []) {
  try {
    const p = getPool();
    const [rows] = await p.execute(sql, params);
    return rows;
  } catch (err) {
    // ✅ Dump clair + complet (et maintenant visible grâce au logger multi-args)
    logger.error("===== MYSQL ERROR =====");
    logger.error("name:", err?.name);
    logger.error("code:", err?.code);
    logger.error("errno:", err?.errno);
    logger.error("message:", err?.message);
    logger.error("sqlMessage:", err?.sqlMessage);
    logger.error("sqlState:", err?.sqlState);
    logger.error("sql:", err?.sql);
    logger.error("params:", params);
    logger.error("stack:", err?.stack);
    logger.error("=======================");
    throw err;
  }
}

module.exports = {
  query,
};