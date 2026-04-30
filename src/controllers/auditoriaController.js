/**
 * src/controllers/auditoriaController.js
 * Log de auditoría con filtros.
 */

'use strict';

const Auditoria = require('../models/Auditoria');
const { createError, createPaginated, parsePagination } = require('../utils/response');
const logger = require('../config/logger');

/* ── GET /api/auditoria ─────────────────────────────────────────────── */
async function listar(req, res) {
  try {
    const { usuario_id, paciente_id, accion, desde, hasta } = req.query;
    const { page, limit } = parsePagination(req.query);

    const result = await Auditoria.findAll({
      usuario_id, paciente_id, accion, desde, hasta, page, limit,
    });

    return res.json(createPaginated(result.data, result.meta));
  } catch (err) {
    logger.error({ err }, 'Error en listar auditoría');
    return res.status(500).json(createError('INTERNAL_ERROR', 'Error interno'));
  }
}

module.exports = { listar };
