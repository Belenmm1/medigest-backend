/**
 * src/middlewares/auth.js
 * Middlewares de autenticación y autorización por rol.
 *
 * Uso:
 *   router.get('/ruta', authenticate, authorize('admin', 'medico'), handler)
 */

'use strict';

const { verifyAccessToken, TokenError } = require('../services/tokenService');
const { createError } = require('../utils/response');
const logger = require('../config/logger');

/**
 * authenticate — verifica el JWT en el header Authorization.
 * Si es válido, adjunta el payload a req.user.
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(
        createError('AUTH_REQUIRED', 'Se requiere token de autenticación')
      );
    }

    const token = authHeader.slice(7); // Remover "Bearer "
    const payload = await verifyAccessToken(token);

    req.user = {
      id:     payload.sub,
      rol:    payload.rol,
      nombre: payload.nombre,
      jti:    payload.jti,
      exp:    payload.exp,
    };

    next();
  } catch (err) {
    if (err instanceof TokenError) {
      const statusMap = {
        TOKEN_EXPIRED: 401,
        TOKEN_INVALID: 401,
        TOKEN_REVOKED: 401,
      };
      return res.status(statusMap[err.code] || 401).json(
        createError(err.code, err.message)
      );
    }

    logger.error({ err }, 'Error inesperado en middleware authenticate');
    return res.status(500).json(createError('INTERNAL_ERROR', 'Error interno'));
  }
}

/**
 * authorize — verifica que el usuario tenga al menos uno de los roles permitidos.
 *
 * @param {...string} roles — roles permitidos ('admin', 'medico', 'enfermeria', 'recepcion')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(createError('AUTH_REQUIRED', 'No autenticado'));
    }

    if (!roles.includes(req.user.rol)) {
      logger.warn({
        userId: req.user.id,
        rol:    req.user.rol,
        required: roles,
        path:   req.path,
      }, 'Acceso denegado por rol insuficiente');

      return res.status(403).json(
        createError(
          'FORBIDDEN',
          `Acceso restringido. Se requiere rol: ${roles.join(' o ')}`
        )
      );
    }

    next();
  };
}

/**
 * optionalAuth — como authenticate, pero no falla si no hay token.
 * Útil para rutas públicas que se enriquecen si hay sesión.
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const payload = await verifyAccessToken(token);
      req.user = {
        id:     payload.sub,
        rol:    payload.rol,
        nombre: payload.nombre,
        jti:    payload.jti,
        exp:    payload.exp,
      };
    }
  } catch {
    // Ignorar — la ruta es pública
  }
  next();
}

/**
 * selfOrAdmin — permite acceso solo al propio usuario o a un admin.
 * Requiere que el ID de recurso esté en req.params.id
 */
function selfOrAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json(createError('AUTH_REQUIRED', 'No autenticado'));
  }

  if (req.user.rol === 'admin' || req.user.id === req.params.id) {
    return next();
  }

  return res.status(403).json(
    createError('FORBIDDEN', 'Solo podés modificar tu propia cuenta')
  );
}

module.exports = { authenticate, authorize, optionalAuth, selfOrAdmin };
