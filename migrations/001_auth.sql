-- migrations/001_auth.sql
-- ═══════════════════════════════════════════════════════════
-- MÓDULO 01 — AUTENTICACIÓN
-- Tablas: usuarios, refresh_tokens
-- ═══════════════════════════════════════════════════════════

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- índices de búsqueda fuzzy

-- ─── ENUM: roles ────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE rol_usuario AS ENUM (
    'admin',
    'medico',
    'enfermeria',
    'recepcion'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── TABLA: usuarios ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_completo   VARCHAR(120)  NOT NULL,
  email             VARCHAR(255)  NOT NULL UNIQUE,
  password_hash     TEXT          NOT NULL,
  rol               rol_usuario   NOT NULL DEFAULT 'recepcion',
  activo            BOOLEAN       NOT NULL DEFAULT true,
  avatar_iniciales  CHAR(2),
  especialidad      VARCHAR(100),
  ultimo_acceso     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ                               -- soft delete
);

-- Índices de usuarios
CREATE INDEX IF NOT EXISTS idx_usuarios_email    ON usuarios(email)      WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_usuarios_rol      ON usuarios(rol)        WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_usuarios_activo   ON usuarios(activo)     WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_usuarios_nombre   ON usuarios USING gin(nombre_completo gin_trgm_ops);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_usuarios_updated_at ON usuarios;
CREATE TRIGGER trg_usuarios_updated_at
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── TABLA: refresh_tokens ───────────────────────────────────
-- Almacena los refresh tokens emitidos para poder revocarlos.
-- Nunca se guarda el token en crudo — solo su SHA-256.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID        PRIMARY KEY,             -- = JTI del JWT
  usuario_id  UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL,                -- SHA-256 del token
  user_agent  TEXT,
  ip          INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ                          -- NULL = válido
);

-- Índices de refresh_tokens
CREATE INDEX IF NOT EXISTS idx_rt_usuario_id  ON refresh_tokens(usuario_id);
CREATE INDEX IF NOT EXISTS idx_rt_expires_at  ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_rt_token_hash  ON refresh_tokens(token_hash);

-- Job de limpieza: borrar tokens expirados hace más de 30 días
-- (ejecutar con pg_cron o cron externo)
-- DELETE FROM refresh_tokens WHERE expires_at < NOW() - INTERVAL '30 days';

-- ─── DATOS INICIALES (admin) ─────────────────────────────────
-- Password: Admin1234! (bcrypt rounds=12)
-- CAMBIAR INMEDIATAMENTE en producción
INSERT INTO usuarios (nombre_completo, email, password_hash, rol, avatar_iniciales, especialidad, activo)
VALUES
  (
    'Administrador del Sistema',
    'admin@medigest.pro',
    '$2b$12$LKYmk2n9JyGrVjcXb0oNUODJkBh/qqx.MqZD6p0o/cVZimAqYgUAS',
    'admin',
    'AS',
    NULL,
    true
  ),
  (
    'Dra. Laura Romero',
    'medico@medigest.pro',
    '$2b$12$LKYmk2n9JyGrVjcXb0oNUODJkBh/qqx.MqZD6p0o/cVZimAqYgUAS',
    'medico',
    'LR',
    'Clínica Médica',
    true
  ),
  (
    'Enf. Carlos Pérez',
    'enfermeria@medigest.pro',
    '$2b$12$LKYmk2n9JyGrVjcXb0oNUODJkBh/qqx.MqZD6p0o/cVZimAqYgUAS',
    'enfermeria',
    'CP',
    NULL,
    true
  ),
  (
    'Rec. Sofía Torres',
    'recepcion@medigest.pro',
    '$2b$12$LKYmk2n9JyGrVjcXb0oNUODJkBh/qqx.MqZD6p0o/cVZimAqYgUAS',
    'recepcion',
    'ST',
    NULL,
    true
  )
ON CONFLICT (email) DO NOTHING;

-- ─── COMENTARIOS ─────────────────────────────────────────────
COMMENT ON TABLE usuarios         IS 'Usuarios del sistema con roles RBAC';
COMMENT ON TABLE refresh_tokens   IS 'Refresh tokens JWT para rotación segura de sesiones';
COMMENT ON COLUMN usuarios.deleted_at IS 'Soft delete — los registros eliminados mantienen deleted_at != NULL';
COMMENT ON COLUMN refresh_tokens.token_hash IS 'SHA-256 del refresh token. Nunca se almacena el token en crudo.';
