/**
 * src/validations/core.validations.js
 * Schemas Zod para pacientes, turnos, evoluciones y camas.
 */

'use strict';

const { z } = require('zod');

/* ─── Paciente ───────────────────────────────────────────────────────── */

const SEXOS          = ['masculino', 'femenino', 'otro'];
const GRUPOS_SANG    = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];

const crearPacienteSchema = z.object({
  nombre:           z.string().min(2).max(100),
  apellido:         z.string().min(2).max(100),
  dni:              z.string().min(6).max(20).regex(/^\d+$/, 'El DNI debe contener solo números'),
  fecha_nacimiento: z.string().refine(v => !isNaN(Date.parse(v)), 'Fecha inválida'),
  sexo:             z.enum(SEXOS),
  grupo_sanguineo:  z.enum(GRUPOS_SANG).optional(),
  obra_social:      z.string().max(120).optional(),
  nro_afiliado:     z.string().max(60).optional(),
  telefono:         z.string().max(30).optional(),
  email:            z.string().email().optional().or(z.literal('')),
  peso_kg:          z.number().min(0.5).max(600).optional(),
  talla_cm:         z.number().min(20).max(280).optional(),
  alergias:         z.string().max(2000).optional(),
  antecedentes:     z.string().max(5000).optional(),
});

const actualizarPacienteSchema = crearPacienteSchema.partial().omit({ dni: true });

/* ─── Turno ──────────────────────────────────────────────────────────── */

const ESTADOS_TURNO = ['confirmado','en_sala','en_curso','atendido','cancelado'];

const crearTurnoSchema = z.object({
  paciente_id:  z.string().uuid(),
  medico_id:    z.string().uuid(),
  especialidad: z.string().min(2).max(100),
  fecha_hora:   z.string().refine(v => !isNaN(Date.parse(v)), 'fecha_hora inválida'),
  duracion_min: z.number().int().min(10).max(240).default(30),
  notas:        z.string().max(2000).optional(),
});

const cambiarEstadoTurnoSchema = z.object({
  estado: z.enum(ESTADOS_TURNO),
});

/* ─── Evolución ──────────────────────────────────────────────────────── */

const crearEvolucionSchema = z.object({
  motivo_consulta: z.string().min(5).max(2000),
  diagnostico:     z.string().max(2000).optional(),
  ta_sistolica:    z.number().int().min(40).max(300).optional(),
  ta_diastolica:   z.number().int().min(20).max(200).optional(),
  fc_lpm:          z.number().int().min(20).max(300).optional(),
  spo2_pct:        z.number().min(50).max(100).optional(),
  temperatura:     z.number().min(30).max(45).optional(),
  peso_kg:         z.number().min(0.5).max(600).optional(),
  notas:           z.string().max(5000).optional(),
});

/* ─── Cama ───────────────────────────────────────────────────────────── */

const ESTADOS_CAMA = ['libre','ocupada','limpieza','reservada'];

const actualizarCamaSchema = z.object({
  estado:      z.enum(ESTADOS_CAMA).optional(),
  paciente_id: z.string().uuid().nullable().optional(),
  notas:       z.string().max(500).optional(),
});

module.exports = {
  crearPacienteSchema,
  actualizarPacienteSchema,
  crearTurnoSchema,
  cambiarEstadoTurnoSchema,
  crearEvolucionSchema,
  actualizarCamaSchema,
};
