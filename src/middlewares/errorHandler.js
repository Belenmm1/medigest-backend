/**
 * src/middlewares/errorHandler.js
 * Manejador centralizado de errores no capturados.
 * Siempre devuelve el mismo formato { data, meta, error }.
 */

'use strict';

const logger = require('../config/logger');
const { createError } = require('../utils/response');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Errores de pg (base de datos)
  if (err.code && err.code.startsWith('23')) {
    const pgErrors = {
      '23505': { status: 409, code: 'DUPLICATE_ENTRY',    msg: 'Ya existe un registro con esos datos' },
      '23503': { status: 400, code: 'FOREIGN_KEY_ERROR',  msg: 'Referencia a registro inexistente' },
      '23502': { status: 400, code: 'NULL_VIOLATION',     msg: 'Campo obligatorio faltante' },
    };
    const mapped = pgErrors[err.code];
    if (mapped) {
      return res.status(mapped.status).json(createError(mapped.code, mapped.msg));
    }
  }

  // Errores de sintaxis JSON en body
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json(createError('INVALID_JSON', 'El body no es JSON válido'));
  }

  // Error genérico — no exponer detalles en producción
  logger.error({ err, path: req.path, method: req.method }, 'Error no manejado');

  const isDev = process.env.NODE_ENV === 'development';

  return res.status(err.status || 500).json(
    createError(
      err.code || 'INTERNAL_ERROR',
      isDev ? err.message : 'Error interno del servidor',
      isDev ? { stack: err.stack } : null
    )
  );
}

module.exports = errorHandler;
