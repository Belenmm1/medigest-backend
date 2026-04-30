/**
 * src/services/tokenService.js
 * Gestión completa de JWT: generación, verificación, rotación y revocación.
 *
 * Estrategia:
 *  - Access token:  corto (15min), firmado con JWT_SECRET
 *  - Refresh token: largo (7d),    firmado con JWT_REFRESH_SECRET, almacenado en DB
 *  - JTI (JWT ID): UUID único por token, permite revocar tokens individuales
 *  - Blacklist en Redis: tokens revocados antes de expirar
 */

'use strict';

const jwt  = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const env  = require('../config/env');
const { blacklistToken, isBlacklisted } = require('../config/redis');
const { query } = require('../config/database');
const logger = require('../config/logger');

/**
 * Genera un access token JWT.
 * @param {Object} user — { id, rol, nombre_completo }
 * @returns {{ token, jti, expiresIn }}
 */
function generateAccessToken(user) {
  const jti = uuidv4();
  const token = jwt.sign(
    {
      sub:    user.id,
      rol:    user.rol,
      nombre: user.nombre_completo,
      jti,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
  return { token, jti };
}

/**
 * Genera un refresh token y lo persiste en la DB.
 * @param {string} userId
 * @param {string} userAgent — navegador/cliente
 * @param {string} ip
 * @returns {string} refreshToken
 */
async function generateRefreshToken(userId, userAgent = '', ip = '') {
  const jti = uuidv4();
  const token = jwt.sign(
    { sub: userId, jti, type: 'refresh' },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
  );

  // Decodificar para obtener exp real
  const decoded = jwt.decode(token);
  const expiresAt = new Date(decoded.exp * 1000);

  await query(
    `INSERT INTO refresh_tokens (id, usuario_id, token_hash, user_agent, ip, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [jti, userId, hashToken(token), userAgent, ip, expiresAt]
  );

  return token;
}

/**
 * Verifica un access token. Lanza excepción si es inválido/expirado/revocado.
 */
async function verifyAccessToken(token) {
  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    throw new TokenError(
      err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
      err.message
    );
  }

  // Verificar blacklist
  if (await isBlacklisted(decoded.jti)) {
    throw new TokenError('TOKEN_REVOKED', 'Este token fue revocado');
  }

  return decoded;
}

/**
 * Verifica un refresh token contra la DB.
 * @returns {Object} payload decodificado
 */
async function verifyRefreshToken(token) {
  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
  } catch (err) {
    throw new TokenError(
      err.name === 'TokenExpiredError' ? 'REFRESH_EXPIRED' : 'REFRESH_INVALID',
      err.message
    );
  }

  if (decoded.type !== 'refresh') {
    throw new TokenError('REFRESH_INVALID', 'Tipo de token incorrecto');
  }

  // Verificar en DB que existe y no fue revocado
  const { rows } = await query(
    `SELECT id, usuario_id, revoked_at, expires_at
     FROM refresh_tokens
     WHERE id = $1 AND token_hash = $2`,
    [decoded.jti, hashToken(token)]
  );

  if (!rows[0]) {
    throw new TokenError('REFRESH_INVALID', 'Refresh token no encontrado');
  }
  if (rows[0].revoked_at) {
    // Posible reuso de token — revocar toda la familia
    logger.warn({ userId: rows[0].usuario_id }, 'ALERTA: reuso de refresh token detectado');
    await revokeAllUserTokens(rows[0].usuario_id);
    throw new TokenError('REFRESH_REVOKED', 'Refresh token ya fue utilizado — sesión cerrada por seguridad');
  }

  return { decoded, dbRecord: rows[0] };
}

/**
 * Rota el refresh token: revoca el anterior, genera uno nuevo.
 * Implementa la estrategia de Refresh Token Rotation.
 */
async function rotateRefreshToken(oldToken, userId, userAgent, ip) {
  const { decoded } = await verifyRefreshToken(oldToken);

  // Revocar el token anterior en DB
  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`,
    [decoded.jti]
  );

  // Emitir nuevo par de tokens
  const User = require('../models/User');
  const user = await User.findById(userId);
  const { token: accessToken } = generateAccessToken(user);
  const newRefreshToken = await generateRefreshToken(userId, userAgent, ip);

  return { accessToken, refreshToken: newRefreshToken };
}

/**
 * Revoca un access token específico (lo mete en blacklist hasta su expiración).
 * @param {string} jti     — JWT ID del token
 * @param {number} expTime — timestamp unix de expiración
 */
async function revokeAccessToken(jti, expTime) {
  const ttl = Math.max(0, expTime - Math.floor(Date.now() / 1000));
  if (ttl > 0) {
    await blacklistToken(jti, ttl);
  }
}

/**
 * Revoca todos los refresh tokens de un usuario (logout global / breach).
 */
async function revokeAllUserTokens(userId) {
  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE usuario_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
}

/**
 * Hash simple del token para almacenar en DB (no se guarda el token crudo).
 * En producción usar crypto.createHash('sha256').
 */
function hashToken(token) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Error tipado para manejo centralizado.
 */
class TokenError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TokenError';
    this.code = code;
  }
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  rotateRefreshToken,
  revokeAccessToken,
  revokeAllUserTokens,
  TokenError,
};
