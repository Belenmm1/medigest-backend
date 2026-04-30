/**
 * src/middlewares/rateLimiter.js
 * Rate limiters con express-rate-limit.
 *
 * - loginLimiter:  10 intentos cada 15 min por IP → protege contra fuerza bruta
 * - globalLimiter: 200 req cada 15 min por IP → protege contra scraping/DDoS
 * - apiLimiter:    60 req/min para endpoints de alta frecuencia (real-time)
 */

'use strict';

const rateLimit = require('express-rate-limit');
const env       = require('../config/env');
const { createError } = require('../utils/response');

/**
 * Handler compartido para cuando se supera el límite.
 */
function rateLimitHandler(req, res) {
  res.status(429).json(
    createError(
      'RATE_LIMIT_EXCEEDED',
      'Demasiadas solicitudes. Intentá de nuevo en unos minutos.',
      {
        retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
      }
    )
  );
}

/**
 * Limiter para /auth/login — muy estricto.
 */
const loginLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS, // 15 minutos
  max:      env.RATE_LIMIT_MAX_LOGIN,  // 10 intentos
  keyGenerator: (req) => {
    // Limitar por IP + email (así un atacante no bloquea a todos)
    const email = req.body?.email || '';
    return `${req.ip}_${email.toLowerCase()}`;
  },
  handler:          rateLimitHandler,
  standardHeaders:  true,
  legacyHeaders:    false,
  skipSuccessfulRequests: true, // No contar logins exitosos
});

/**
 * Limiter global — aplicado a todas las rutas.
 */
const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max:      env.RATE_LIMIT_MAX_GLOBAL,
  handler:  rateLimitHandler,
  standardHeaders: true,
  legacyHeaders:   false,
  skip: (req) => {
    // Skip health checks
    return req.path === '/health';
  },
});

/**
 * Limiter para refresh token — previene rotación masiva.
 */
const refreshLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max:      5,
  handler:  rateLimitHandler,
  standardHeaders: true,
  legacyHeaders:   false,
});

module.exports = { loginLimiter, globalLimiter, refreshLimiter };
