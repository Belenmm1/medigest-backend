/**
 * src/utils/response.js
 * Helpers para respuestas de API consistentes.
 *
 * Formato estándar:
 *   { data, meta, error }
 *
 * - data:  payload principal (objeto, array, null)
 * - meta:  paginación, totales, timestamps
 * - error: { code, message, details? } — solo en respuestas de error
 */

'use strict';

/**
 * Respuesta exitosa.
 * @param {*}      data    — payload
 * @param {Object} meta    — metadata opcional (paginación, etc.)
 */
function createSuccess(data = null, meta = {}) {
  return { data, meta, error: null };
}

/**
 * Respuesta de error.
 * @param {string} code     — código interno legible por máquina
 * @param {string} message  — mensaje legible por humanos
 * @param {Object} details  — detalles adicionales (errores de validación, etc.)
 */
function createError(code, message, details = null) {
  return {
    data: null,
    meta: {},
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
}

/**
 * Respuesta paginada.
 * @param {Array}  items     — resultados de la página actual
 * @param {Object} pagination — { total, page, limit, totalPages }
 */
function createPaginated(items, pagination) {
  return {
    data: items,
    meta: {
      ...pagination,
      hasNext: pagination.page < pagination.totalPages,
      hasPrev: pagination.page > 1,
    },
    error: null,
  };
}

/**
 * Extrae parámetros de paginación del query string con defaults seguros.
 */
function parsePagination(query) {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

module.exports = { createSuccess, createError, createPaginated, parsePagination };
