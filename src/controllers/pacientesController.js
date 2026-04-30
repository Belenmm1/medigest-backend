/**
 * src/controllers/pacientesController.js
 * CRUD de pacientes + evoluciones.
 */

'use strict';

const Paciente  = require('../models/Paciente');
const Evolucion = require('../models/Evolucion');
const { crearPacienteSchema, actualizarPacienteSchema, crearEvolucionSchema } = require('../validations/core.validations');
const { createSuccess, createError, createPaginated, parsePagination } = require('../utils/response');
const logger = require('../config/logger');

/* ── GET /api/pacientes ────────────────────────────────────────────── */
async function listar(req, res) {
  try {
    const { q, activo } = req.query;
    const { page, limit } = parsePagination(req.query);
    const activoBool = activo !== undefined
      ? activo === 'true' || activo === '1'
      : undefined;

    const result = await Paciente.findAll({ q, activo: activoBool, page, limit });
    return res.json(createPaginated(result.data, result.meta));
  } catch (err) {
    logger.error({ err }, 'Error en listar pacientes');
    return res.status(500).json(createError('INTERNAL_ERROR', 'Error interno'));
  }
}

/* ── GET /api/pacientes/:id ─────────────────────────────────────────── */
async function obtener(req, res) {
  try {
    const paciente = await Paciente.findById(req.params.id);
    if (!paciente) {
      return res.status(404).json(createError('NOT_FOUND', 'Paciente no encontrado'));
    }
    return res.json(createSuccess(paciente));
  } catch (err) {
    logger.error({ err }, 'Error en obtener paciente');
    return res.status(500).json(createError('INTERNAL_ERROR', 'Error interno'));
  }
}

/* ── POST /api/pacientes ───────────────────────────────────────────── */
async function crear(req, res) {
  try {
    const parsed = crearPacienteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json(
        createError('VALIDATION_ERROR', 'Datos inválidos', parsed.error.flatten().fieldErrors)
      );
    }

    // Verificar DNI único
    const existente = await Paciente.findByDni(parsed.data.dni);
    if (existente) {
      return res.status(409).json(
        createError('DNI_DUPLICADO', `Ya existe un paciente con el DNI ${parsed.data.dni}`)
      );
    }

    const paciente = await Paciente.create(parsed.data);
    return res.status(201).json(createSuccess(paciente));
  } catch (err) {
    logger.error({ err }, 'Error al crear paciente');
    return res.status(500).json(createError('INTERNAL_ERROR', 'Error interno'));
  }
}

/* ── PUT /api/pacientes/:id ─────────────────────────────────────────── */
async function actualizar(req, res) {
  try {
    const parsed = actualizarPacienteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json(
        createError('VALIDATION_ERROR', 'Datos inválidos', parsed.error.flatten().fieldErrors)
      );
    }

    const paciente = await Paciente.update(req.params.id, parsed.data);
    if (!paciente) {
      return res.status(404).json(createError('NOT_FOUND', 'Paciente no encontrado'));
    }
    return res.json(createSuccess(paciente));
  } catch (err) {
    logger.error({ err }, 'Error al actualizar paciente');
    return res.status(500).json(createError('INTERNAL_ERROR', 'Error interno'));
  }
}

/* ── GET /api/pacientes/:id/evoluciones ─────────────────────────────── */
async function listarEvoluciones(req, res) {
  try {
    const exists = await Paciente.findById(req.params.id);
    if (!exists) {
      return res.status(404).json(createError('NOT_FOUND', 'Paciente no encontrado'));
    }

    const { page, limit } = parsePagination(req.query);
    const result = await Evolucion.findByPaciente(req.params.id, { page, limit });
    return res.json(createPaginated(result.data, result.meta));
  } catch (err) {
    logger.error({ err }, 'Error en listar evoluciones');
    return res.status(500).json(createError('INTERNAL_ERROR', 'Error interno'));
  }
}

/* ── POST /api/pacientes/:id/evoluciones ────────────────────────────── */
async function crearEvolucion(req, res) {
  try {
    const parsed = crearEvolucionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json(
        createError('VALIDATION_ERROR', 'Datos inválidos', parsed.error.flatten().fieldErrors)
      );
    }

    const paciente = await Paciente.findById(req.params.id);
    if (!paciente) {
      return res.status(404).json(createError('NOT_FOUND', 'Paciente no encontrado'));
    }

    const evolucion = await Evolucion.create({
      ...parsed.data,
      paciente_id: req.params.id,
      medico_id:   req.user.id,
    });

    return res.status(201).json(createSuccess(evolucion));
  } catch (err) {
    logger.error({ err }, 'Error al crear evolución');
    return res.status(500).json(createError('INTERNAL_ERROR', 'Error interno'));
  }
}

module.exports = { listar, obtener, crear, actualizar, listarEvoluciones, crearEvolucion };
