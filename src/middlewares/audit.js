/**
 * src/middlewares/audit.js
 * Middleware de auditoría automática para accesos a datos de pacientes.
 *
 * Uso:
 *   router.get('/pacientes/:id', authenticate, auditLog('ver'), handler)
 */

'use strict';

const Auditoria = require('../models/Auditoria');
const logger    = require('../config/logger');

/**
 * Crea un middleware que registra automáticamente la acción en auditoria_accesos.
 *
 * @param {'ver'|'crear'|'modificar'|'exportar'|'eliminar'} accion
 * @param {Function}   getPacienteId — fn(req) → uuid | null, default: req.params.id
 */
function auditLog(accion, getPacienteId) {
  return async (req, _res, next) => {
    // El registro se hace de forma asíncrona sin bloquear la respuesta
    setImmediate(async () => {
      try {
        const paciente_id = getPacienteId
          ? getPacienteId(req)
          : req.params.id || null;

        await Auditoria.registrar({
          usuario_id:  req.user?.id,
          paciente_id: paciente_id || null,
          accion,
          recurso:     `${req.method} ${req.path}`,
          ip:          req.ip,
          dispositivo: req.headers['user-agent'],
          detalles:    req.method !== 'GET'
            ? { body: sanitizeBody(req.body) }
            : null,
        });
      } catch (err) {
        // El fallo de auditoría no debe interrumpir la operación principal
        logger.error({ err }, 'Error al registrar auditoría');
      }
    });
    next();
  };
}

/** Elimina campos sensibles antes de loguear el body. */
function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return body;
  const safe = { ...body };
  for (const k of ['password', 'password_hash', 'token', 'refreshToken']) {
    if (k in safe) safe[k] = '[REDACTED]';
  }
  return safe;
}

module.exports = { auditLog };
