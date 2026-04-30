/**
 * src/config/env.js
 * Valida todas las variables de entorno al arrancar.
 * Si falta alguna crítica, el proceso termina con error descriptivo.
 */

'use strict';

const { cleanEnv, str, num, bool, url } = require('envalid');

const env = cleanEnv(process.env, {
  // Servidor
  NODE_ENV:  str({ choices: ['development', 'test', 'production'], default: 'development' }),
  PORT:      num({ default: 3000 }),
  HOST:      str({ default: '0.0.0.0' }),

  // PostgreSQL
  DB_HOST:     str({ default: 'localhost' }),
  DB_PORT:     num({ default: 5432 }),
  DB_NAME:     str(),
  DB_USER:     str(),
  DB_PASSWORD: str(),
  DB_POOL_MIN: num({ default: 2 }),
  DB_POOL_MAX: num({ default: 10 }),
  DB_SSL:      bool({ default: false }),

  // Redis
  REDIS_HOST:     str({ default: 'localhost' }),
  REDIS_PORT:     num({ default: 6379 }),
  REDIS_PASSWORD: str({ default: '' }),
  REDIS_DB:       num({ default: 0 }),

  // JWT
  JWT_SECRET:          str({ minLength: 32 }),
  JWT_REFRESH_SECRET:  str({ minLength: 32 }),
  JWT_EXPIRES_IN:      str({ default: '15m' }),
  JWT_REFRESH_EXPIRES_IN: str({ default: '7d' }),

  // Seguridad
  BCRYPT_ROUNDS:        num({ default: 12 }),
  RATE_LIMIT_WINDOW_MS: num({ default: 900000 }),
  RATE_LIMIT_MAX_LOGIN: num({ default: 10 }),
  RATE_LIMIT_MAX_GLOBAL:num({ default: 200 }),

  // CORS
  CORS_ORIGINS: str({ default: 'http://localhost:8080' }),

  // Logs
  LOG_LEVEL: str({ choices: ['fatal','error','warn','info','debug','trace'], default: 'info' }),

  // Notificaciones
  NOTIFICATION_QUEUE_CONCURRENCY: num({ default: 5 }),

  // App
  APP_URL: str({ default: 'http://localhost:3000' }),
});

module.exports = env;
