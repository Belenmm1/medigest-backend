/**
 * src/controllers/turnosController.js
 * CRUD de turnos con validación de estado y solapamiento.
 */

'use strict';

const Turno = require('../models/Turno');
const { crearTurnoSchema, cambiarEstadoTurnoSchema } = require('../validations/core.validations');
const { createSuccess, createError, createPaginated, parsePagination } = require('../utils/response');
const logger = require('../config/logger');

/* ── GET /api/turnos ───────────────────────────────────────────────── */
async function listar(req, res) {
  try {
    const { fecha, medico_id, estado } = req.query;
    const { page, limit } = parsePagination(req.query);

    // Médico solo puede ver sus propios turnos (admin/recepción ven todos)
    const filtroMedico = req.user.rol === 'medico' ? req.user.id : medico_id;

    const result = await Turno.findAll({ fecha, medico_id: filtroMedico, estado, page, limit });
    return res.json(createPaginated(result.data, result.meta));
  } catch (err) {
    logger.error({ err }, 'Error en listar turnos');
    return res.status(500).json(createError('INTERNAL_ERROR', 'Error interno'));
  }
}

/* ── GET /api/turnos/semana ─────────────────────────────────────────── */
async function semana(req, res) {
  try {
    const { offset, medico_id } = req.query;
    const filtroMedico = req.user.rol === 'medico' ? req.user.id : medico_id;

    const turnos = await Turno.findSemana({ offset, medico_id: filtroMedico });
    return res.json(createSuccess(turnos));
  } catch (err) {
    logger.error({ err }, 'Error en agenda semanal');
    return res.status(500).json(createError('INTERNAL_ERROR', 'Error interno'));
  }
}

/* ── POST /api/turnos ──────────────────────────────────────────────── */
async function crear(req, res) {
  try {
    const parsed = crearTurnoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json(
        createError('VALIDATION_ERROR', 'Datos inválidos', parsed.error.flatten().fieldErrors)
      );
    }

    const turno = await Turno.create({
      ...parsed.data,
      creado_por_id: req.user.id,
    });

    return res.status(201).json(createSuccess(turno));
  } catch (err) {
    if (err.message?.includes('TURNO_SOLAPADO')) {
      return res.status(409).json(
        createError('TURNO_SOLAPADO', 'El médico ya tiene un turno en ese horario')
      );
    }
    logger.error({ err }, 'Error al crear turno');
    return res.status(500).json(createError('INTERNAL_ERROR', 'Error interno'));
  }
}

/* ── PATCH /api/turnos/:id/estado ───────────────────────────────────── */
async function cambiarEstado(req, res) {
  try {
    const parsed = cambiarEstadoTurnoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json(
        createError('VALIDATION_ERROR', 'Estado inválido', parsed.error.flatten().fieldErrors)
      );
    }

    const turno = await Turno.cambiarEstado(req.params.id, parsed.data.estado, req.user.id);
    if (!turno) {
      return res.status(404).json(createError('NOT_FOUND', 'Turno no encontrado'));
    }

    return res.json(createSuccess(turno));
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(422).json(createError(err.code, err.message));
    }
    logger.error({ err }, 'Error al cambiar estado de turno');
    return res.status(500).json(createError('INTERNAL_ERROR', 'Error interno'));
  }
}

/* ── DELETE /api/turnos/:id ─────────────────────────────────────────── */
async function cancelar(req, res) {
  try {
    const turno = await Turno.softDelete(req.params.id);
    if (!turno) {
      return res.status(404).json(createError('NOT_FOUND', 'Turno no encontrado'));
    }
    return res.json(createSuccess(null, { message: 'Turno cancelado' }));
  } catch (err) {
    logger.error({ err }, 'Error al cancelar turno');
    return res.status(500).json(createError('INTERNAL_ERROR', 'Error interno'));
  }
}

module.exports = { listar, semana, crear, cambiarEstado, cancelar };
