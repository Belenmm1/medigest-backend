/**
 * src/config/database.js
 * Pool de conexiones PostgreSQL con pg.
 * Usa variables de entorno validadas por env.js.
 */

'use strict';

const { Pool } = require('pg');
const env = require('./env');
const logger = require('./logger');

const pool = new Pool({
  host:     env.DB_HOST,
  port:     env.DB_PORT,
  database: env.DB_NAME,
  user:     env.DB_USER,
  password: env.DB_PASSWORD,
  min:      env.DB_POOL_MIN,
  max:      env.DB_POOL_MAX,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
});

pool.on('connect', () => {
  logger.debug('Nueva conexión establecida con PostgreSQL');
});

pool.on('error', (err) => {
  logger.error({ err }, 'Error inesperado en el pool de PostgreSQL');
  process.exit(1);
});

/**
 * Ejecuta una query y devuelve las filas.
 * @param {string} text    — SQL con placeholders $1, $2...
 * @param {Array}  params  — Valores para los placeholders
 * @returns {Promise<pg.QueryResult>}
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug({ query: text, duration, rows: result.rowCount }, 'Query ejecutada');
    return result;
  } catch (err) {
    logger.error({ err, query: text }, 'Error en query SQL');
    throw err;
  }
}

/**
 * Obtiene un cliente del pool para transacciones manuales.
 * IMPORTANTE: llamar a client.release() siempre al terminar.
 */
async function getClient() {
  const client = await pool.connect();
  const originalQuery = client.query.bind(client);

  // Wrapper para loguear queries dentro de transacciones
  client.query = async (text, params) => {
    const start = Date.now();
    try {
      const result = await originalQuery(text, params);
      logger.debug({ query: text, duration: Date.now() - start }, 'Query transaccional');
      return result;
    } catch (err) {
      logger.error({ err, query: text }, 'Error en query transaccional');
      throw err;
    }
  };

  return client;
}

/**
 * Ejecuta una función async dentro de una transacción.
 * Si falla, hace rollback automático.
 * @param {Function} fn — async (client) => result
 */
async function withTransaction(fn) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Verifica que la conexión a la DB funciona.
 * Usada en el health check endpoint.
 */
async function healthCheck() {
  const result = await query('SELECT NOW() AS now');
  return result.rows[0].now;
}

module.exports = { query, getClient, withTransaction, healthCheck, pool };
