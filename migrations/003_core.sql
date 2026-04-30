-- migrations/003_core.sql
-- ═══════════════════════════════════════════════════════════════════
-- MÓDULO 03 — API REST COMPLETA
-- Tablas: pacientes, turnos, evoluciones, medicaciones,
--         camas, auditoria_accesos
-- Requiere: migrations/001_auth.sql (tabla usuarios)
-- ═══════════════════════════════════════════════════════════════════

-- ─── ENUMs ──────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE sexo_paciente AS ENUM ('masculino', 'femenino', 'otro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE grupo_sanguineo AS ENUM (
    'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE estado_turno AS ENUM (
    'confirmado', 'en_sala', 'en_curso', 'atendido', 'cancelado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE estado_cama AS ENUM (
    'libre', 'ocupada', 'limpieza', 'reservada'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE accion_auditoria AS ENUM (
    'ver', 'crear', 'modificar', 'exportar', 'eliminar'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── TABLA: pacientes ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pacientes (
  id                UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre            VARCHAR(100)    NOT NULL,
  apellido          VARCHAR(100)    NOT NULL,
  dni               VARCHAR(20)     NOT NULL UNIQUE,
  fecha_nacimiento  DATE            NOT NULL,
  sexo              sexo_paciente   NOT NULL,
  grupo_sanguineo   grupo_sanguineo,
  obra_social       VARCHAR(120),
  nro_afiliado      VARCHAR(60),
  telefono          VARCHAR(30),
  email             VARCHAR(255),
  peso_kg           NUMERIC(5,2),
  talla_cm          NUMERIC(5,1),
  alergias          TEXT,
  antecedentes      TEXT,
  activo            BOOLEAN         NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

-- Índices pacientes
CREATE INDEX IF NOT EXISTS idx_pac_dni
  ON pacientes(dni)          WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pac_activo
  ON pacientes(activo)       WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pac_nombre
  ON pacientes USING gin((apellido || ' ' || nombre) gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_pacientes_updated_at ON pacientes;
CREATE TRIGGER trg_pacientes_updated_at
  BEFORE UPDATE ON pacientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── TABLA: turnos ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS turnos (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id     UUID            NOT NULL REFERENCES pacientes(id)  ON DELETE CASCADE,
  medico_id       UUID            NOT NULL REFERENCES usuarios(id)   ON DELETE RESTRICT,
  especialidad    VARCHAR(100)    NOT NULL,
  fecha_hora      TIMESTAMPTZ     NOT NULL,
  duracion_min    SMALLINT        NOT NULL DEFAULT 30
                    CHECK (duracion_min BETWEEN 10 AND 240),
  estado          estado_turno    NOT NULL DEFAULT 'confirmado',
  notas           TEXT,
  creado_por_id   UUID            REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

-- Índices turnos
CREATE INDEX IF NOT EXISTS idx_turnos_fecha
  ON turnos(fecha_hora)       WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_turnos_medico
  ON turnos(medico_id)        WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_turnos_paciente
  ON turnos(paciente_id)      WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_turnos_estado
  ON turnos(estado)           WHERE deleted_at IS NULL;

-- Trigger: detectar solapamiento de turnos para el mismo médico
CREATE OR REPLACE FUNCTION check_turno_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM turnos
    WHERE medico_id  = NEW.medico_id
      AND id         != NEW.id
      AND estado     NOT IN ('cancelado')
      AND deleted_at IS NULL
      AND tstzrange(fecha_hora, fecha_hora + (duracion_min || ' minutes')::interval)
          &&
          tstzrange(NEW.fecha_hora, NEW.fecha_hora + (NEW.duracion_min || ' minutes')::interval)
  ) THEN
    RAISE EXCEPTION 'TURNO_SOLAPADO: El médico ya tiene un turno en ese horario';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_turnos_overlap ON turnos;
CREATE TRIGGER trg_turnos_overlap
  BEFORE INSERT OR UPDATE ON turnos
  FOR EACH ROW EXECUTE FUNCTION check_turno_overlap();

DROP TRIGGER IF EXISTS trg_turnos_updated_at ON turnos;
CREATE TRIGGER trg_turnos_updated_at
  BEFORE UPDATE ON turnos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── TABLA: evoluciones ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS evoluciones (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id       UUID        NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  medico_id         UUID        NOT NULL REFERENCES usuarios(id)  ON DELETE RESTRICT,
  motivo_consulta   TEXT        NOT NULL,
  diagnostico       TEXT,
  ta_sistolica      SMALLINT    CHECK (ta_sistolica  BETWEEN 40 AND 300),
  ta_diastolica     SMALLINT    CHECK (ta_diastolica BETWEEN 20 AND 200),
  fc_lpm            SMALLINT    CHECK (fc_lpm        BETWEEN 20 AND 300),
  spo2_pct          NUMERIC(4,1)CHECK (spo2_pct      BETWEEN 50 AND 100),
  temperatura       NUMERIC(4,1)CHECK (temperatura   BETWEEN 30 AND 45),
  peso_kg           NUMERIC(5,2),
  notas             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evol_paciente
  ON evoluciones(paciente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evol_medico
  ON evoluciones(medico_id);

-- ─── TABLA: medicaciones ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS medicaciones (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id       UUID        NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  farmaco           VARCHAR(150)NOT NULL,
  dosis             VARCHAR(80) NOT NULL,
  frecuencia        VARCHAR(80) NOT NULL,
  inicio            DATE        NOT NULL,
  fin               DATE,
  prescripto_por_id UUID        REFERENCES usuarios(id) ON DELETE SET NULL,
  activo            BOOLEAN     NOT NULL DEFAULT true,
  notas             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_med_paciente_activo
  ON medicaciones(paciente_id, activo);

DROP TRIGGER IF EXISTS trg_medicaciones_updated_at ON medicaciones;
CREATE TRIGGER trg_medicaciones_updated_at
  BEFORE UPDATE ON medicaciones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── TABLA: camas ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS camas (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  numero      VARCHAR(10) NOT NULL,
  sector      VARCHAR(80) NOT NULL,
  piso        SMALLINT    NOT NULL DEFAULT 1,
  estado      estado_cama NOT NULL DEFAULT 'libre',
  paciente_id UUID        REFERENCES pacientes(id) ON DELETE SET NULL,
  notas       TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(numero, sector)
);

CREATE INDEX IF NOT EXISTS idx_camas_estado  ON camas(estado);
CREATE INDEX IF NOT EXISTS idx_camas_sector  ON camas(sector);

-- ─── TABLA: auditoria_accesos ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS auditoria_accesos (
  id          UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID              NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  paciente_id UUID              REFERENCES pacientes(id) ON DELETE SET NULL,
  accion      accion_auditoria  NOT NULL,
  recurso     VARCHAR(120),
  ip          INET,
  dispositivo TEXT,
  detalles    JSONB,
  created_at  TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_usuario
  ON auditoria_accesos(usuario_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_paciente
  ON auditoria_accesos(paciente_id, created_at DESC)
  WHERE paciente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_accion
  ON auditoria_accesos(accion, created_at DESC);

-- ─── DATOS DEMO ───────────────────────────────────────────────────────

INSERT INTO pacientes
  (nombre, apellido, dni, fecha_nacimiento, sexo, grupo_sanguineo,
   obra_social, nro_afiliado, telefono, email, peso_kg, talla_cm, alergias)
VALUES
  ('María Elena',  'González',   '25314879', '1978-03-15', 'femenino',  'A+',  'OSDE',        '4-7823-1', '3764-201345', 'mgonzalez@email.com', 68.5, 163.0, 'Penicilina'),
  ('Carlos',       'Rodríguez',  '33127654', '1990-11-22', 'masculino', 'O+',  'Swiss Medical','SM-99812', '3764-334567', NULL,                  85.0, 178.5, NULL),
  ('Ana Sofía',    'Martínez',   '41005623', '2001-07-04', 'femenino',  'B-',  'Galeno',       'G-11543', '3764-451234', 'amartinez@email.com', 55.2, 160.0, 'Aspirina, Ibuprofeno'),
  ('Jorge Luis',   'Fernández',  '18834210', '1965-01-30', 'masculino', 'AB+', NULL,            NULL,      '3764-512345', NULL,                  92.3, 172.0, NULL),
  ('Lucía',        'Pérez',      '37891234', '1995-09-18', 'femenino',  'O-',  'Medicus',      'M-55432', '3764-623456', 'lperez@email.com',    61.8, 165.5, NULL),
  ('Roberto',      'Sánchez',    '29456781', '1983-04-07', 'masculino', 'A-',  'IOMA',         'I-87654', '3764-734567', NULL,                  78.0, 180.0, 'Sulfamidas'),
  ('Elena',        'López',      '44123789', '2003-12-25', 'femenino',  'B+',  'OSDE',         '4-9912-3','3764-845678', 'elopez@email.com',    52.5, 157.0, NULL),
  ('Diego Andrés', 'Torres',     '31654987', '1988-06-14', 'masculino', 'O+',  'Swiss Medical','SM-33219', '3764-956789', 'dtorres@email.com',  88.7, 182.0, NULL)
ON CONFLICT (dni) DO NOTHING;

INSERT INTO camas (numero, sector, piso, estado)
VALUES
  ('A-01', 'Clínica Médica',  1, 'libre'),
  ('A-02', 'Clínica Médica',  1, 'libre'),
  ('A-03', 'Clínica Médica',  1, 'libre'),
  ('B-01', 'Cirugía',         2, 'libre'),
  ('B-02', 'Cirugía',         2, 'libre'),
  ('C-01', 'UTI',             3, 'libre'),
  ('C-02', 'UTI',             3, 'libre'),
  ('D-01', 'Guardia',         0, 'libre'),
  ('D-02', 'Guardia',         0, 'libre'),
  ('D-03', 'Guardia',         0, 'libre')
ON CONFLICT (numero, sector) DO NOTHING;

-- Comentarios
COMMENT ON TABLE pacientes          IS 'Historia clínica base — datos demográficos y contacto';
COMMENT ON TABLE turnos             IS 'Agenda de consultas con detección de solapamiento';
COMMENT ON TABLE evoluciones        IS 'Registros de consulta por turno o internación';
COMMENT ON TABLE medicaciones       IS 'Prescripciones activas e históricas por paciente';
COMMENT ON TABLE camas              IS 'Mapa de internación — estado en tiempo real';
COMMENT ON TABLE auditoria_accesos  IS 'Log de trazabilidad para cumplimiento normativo';
