/**
 * src/models/Auditoria.js
 * Queries SQL para la tabla `auditoria_accesos`.
 */

'use strict';

const { query } = require('../config/database');

const Auditoria = {

  /** Registra un acceso en la tabla de auditoría. */
  async registrar({ usuario_id, paciente_id, accion, recurso, ip, dispositivo, detalles }) {
    await query(
      `INSERT INTO auditoria_accesos
         (usuario_id, paciente_id, accion, recurso, ip, dispositivo, detalles)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        usuario_id,
        paciente_id || null,
        accion,
        recurso     || null,
        ip          || null,
        dispositivo || null,
        detalles    ? JSON.stringify(detalles) : null,
      ]
    );
  },

  /** Log filtrado con paginación. */
  async findAll({ usuario_id, paciente_id, accion, desde, hasta, page = 1, limit = 50 } = {}) {
    const conditions = [];
    const params = [];

    if (usuario_id) {
      params.push(usuario_id);
      conditions.push(`a.usuario_id = $${params.length}`);
    }
    if (paciente_id) {
      params.push(paciente_id);
      conditions.push(`a.paciente_id = $${params.length}`);
    }
    if (accion) {
      params.push(accion);
      conditions.push(`a.accion = $${params.length}`);
    }
    if (desde) {
      params.push(desde);
      conditions.push(`a.created_at >= $${params.length}`);
    }
    if (hasta) {
      params.push(hasta);
      conditions.push(`a.created_at <= $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;
    params.push(limit, offset);

    const { rows } = await query(
      `SELECT a.id, a.accion, a.recurso, a.ip, a.dispositivo,
              a.detalles, a.created_at,
              u.nombre_completo AS usuario_nombre,
              u.rol             AS usuario_rol,
              p.nombre          AS paciente_nombre,
              p.apellido        AS paciente_apellido,
              p.dni             AS paciente_dni
       FROM auditoria_accesos a
       JOIN usuarios u ON u.id = a.usuario_id
       LEFT JOIN pacientes p ON p.id = a.paciente_id
       ${where}
       ORDER BY a.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM auditoria_accesos a ${where}`,
      params.slice(0, -2)
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
};

module.exports = Auditoria;
