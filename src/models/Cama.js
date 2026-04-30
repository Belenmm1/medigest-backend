/**
 * src/models/Cama.js
 * Queries SQL para la tabla `camas`.
 */

'use strict';

const { query } = require('../config/database');

const Cama = {

  /** Todas las camas agrupadas por sector. */
  async findAll({ sector, estado } = {}) {
    const conditions = [];
    const params = [];

    if (sector) {
      params.push(sector);
      conditions.push(`c.sector = $${params.length}`);
    }
    if (estado) {
      params.push(estado);
      conditions.push(`c.estado = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await query(
      `SELECT c.id, c.numero, c.sector, c.piso, c.estado, c.notas, c.updated_at,
              c.paciente_id,
              p.nombre   AS paciente_nombre,
              p.apellido AS paciente_apellido,
              p.dni      AS paciente_dni
       FROM camas c
       LEFT JOIN pacientes p ON p.id = c.paciente_id
       ${where}
       ORDER BY c.sector ASC, c.piso ASC, c.numero ASC`,
      params
    );

    // Agrupar por sector
    const sectores = {};
    for (const cama of rows) {
      if (!sectores[cama.sector]) sectores[cama.sector] = [];
      sectores[cama.sector].push(cama);
    }

    return { camas: rows, sectores };
  },

  /** Busca una cama por ID. */
  async findById(id) {
    const { rows } = await query(
      `SELECT c.*, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido
       FROM camas c
       LEFT JOIN pacientes p ON p.id = c.paciente_id
       WHERE c.id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  /** Actualiza estado y/o paciente asignado. */
  async update(id, { estado, paciente_id, notas }) {
    const updates = ['updated_at = NOW()'];
    const params  = [];

    if (estado !== undefined) {
      params.push(estado);
      updates.push(`estado = $${params.length}`);
    }
    if (paciente_id !== undefined) {
      params.push(paciente_id);
      updates.push(`paciente_id = $${params.length}`);
    }
    if (notas !== undefined) {
      params.push(notas);
      updates.push(`notas = $${params.length}`);
    }

    params.push(id);
    const { rows } = await query(
      `UPDATE camas SET ${updates.join(', ')}
       WHERE id = $${params.length}
       RETURNING *`,
      params
    );
    return rows[0] || null;
  },
};

module.exports = Cama;
