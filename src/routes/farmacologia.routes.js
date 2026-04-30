/**
 * src/routes/farmacologia.routes.js
 */

'use strict';

const { Router } = require('express');
const { interacciones } = require('../controllers/farmacologiaController');
const { authenticate, authorize } = require('../middlewares/auth');

const router = Router();

// POST /api/farmacologia/interacciones
// Solo médico y admin pueden consultar interacciones
router.post(
  '/interacciones',
  authenticate,
  authorize('admin', 'medico'),
  interacciones
);

module.exports = router;
