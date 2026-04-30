/**
 * src/routes/hce.routes.js
 * Ruta de exportación PDF de Historia Clínica.
 * Se monta sobre /api/pacientes (junto a pacientes.routes.js).
 */

'use strict';

const { Router } = require('express');
const { exportarHCE } = require('../controllers/hceController');
const { authenticate, authorize } = require('../middlewares/auth');

const router = Router({ mergeParams: true });

// GET /api/pacientes/:id/hce/pdf
router.get(
  '/:id/hce/pdf',
  authenticate,
  authorize('admin', 'medico'),
  exportarHCE
);

module.exports = router;
