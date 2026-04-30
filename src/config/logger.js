/**
 * src/config/logger.js
 * Logger estructurado con Pino.
 * En desarrollo usa pino-pretty para output legible.
 * En producción emite JSON puro (para ingestar en Datadog, CloudWatch, etc.)
 */

'use strict';

const pino = require('pino');

const isDev = process.env.NODE_ENV !== 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  base: {
    pid: process.pid,
    app: 'medigest-pro',
  },
  // Ocultar datos sensibles en los logs
  redact: {
    paths: [
      'req.headers.authorization',
      'body.password',
      'body.newPassword',
      '*.password',
      '*.token',
      '*.refreshToken',
    ],
    censor: '[REDACTED]',
  },
  // Formato legible sólo en desarrollo
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});

module.exports = logger;
