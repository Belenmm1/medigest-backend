/**
 * src/routes/auth.routes.js
 * Rutas de autenticación.
 *
 * Base path: /api/auth
 */

'use strict';

const { Router } = require('express');
const controller   = require('../controllers/authController');
const { authenticate } = require('../middlewares/auth');
const { loginLimiter, refreshLimiter } = require('../middlewares/rateLimiter');
const validate     = require('../middlewares/validate');
const {
  loginSchema,
  refreshSchema,
  changePasswordSchema,
} = require('../validations/auth.validations');

const router = Router();

/**
 * POST /api/auth/login
 * Rate limited + validación de body
 */
router.post(
  '/login',
  loginLimiter,
  validate(loginSchema),
  controller.login
);

/**
 * POST /api/auth/refresh
 * Rota el refresh token — limitado para prevenir abuso
 */
router.post(
  '/refresh',
  refreshLimiter,
  controller.refresh
);

/**
 * POST /api/auth/logout
 * Requiere autenticación válida
 */
router.post(
  '/logout',
  authenticate,
  controller.logout
);

/**
 * GET /api/auth/me
 * Devuelve el usuario autenticado
 */
router.get(
  '/me',
  authenticate,
  controller.me
);

/**
 * POST /api/auth/change-password
 */
router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  controller.changePassword
);

/**
 * GET /api/auth/sessions
 * Lista sesiones activas del usuario autenticado
 */
router.get(
  '/sessions',
  authenticate,
  controller.sessions
);

module.exports = router;
