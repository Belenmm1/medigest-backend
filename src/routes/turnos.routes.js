/**
 * src/routes/turnos.routes.js
 */

'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/turnosController');
const { authenticate, authorize } = require('../middlewares/auth');

const router = Router();

// Agenda (admin, médico, recepción, enfermería)
router.get('/',       authenticate, authorize('admin','medico','enfermeria','recepcion'), ctrl.listar);
router.get('/semana', authenticate, authorize('admin','medico','enfermeria','recepcion'), ctrl.semana);

// Crear turno (recepción y admin)
router.post('/',      authenticate, authorize('admin','recepcion','medico'), ctrl.crear);

// Cambiar estado (médico y enfermería en el flujo, admin para todo)
router.patch('/:id/estado', authenticate, authorize('admin','medico','enfermeria','recepcion'), ctrl.cambiarEstado);

// Cancelar (recepción, médico y admin)
router.delete('/:id', authenticate, authorize('admin','recepcion','medico'), ctrl.cancelar);

module.exports = router;
