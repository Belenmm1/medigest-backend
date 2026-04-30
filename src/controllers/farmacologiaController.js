/**
 * src/controllers/farmacologiaController.js
 * Consulta de interacciones farmacológicas.
 *
 * POST /api/farmacologia/interacciones
 *   Body: { "farmacos": ["enalapril", "atorvastatina"] }
 */

'use strict';

const { z }                    = require('zod');
const { buscarInteracciones }  = require('../services/farmacologiaService');
const { createSuccess, createError } = require('../utils/response');
const logger                   = require('../config/logger');

const schema = z.object({
  farmacos: z
    .array(z.string().min(2).max(100))
    .min(2, 'Se necesitan al menos 2 fármacos')
    .max(10, 'Máximo 10 fármacos por consulta'),
});

async function interacciones(req, res) {
  try {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json(
        createError('VALIDATION_ERROR', 'Datos inválidos', parsed.error.flatten().fieldErrors)
      );
    }

    const { farmacos } = parsed.data;
    const resultado    = await buscarInteracciones(farmacos);

    return res.json(createSuccess(resultado, {
      consultados: farmacos,
      total_interacciones: resultado.interacciones.length,
      sin_datos:           resultado.sin_datos.length,
    }));

  } catch (err) {
    logger.error({ err }, 'Error en consulta de interacciones');
    return res.status(500).json(
      createError('FARMA_ERROR', 'Error al consultar interacciones farmacológicas')
    );
  }
}

module.exports = { interacciones };
