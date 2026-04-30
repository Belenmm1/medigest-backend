/**
 * src/models/User.js
 * Modelo de usuarios. Todas las queries SQL relacionadas a la tabla `usuarios`.
 */

'use strict';

const { query } = require('../config/database');

/**
 * Roles válidos del sistema.
 * Deben coincidir con el ENUM en la migración.
 */
const ROLES = Object.freeze({
  ADMIN:      'admin',
  MEDICO:     'medico',
  ENFERMERIA: 'enfermeria',
  RECEPCION:  'recepcion',
});

/**
 * Campos públicos (nunca devolver password_hash al cliente).
 */
const PUBLIC_FIELDS = `
  id, nombre_completo, email, rol, activo,
  avatar_iniciales, especialidad,
  ultimo_acceso, created_at, updated_at
`;

const User = {
  ROLES,

  /**
   * Busca un usuario por email (incluye password_hash para login).
   */
  async findByEmail(email) {
    const { rows } = await query(
      `SELECT id, nombre_completo, email, rol, activo,
              avatar_iniciales, especialidad, password_hash,
              ultimo_acceso, created_at
       FROM usuarios
       WHERE email = $1 AND deleted_at IS NULL`,
      [email.toLowerCase().trim()]
    );
    return rows[0] || null;
  },

  /**
   * Busca un usuario por ID (sin password).
   */
  async findById(id) {
    const { rows } = await query(
      `SELECT ${PUBLIC_FIELDS} FROM usuarios
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Lista todos los usuarios activos con filtros opcionales.
   */
  async findAll({ rol, activo, page = 1, limit = 20 } = {}) {
    const conditions = ['deleted_at IS NULL'];
    const params = [];

    if (rol) {
      params.push(rol);
      conditions.push(`rol = $${params.length}`);
    }
    if (activo !== undefined) {
      params.push(activo);
      conditions.push(`activo = $${params.length}`);
    }

    const offset = (page - 1) * limit;
    params.push(limit, offset);

    const where = conditions.join(' AND ');
    const { rows } = await query(
      `SELECT ${PUBLIC_FIELDS} FROM usuarios
       WHERE ${where}
       ORDER BY nombre_completo ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM usuarios WHERE ${where}`,
      params.slice(0, -2)
    );

    return {
      data: rows,
      meta: {
        total: parseInt(countRows[0].count),
        page,
        limit,
        totalPages: Math.ceil(countRows[0].count / limit),
      },
    };
  },

  /**
   * Crea un nuevo usuario.
   */
  async create({ nombre_completo, email, password_hash, rol, especialidad }) {
    const iniciales = nombre_completo
      .split(' ')
      .slice(0, 2)
      .map(p => p[0].toUpperCase())
      .join('');

    const { rows } = await query(
      `INSERT INTO usuarios
         (nombre_completo, email, password_hash, rol, avatar_iniciales, especialidad)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${PUBLIC_FIELDS}`,
      [nombre_completo, email.toLowerCase().trim(), password_hash, rol, iniciales, especialidad]
    );
    return rows[0];
  },

  /**
   * Actualiza datos de un usuario.
   */
  async update(id, fields) {
    const allowed = ['nombre_completo', 'email', 'rol', 'activo', 'especialidad'];
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
      `UPDATE usuarios SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length} AND deleted_at IS NULL
       RETURNING ${PUBLIC_FIELDS}`,
      params
    );
    return rows[0] || null;
  },

  /**
   * Actualiza el password_hash de un usuario.
   */
  async updatePassword(id, password_hash) {
    await query(
      `UPDATE usuarios SET password_hash = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL`,
      [password_hash, id]
    );
  },

  /**
   * Registra el último acceso.
   */
  async touchLastAccess(id) {
    await query(
      `UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = $1`,
      [id]
    );
  },

  /**
   * Soft delete — nunca borra físicamente.
   */
  async softDelete(id) {
    const { rows } = await query(
      `UPDATE usuarios SET deleted_at = NOW(), activo = false
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );
    return rows[0] || null;
  },
};

module.exports = User;
