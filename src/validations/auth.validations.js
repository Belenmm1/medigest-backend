/**
 * src/validations/auth.validations.js
 * Schemas Zod para validar el body de los endpoints de autenticación.
 */

'use strict';

const { z } = require('zod');

const loginSchema = z.object({
  email: z
    .string({ required_error: 'El email es obligatorio' })
    .email('Formato de email inválido')
    .max(255),
  password: z
    .string({ required_error: 'La contraseña es obligatoria' })
    .min(1, 'La contraseña no puede estar vacía'),
});

const refreshSchema = z.object({
  refreshToken: z
    .string({ required_error: 'El refreshToken es obligatorio' })
    .min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Contraseña actual requerida'),
  newPassword: z
    .string()
    .min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Debe contener al menos una mayúscula, una minúscula y un número'
    ),
});

const createUserSchema = z.object({
  nombre_completo: z.string().min(3).max(120),
  email: z.string().email().max(255),
  password: z.string().min(8).regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Debe contener al menos una mayúscula, una minúscula y un número'
  ),
  rol: z.enum(['admin', 'medico', 'enfermeria', 'recepcion']),
  especialidad: z.string().max(100).optional(),
});

module.exports = {
  loginSchema,
  refreshSchema,
  changePasswordSchema,
  createUserSchema,
};
