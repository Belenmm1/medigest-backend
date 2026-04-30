/**
 * src/routes/camas.routes.js
 */

'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/camasController');
const { authenticate, authorize } = require('../middlewares/auth');

const router = Router();

router.get('/',      authenticate, authorize('admin','medico','enfermeria','recepcion'), ctrl.listar);
router.patch('/:id', authenticate, authorize('admin','medico','enfermeria'), ctrl.actualizar);

module.exports = router;
