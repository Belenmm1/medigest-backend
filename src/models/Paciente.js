/**
 * src/models/Paciente.js
 * Queries SQL para la tabla `pacientes`.
 */

'use strict';

const { query, withTransaction } = require('../config/database');

const PUBLIC_FIELDS = `
  id, nombre, apellido, dni, fecha_nacimiento, sexo,
  grupo_sanguineo, obra_social, nro_afiliado,
  telefono, email, peso_kg, talla_cm,
  alergias, antecedentes, activo,
  created_at, updated_at
`;

const Paciente = {

  /**
   * Listado paginado con búsqueda por nombre completo o DNI.
   */
  async findAll({ q, activo, page = 1, limit = 20 } = {}) {
    const conditions = ['deleted_at IS NULL'];
    const params = [];

    if (q) {
      params.push(`%${q}%`);
      const n = params.length;
      conditions.push(
        `(dni ILIKE $${n} OR (apellido || ' ' || nombre) ILIKE $${n})`
      );
    }

    if (activo !== undefined) {
      params.push(activo);
      conditions.push(`activo = $${params.length}`);
    }

    const where = conditions.join(' AND ');
    const offset = (page - 1) * limit;
    params.push(limit, offset);

    const { rows } = await query(
      `SELECT ${PUBLIC_FIELDS}
       FROM pacientes
       WHERE ${where}
       ORDER BY apellido ASC, nombre ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM pacientes WHERE ${where}`,
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

  /** Detalle completo con medicación activa. */
  async findById(id) {
    const { rows } = await query(
      `SELECT ${PUBLIC_FIELDS} FROM pacientes
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (!rows[0]) return null;

    const paciente = rows[0];

    // Medicación activa
    const { rows: meds } = await query(
      `SELECT id, farmaco, dosis, frecuencia, inicio, fin, notas
       FROM medicaciones
       WHERE paciente_id = $1 AND activo = true
       ORDER BY farmaco`,
      [id]
    );
    paciente.medicacion_activa = meds;

    return paciente;
  },

  /** Busca por DNI (para verificar unicidad). */
  async findByDni(dni) {
    const { rows } = await query(
      `SELECT id, dni FROM pacientes WHERE dni = $1 AND deleted_at IS NULL`,
      [dni.trim()]
    );
    return rows[0] || null;
  },

  /** Crea un nuevo paciente. */
  async create(data) {
    const {
      nombre, apellido, dni, fecha_nacimiento, sexo,
      grupo_sanguineo, obra_social, nro_afiliado,
      telefono, email, peso_kg, talla_cm,
      alergias, antecedentes,
    } = data;

    const { rows } = await query(
      `INSERT INTO pacientes
         (nombre, apellido, dni, fecha_nacimiento, sexo,
          grupo_sanguineo, obra_social, nro_afiliado,
          telefono, email, peso_kg, talla_cm,
          alergias, antecedentes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING ${PUBLIC_FIELDS}`,
      [
        nombre, apellido, dni, fecha_nacimiento, sexo,
        grupo_sanguineo || null, obra_social || null, nro_afiliado || null,
        telefono || null, email || null,
        peso_kg || null, talla_cm || null,
        alergias || null, antecedentes || null,
      ]
    );
    return rows[0];
  },

  /** Actualiza datos del paciente. */
  async update(id, fields) {
    const allowed = [
      'nombre', 'apellido', 'fecha_nacimiento', 'sexo',
      'grupo_sanguineo', 'obra_social', 'nro_afiliado',
      'telefono', 'email', 'peso_kg', 'talla_cm',
      'alergias', 'antecedentes', 'activo',
    ];
    const updates = [];
    const params = [];

    for (const [key, val] of Object.entries(fields)) {
      if (allowed.includes(key) && val !== undefined) {
        params.push(val);
        updates.push(`${key} = $${params.length}`);
      }
    }

    if (updates.length === 0) return null;
    params.push(id);

    const { rows } = await query(
      `UPDATE pacientes SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length} AND deleted_at IS NULL
       RETURNING ${PUBLIC_FIELDS}`,
      params
    );
    return rows[0] || null;
  },

  /** Soft delete. */
  async softDelete(id) {
    const { rows } = await query(
      `UPDATE pacientes SET deleted_at = NOW(), activo = false
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );
    return rows[0] || null;
  },
};

module.exports = Paciente;
