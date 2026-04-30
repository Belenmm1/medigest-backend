/**
 * src/routes/auditoria.routes.js
 */

'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/auditoriaController');
const { authenticate, authorize } = require('../middlewares/auth');

const router = Router();

// Solo admin puede ver los logs de auditoría
router.get('/', authenticate, authorize('admin'), ctrl.listar);

module.exports = router;
