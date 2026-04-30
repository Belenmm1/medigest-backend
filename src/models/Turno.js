/**
 * src/models/Turno.js
 * Queries SQL para la tabla `turnos`.
 */

'use strict';

const { query } = require('../config/database');

const FIELDS = `
  t.id, t.paciente_id, t.medico_id, t.especialidad,
  t.fecha_hora, t.duracion_min, t.estado, t.notas,
  t.creado_por_id, t.created_at, t.updated_at,
  p.nombre    AS paciente_nombre,
  p.apellido  AS paciente_apellido,
  p.dni       AS paciente_dni,
  u.nombre_completo AS medico_nombre,
  u.especialidad    AS medico_especialidad
`;

const Turno = {

  /** Agenda con filtros: fecha, médico, estado. */
  async findAll({ fecha, medico_id, estado, page = 1, limit = 50 } = {}) {
    const conditions = ['t.deleted_at IS NULL'];
    const params = [];

    if (fecha) {
      params.push(fecha);
      conditions.push(`t.fecha_hora::date = $${params.length}`);
    }
    if (medico_id) {
      params.push(medico_id);
      conditions.push(`t.medico_id = $${params.length}`);
    }
    if (estado) {
      params.push(estado);
      conditions.push(`t.estado = $${params.length}`);
    }

    const where = conditions.join(' AND ');
    const offset = (page - 1) * limit;
    params.push(limit, offset);

    const { rows } = await query(
      `SELECT ${FIELDS}
       FROM turnos t
       JOIN pacientes p ON p.id = t.paciente_id
       JOIN usuarios  u ON u.id = t.medico_id
       WHERE ${where}
       ORDER BY t.fecha_hora ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM turnos t WHERE ${where}`,
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

  /**
   * Turnos de la semana (6 días Lun–Sáb) para la agenda visual.
   * @param {string} offset — fecha base (ISO), por defecto lunes de esta semana
   * @param {string} medico_id — filtrar por médico (opcional)
   */
  async findSemana({ offset: fechaBase, medico_id } = {}) {
    // Calcular inicio de semana
    const base = fechaBase ? new Date(fechaBase) : new Date();
    const day  = base.getDay(); // 0=dom
    const diff = (day === 0) ? -6 : 1 - day;
    const lunes = new Date(base);
    lunes.setDate(base.getDate() + diff);

    const sabado = new Date(lunes);
    sabado.setDate(lunes.getDate() + 5);
    sabado.setHours(23, 59, 59);

    const params = [lunes.toISOString(), sabado.toISOString()];
    const conditions = [
      't.deleted_at IS NULL',
      `t.fecha_hora BETWEEN $1 AND $2`,
      `t.estado != 'cancelado'`,
    ];

    if (medico_id) {
      params.push(medico_id);
      conditions.push(`t.medico_id = $${params.length}`);
    }

    const { rows } = await query(
      `SELECT ${FIELDS}
       FROM turnos t
       JOIN pacientes p ON p.id = t.paciente_id
       JOIN usuarios  u ON u.id = t.medico_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY t.fecha_hora ASC`,
      params
    );

    return rows;
  },

  /** Busca un turno por ID. */
  async findById(id) {
    const { rows } = await query(
      `SELECT ${FIELDS}
       FROM turnos t
       JOIN pacientes p ON p.id = t.paciente_id
       JOIN usuarios  u ON u.id = t.medico_id
       WHERE t.id = $1 AND t.deleted_at IS NULL`,
      [id]
    );
    return rows[0] || null;
  },

  /** Crea un nuevo turno. */
  async create(data) {
    const {
      paciente_id, medico_id, especialidad,
      fecha_hora, duracion_min = 30, notas, creado_por_id,
    } = data;

    const { rows } = await query(
      `INSERT INTO turnos
         (paciente_id, medico_id, especialidad, fecha_hora, duracion_min, notas, creado_por_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [paciente_id, medico_id, especialidad, fecha_hora, duracion_min, notas || null, creado_por_id]
    );
    return rows[0];
  },

  /** Cambia el estado del turno con transición válida. */
  async cambiarEstado(id, estado, usuarioId) {
    const TRANSICIONES = {
      confirmado: ['en_sala', 'cancelado'],
      en_sala:    ['en_curso', 'cancelado'],
      en_curso:   ['atendido', 'cancelado'],
      atendido:   [],
      cancelado:  [],
    };

    const turno = await this.findById(id);
    if (!turno) return null;

    const permitidos = TRANSICIONES[turno.estado] || [];
    if (!permitidos.includes(estado)) {
      const err = new Error(`Transición inválida: ${turno.estado} → ${estado}`);
      err.code  = 'INVALID_TRANSITION';
      err.name  = 'ValidationError';
      throw err;
    }

    const { rows } = await query(
      `UPDATE turnos
       SET estado = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [estado, id]
    );
    return rows[0] || null;
  },

  /** Soft delete (cancelar turno). */
  async softDelete(id) {
    const { rows } = await query(
      `UPDATE turnos
       SET deleted_at = NOW(), estado = 'cancelado', updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );
    return rows[0] || null;
  },
};

module.exports = Turno;
