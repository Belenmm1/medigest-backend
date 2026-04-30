/**
 * src/middlewares/validate.js
 * Factory de middleware de validación con Zod.
 *
 * Uso:
 *   router.post('/login', validate(loginSchema), loginController)
 */

'use strict';

const { ZodError } = require('zod');
const { createError } = require('../utils/response');

/**
 * @param {import('zod').ZodSchema} schema — schema Zod a aplicar
 * @param {'body'|'query'|'params'} target — qué parte del request validar
 */
function validate(schema, target = 'body') {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req[target]);
      // Reemplazar con datos parseados/sanitizados por Zod
      req[target] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const issues = err.issues.map(i => ({
          campo: i.path.join('.'),
          mensaje: i.message,
        }));
        return res.status(400).json(
          createError('VALIDATION_ERROR', 'Datos inválidos', { issues })
        );
      }
      next(err);
    }
  };
}

module.exports = validate;
