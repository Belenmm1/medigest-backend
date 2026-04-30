/**
 * src/controllers/camasController.js
 * Estado de camas / internación.
 */

'use strict';

const Cama = require('../models/Cama');
const { actualizarCamaSchema } = require('../validations/core.validations');
const { createSuccess, createError } = require('../utils/response');
const logger = require('../config/logger');

/* ── GET /api/camas ────────────────────────────────────────────────── */
async function listar(req, res) {
  try {
    const { sector, estado } = req.query;
    const result = await Cama.findAll({ sector, estado });
    return res.json(createSuccess(result));
  } catch (err) {
    logger.error({ err }, 'Error en listar camas');
    return res.status(500).json(createError('INTERNAL_ERROR', 'Error interno'));
  }
}

/* ── PATCH /api/camas/:id ───────────────────────────────────────────── */
async function actualizar(req, res) {
  try {
    const parsed = actualizarCamaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json(
        createError('VALIDATION_ERROR', 'Datos inválidos', parsed.error.flatten().fieldErrors)
      );
    }

    const cama = await Cama.update(req.params.id, parsed.data);
    if (!cama) {
      return res.status(404).json(createError('NOT_FOUND', 'Cama no encontrada'));
    }

    return res.json(createSuccess(cama));
  } catch (err) {
    logger.error({ err }, 'Error al actualizar cama');
    return res.status(500).json(createError('INTERNAL_ERROR', 'Error interno'));
  }
}

module.exports = { listar, actualizar };
