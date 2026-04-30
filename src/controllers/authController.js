/**
 * src/controllers/authController.js
 * Capa HTTP para autenticación.
 * Solo maneja request/response — la lógica vive en authService.
 */

'use strict';

const authService = require('../services/authService');
const { createSuccess, createError } = require('../utils/response');
const logger = require('../config/logger');

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;
    const userAgent = req.headers['user-agent'] || '';
    const ip = req.ip;

    const result = await authService.login(email, password, userAgent, ip);

    // Refresh token en cookie httpOnly (más seguro que localStorage)
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   7 * 24 * 60 * 60 * 1000, // 7 días
      path:     '/api/auth/refresh',
    });

    return res.status(200).json(
      createSuccess({
        user:        result.user,
        accessToken: result.accessToken,
        // Incluir refreshToken en body también para clientes móviles/SPA que prefieran manejarlo
        refreshToken: result.refreshToken,
      })
    );
  } catch (err) {
    if (err.name === 'AuthError') {
      return res.status(401).json(createError(err.code, err.message));
    }
    logger.error({ err }, 'Error en login');
    return res.status(500).json(createError('INTERNAL_ERROR', 'Error interno del servidor'));
  }
}

/**
 * POST /api/auth/refresh
 * Body: { refreshToken } — o cookie httpOnly
 */
async function refresh(req, res) {
  try {
    const token =
      req.body?.refreshToken ||
      req.cookies?.refreshToken;

    if (!token) {
      return res.status(401).json(createError('REFRESH_REQUIRED', 'Refresh token requerido'));
    }

    const userAgent = req.headers['user-agent'] || '';
    const ip = req.ip;

    const result = await authService.refresh(token, userAgent, ip);

    // Rotar cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   7 * 24 * 60 * 60 * 1000,
      path:     '/api/auth/refresh',
    });

    return res.status(200).json(
      createSuccess({
        accessToken:  result.accessToken,
        refreshToken: result.refreshToken,
      })
    );
  } catch (err) {
    if (err.name === 'TokenError') {
      return res.status(401).json(createError(err.code, err.message));
    }
    if (err.name === 'AuthError') {
      return res.status(401).json(createError(err.code, err.message));
    }
    logger.error({ err }, 'Error en refresh');
    return res.status(500).json(createError('INTERNAL_ERROR', 'Error interno'));
  }
}

/**
 * POST /api/auth/logout
 * Requiere: authenticate middleware
 */
async function logout(req, res) {
  try {
    const refreshToken =
      req.body?.refreshToken ||
      req.cookies?.refreshToken;

    await authService.logout(req.user, refreshToken);

    // Limpiar cookie
    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });

    return res.status(200).json(createSuccess(null, { message: 'Sesión cerrada correctamente' }));
  } catch (err) {
    logger.error({ err }, 'Error en logout');
    return res.status(500).json(createError('INTERNAL_ERROR', 'Error interno'));
  }
}

/**
 * GET /api/auth/me
 * Devuelve el usuario autenticado actual.
 */
async function me(req, res) {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json(createError('NOT_FOUND', 'Usuario no encontrado'));
    }
    return res.status(200).json(createSuccess(user));
  } catch (err) {
    logger.error({ err }, 'Error en /me');
    return res.status(500).json(createError('INTERNAL_ERROR', 'Error interno'));
  }
}

/**
 * POST /api/auth/change-password
 */
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user.id, currentPassword, newPassword);
    return res.status(200).json(
      createSuccess(null, { message: 'Contraseña actualizada. Iniciá sesión nuevamente.' })
    );
  } catch (err) {
    if (err.name === 'AuthError') {
      return res.status(err.code === 'NOT_FOUND' ? 404 : 401)
        .json(createError(err.code, err.message));
    }
    logger.error({ err }, 'Error al cambiar contraseña');
    return res.status(500).json(createError('INTERNAL_ERROR', 'Error interno'));
  }
}

/**
 * GET /api/auth/sessions
 * Lista las sesiones activas del usuario autenticado.
 */
async function sessions(req, res) {
  try {
    const activeSessions = await authService.getActiveSessions(req.user.id);
    return res.status(200).json(createSuccess(activeSessions));
  } catch (err) {
    logger.error({ err }, 'Error al obtener sesiones');
    return res.status(500).json(createError('INTERNAL_ERROR', 'Error interno'));
  }
}

module.exports = { login, refresh, logout, me, changePassword, sessions };
