/**
 * src/index.js
 * Entry point del servidor.
 * Inicializa conexiones, arranca Express y maneja shutdown graceful.
 */

'use strict';

// Cargar variables de entorno primero
require('dotenv').config();

const env    = require('./config/env');
const logger = require('./config/logger');
const app    = require('./app');

let server;

async function start() {
  try {
    // 1. Verificar conexión a PostgreSQL
    const db = require('./config/database');
    await db.healthCheck();
    logger.info('✅ PostgreSQL conectado');

    // 2. Conectar Redis
    const { redis } = require('./config/redis');
    await redis.connect();
    logger.info('✅ Redis conectado');

    // 3. Arrancar servidor HTTP
    server = app.listen(env.PORT, env.HOST, () => {
      logger.info(
        { port: env.PORT, host: env.HOST, env: env.NODE_ENV },
        `🚀 MediGest Pro API corriendo en http://${env.HOST}:${env.PORT}`
      );
    });

    // 4. WebSocket (Socket.IO) — se añade cuando se implemente el módulo real-time
    // const { initSocket } = require('./config/socket');
    // initSocket(server);

  } catch (err) {
    logger.fatal({ err }, 'Error fatal al iniciar el servidor');
    process.exit(1);
  }
}

/* ─── GRACEFUL SHUTDOWN ──────────────────────────────────────────── */

async function shutdown(signal) {
  logger.info({ signal }, 'Señal de cierre recibida — apagado graceful iniciando...');

  if (server) {
    server.close(async () => {
      try {
        const { pool } = require('./config/database');
        const { redis } = require('./config/redis');
        await pool.end();
        await redis.quit();
        logger.info('🛑 Servidor cerrado correctamente');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error durante el shutdown');
        process.exit(1);
      }
    });

    // Forzar cierre si tarda más de 10s
    setTimeout(() => {
      logger.warn('Timeout de shutdown — forzando cierre');
      process.exit(1);
    }, 10_000);
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandledRejection — cerrando proceso');
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaughtException — cerrando proceso');
  process.exit(1);
});

start();
