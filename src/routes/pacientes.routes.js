/**
 * src/routes/pacientes.routes.js
 * Rutas de pacientes y sus evoluciones.
 *
 * Permisos:
 *   admin    → todo
 *   medico   → todo (evoluciones: solo crear propias)
 *   enfermeria → GET pacientes (sin historial clínico)
 *   recepcion  → GET y POST pacientes (sin evoluciones)
 */

'use strict';

const { Router } = require('express');
const ctrl   = require('../controllers/pacientesController');
const { authenticate, authorize } = require('../middlewares/auth');
const { auditLog } = require('../middlewares/audit');

const router = Router();

// Todos los roles autenticados pueden listar
router.get(
  '/',
  authenticate,
  authorize('admin', 'medico', 'enfermeria', 'recepcion'),
  ctrl.listar
);

// Detalle: solo roles clínicos (no recepción sin contexto médico)
router.get(
  '/:id',
  authenticate,
  authorize('admin', 'medico', 'enfermeria', 'recepcion'),
  auditLog('ver'),
  ctrl.obtener
);

// Crear: admin y recepción
router.post(
  '/',
  authenticate,
  authorize('admin', 'recepcion', 'medico'),
  auditLog('crear', () => null),
  ctrl.crear
);

// Actualizar: admin y médico
router.put(
  '/:id',
  authenticate,
  authorize('admin', 'medico'),
  auditLog('modificar'),
  ctrl.actualizar
);

// Evoluciones — listar: médico, enfermería, admin
router.get(
  '/:id/evoluciones',
  authenticate,
  authorize('admin', 'medico', 'enfermeria'),
  auditLog('ver'),
  ctrl.listarEvoluciones
);

// Evoluciones — crear: solo médico y admin
router.post(
  '/:id/evoluciones',
  authenticate,
  authorize('admin', 'medico'),
  auditLog('crear'),
  ctrl.crearEvolucion
);

module.exports = router;
