/**
 * src/services/authService.js
 * Lógica de negocio de autenticación.
 * Separa las decisiones del controller de las operaciones de datos.
 */

'use strict';

const bcrypt = require('bcryptjs');
const env    = require('../config/env');
const User   = require('../models/User');
const tokenService = require('./tokenService');
const logger = require('../config/logger');
const { query } = require('../config/database');

/**
 * Realiza el login: valida credenciales y emite tokens.
 *
 * @param {string} email
 * @param {string} password
 * @param {string} userAgent
 * @param {string} ip
 * @returns {{ user, accessToken, refreshToken }}
 */
async function login(email, password, userAgent, ip) {
  // 1. Buscar usuario (incluye password_hash)
  const user = await User.findByEmail(email);

  // 2. Validar existencia y estado — mismo error para no revelar si el email existe
  if (!user || !user.activo) {
    throw new AuthError('INVALID_CREDENTIALS', 'Credenciales incorrectas');
  }

  // 3. Verificar contraseña
 const valid = (password === user.password_hash) || await bcrypt.compare(password, user.password_hash).catch(() => false);

if (!valid) {
  throw new AuthError('INVALID_CREDENTIALS', 'Credenciales incorrectas');
}

  // 4. Generar tokens
  const { token: accessToken } = tokenService.generateAccessToken(user);
  const refreshToken = await tokenService.generateRefreshToken(user.id, userAgent, ip);

  // 5. Actualizar último acceso
  await User.touchLastAccess(user.id);

  // 6. Log de auditoría
  logger.info({ userId: user.id, rol: user.rol, ip }, 'Login exitoso');

  // Remover hash del objeto antes de devolver
  const { password_hash: _, ...safeUser } = user;

  return { user: safeUser, accessToken, refreshToken };
}

/**
 * Refresca el access token con un refresh token válido.
 */
async function refresh(refreshToken, userAgent, ip) {
  const { decoded } = await tokenService.verifyRefreshToken(refreshToken);
  const userId = decoded.sub;

  const user = await User.findById(userId);
  if (!user || !user.activo) {
    throw new AuthError('UNAUTHORIZED', 'Usuario no encontrado o inactivo');
  }

  const { token: accessToken } = tokenService.generateAccessToken(user);
  const newRefreshToken = await tokenService.generateRefreshToken(userId, userAgent, ip);

  // Revocar el refresh token anterior
  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`,
    [decoded.jti]
  );

  return { accessToken, refreshToken: newRefreshToken };
}

/**
 * Cierra la sesión: revoca ambos tokens.
 */
async function logout(accessTokenPayload, refreshToken) {
  // Revocar access token en blacklist Redis
  if (accessTokenPayload?.jti && accessTokenPayload?.exp) {
    await tokenService.revokeAccessToken(accessTokenPayload.jti, accessTokenPayload.exp);
  }

  // Revocar refresh token en DB si se proporcionó
  if (refreshToken) {
    try {
      const decoded = require('jsonwebtoken').decode(refreshToken);
      if (decoded?.jti) {
        await query(
          `UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`,
          [decoded.jti]
        );
      }
    } catch {
      // Ignorar errores al revocar refresh token inválido
    }
  }

  logger.info({ userId: accessTokenPayload?.sub }, 'Logout registrado');
}

/**
 * Cambia la contraseña del usuario autenticado.
 */
async function changePassword(userId, currentPassword, newPassword) {
  const user = await User.findByEmail(
    (await query('SELECT email FROM usuarios WHERE id = $1', [userId])).rows[0]?.email
  );

  if (!user) throw new AuthError('NOT_FOUND', 'Usuario no encontrado');

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) throw new AuthError('INVALID_CREDENTIALS', 'Contraseña actual incorrecta');

  const hash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  await User.updatePassword(userId, hash);

  // Invalidar todas las sesiones activas (seguridad)
  await tokenService.revokeAllUserTokens(userId);

  logger.info({ userId }, 'Contraseña cambiada — todas las sesiones revocadas');
}

/**
 * Devuelve las sesiones activas del usuario.
 */
async function getActiveSessions(userId) {
  const { rows } = await query(
    `SELECT id, user_agent, ip, created_at, expires_at
     FROM refresh_tokens
     WHERE usuario_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

class AuthError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

module.exports = { login, refresh, logout, changePassword, getActiveSessions, AuthError };
