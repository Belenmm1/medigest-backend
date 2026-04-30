/**
 * src/config/redis.js
 * Cliente Redis con ioredis.
 * Usado para: cache de sesiones, blacklist de tokens, Bull queues.
 */

'use strict';

const Redis = require('ioredis');
const env = require('./env');
const logger = require('./logger');

const redisConfig = {
  host:           env.REDIS_HOST,
  port:           env.REDIS_PORT,
  db:             env.REDIS_DB,
  retryStrategy: (times) => {
    if (times > 10) {
      logger.error('Redis: demasiados reintentos, abandonando conexión');
      return null; // No reintentar más
    }
    const delay = Math.min(times * 200, 3000);
    logger.warn({ times, delay }, 'Redis: reintentando conexión...');
    return delay;
  },
  lazyConnect: true, // Conectar explícitamente
};

if (env.REDIS_PASSWORD) {
  redisConfig.password = env.REDIS_PASSWORD;
}

const redis = new Redis(redisConfig);

redis.on('connect', () => logger.info('Conectado a Redis'));
redis.on('error',   (err) => logger.error({ err }, 'Error en Redis'));
redis.on('close',   () => logger.warn('Conexión Redis cerrada'));

/**
 * Guarda un valor con TTL en segundos.
 */
async function set(key, value, ttlSeconds) {
  const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (ttlSeconds) {
    return redis.set(key, serialized, 'EX', ttlSeconds);
  }
  return redis.set(key, serialized);
}

/**
 * Obtiene y deserializa un valor.
 */
async function get(key) {
  const value = await redis.get(key);
  if (!value) return null;
  try { return JSON.parse(value); } catch { return value; }
}

/**
 * Elimina una clave.
 */
async function del(key) {
  return redis.del(key);
}

/**
 * Agrega un token a la blacklist (para invalidación de JWT).
 * @param {string} jti        — JWT ID único
 * @param {number} ttlSeconds — Cuántos segundos quedan hasta que expire el token
 */
async function blacklistToken(jti, ttlSeconds) {
  return redis.set(`bl:${jti}`, '1', 'EX', ttlSeconds);
}

/**
 * Verifica si un token está en la blacklist.
 */
async function isBlacklisted(jti) {
  const val = await redis.get(`bl:${jti}`);
  return val !== null;
}

/**
 * Health check de Redis.
 */
async function healthCheck() {
  const pong = await redis.ping();
  return pong === 'PONG';
}

module.exports = { redis, set, get, del, blacklistToken, isBlacklisted, healthCheck };
