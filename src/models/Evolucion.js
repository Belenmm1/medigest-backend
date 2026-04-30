/**
 * src/models/Evolucion.js
 * Queries SQL para la tabla `evoluciones`.
 */

'use strict';

const { query } = require('../config/database');

const Evolucion = {

  /** Lista paginada de evoluciones de un paciente. */
  async findByPaciente(pacienteId, { page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;

    const { rows } = await query(
      `SELECT e.id, e.motivo_consulta, e.diagnostico,
              e.ta_sistolica, e.ta_diastolica, e.fc_lpm,
              e.spo2_pct, e.temperatura, e.peso_kg, e.notas,
              e.created_at,
              u.nombre_completo AS medico_nombre,
              u.especialidad    AS medico_especialidad
       FROM evoluciones e
       JOIN usuarios u ON u.id = e.medico_id
       WHERE e.paciente_id = $1
       ORDER BY e.created_at DESC
       LIMIT $2 OFFSET $3`,
      [pacienteId, limit, offset]
    );

    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM evoluciones WHERE paciente_id = $1`,
      [pacienteId]
    );

    return {
      data: rows,
      meta: {
        total:      parseInt(countRows[0].count),
        page,
        limit,
        totalPages: Math.ceil(countRows[0].count / limit),
      },
    };
  },

  /** Registra una nueva evolución. */
  async create(data) {
    const {
      paciente_id, medico_id,
      motivo_consulta, diagnostico,
      ta_sistolica, ta_diastolica, fc_lpm,
      spo2_pct, temperatura, peso_kg, notas,
    } = data;

    const { rows } = await query(
      `INSERT INTO evoluciones
         (paciente_id, medico_id, motivo_consulta, diagnostico,
          ta_sistolica, ta_diastolica, fc_lpm, spo2_pct, temperatura, peso_kg, notas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        paciente_id, medico_id,
        motivo_consulta, diagnostico || null,
        ta_sistolica   || null, ta_diastolica || null, fc_lpm   || null,
        spo2_pct       || null, temperatura   || null, peso_kg  || null,
        notas          || null,
      ]
    );
    return rows[0];
  },
};

module.exports = Evolucion;
