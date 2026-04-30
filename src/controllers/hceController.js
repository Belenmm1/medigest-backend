/**
 * src/controllers/hceController.js
 * Exportación de Historia Clínica Electrónica en PDF.
 *
 * GET /api/pacientes/:id/hce/pdf
 *   — Requiere rol: medico o admin
 *   — Registra en auditoria_accesos (accion: exportar)
 */

'use strict';

const { query }      = require('../config/database');
const { generarPDF } = require('../services/pdfService');
const Auditoria      = require('../models/Auditoria');
const { createError }= require('../utils/response');
const logger         = require('../config/logger');

async function exportarHCE(req, res) {
  const pacienteId = req.params.id;

  try {
    // 1. Cargar datos del paciente
    const { rows: pacRows } = await query(
      `SELECT * FROM pacientes WHERE id = $1 AND deleted_at IS NULL`,
      [pacienteId]
    );

    if (!pacRows[0]) {
      return res.status(404).json(createError('NOT_FOUND', 'Paciente no encontrado'));
    }
    const paciente = pacRows[0];

    // 2. Medicación activa
    const { rows: medicacion } = await query(
      `SELECT farmaco, dosis, frecuencia,
              TO_CHAR(inicio, 'DD/MM/YYYY') AS inicio,
              TO_CHAR(fin,    'DD/MM/YYYY') AS fin,
              notas
       FROM medicaciones
       WHERE paciente_id = $1 AND activo = true
       ORDER BY farmaco`,
      [pacienteId]
    );

    // 3. Evoluciones (últimas 30)
    const { rows: evoluciones } = await query(
      `SELECT e.*,
              TO_CHAR(e.created_at, 'DD/MM/YYYY HH24:MI') AS fecha_fmt,
              u.nombre_completo AS medico_nombre,
              u.especialidad    AS medico_especialidad
       FROM evoluciones e
       JOIN usuarios u ON u.id = e.medico_id
       WHERE e.paciente_id = $1
       ORDER BY e.created_at DESC
       LIMIT 30`,
      [pacienteId]
    );

    // 4. Generar PDF
    const pdfBuffer = await generarPDF({
      paciente,
      evoluciones,
      medicacion,
      exportadoPor: req.user.nombre || req.user.id,
    });

    // 5. Registrar auditoría (asíncrono, no bloquea)
    setImmediate(() => {
      Auditoria.registrar({
        usuario_id:  req.user.id,
        paciente_id: pacienteId,
        accion:      'exportar',
        recurso:     `GET /api/pacientes/${pacienteId}/hce/pdf`,
        ip:          req.ip,
        dispositivo: req.headers['user-agent'],
        detalles:    { formato: 'pdf', evoluciones: evoluciones.length },
      }).catch(err => logger.error({ err }, 'Error al registrar auditoría de exportación'));
    });

    // 6. Responder con el PDF
    const fecha     = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename  = `HCE_${paciente.dni}_${fecha}.pdf`;

    res.setHeader('Content-Type',        'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length',      pdfBuffer.length);
    res.setHeader('Cache-Control',       'no-store');

    return res.send(pdfBuffer);

  } catch (err) {
    logger.error({ err }, 'Error al generar PDF de HCE');
    return res.status(500).json(
      createError('PDF_ERROR', 'No se pudo generar el PDF. Intentá de nuevo.')
    );
  }
}

module.exports = { exportarHCE };
