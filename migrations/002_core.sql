-- =============================================================================
-- MediGest Pro · Migración 002 — Modelos clínicos core
-- Orden: ejecutar DESPUÉS de 001_auth.sql y ANTES de 003_core.sql
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------

CREATE TYPE sexo_enum AS ENUM ('masculino', 'femenino', 'otro');

CREATE TYPE grupo_sanguineo_enum AS ENUM (
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'
);

CREATE TYPE turno_estado_enum AS ENUM (
  'confirmado', 'en_sala', 'en_curso', 'atendido', 'cancelado'
);

CREATE TYPE cama_estado_enum AS ENUM (
  'libre', 'ocupada', 'limpieza', 'reservada'
);

CREATE TYPE auditoria_accion_enum AS ENUM (
  'ver', 'exportar', 'modificar', 'crear', 'eliminar'
);

CREATE TYPE triage_nivel_enum AS ENUM (
  'rojo', 'naranja', 'amarillo', 'verde', 'azul'
);

-- ---------------------------------------------------------------------------
-- PACIENTES
-- ---------------------------------------------------------------------------

CREATE TABLE pacientes (
  id                SERIAL        PRIMARY KEY,
  nombre            VARCHAR(100)  NOT NULL,
  apellido          VARCHAR(100)  NOT NULL,
  dni               VARCHAR(20)   NOT NULL UNIQUE,
  fecha_nacimiento  DATE          NOT NULL,
  sexo              sexo_enum     NOT NULL,
  grupo_sanguineo   grupo_sanguineo_enum,
  obra_social       VARCHAR(100),
  nro_afiliado      VARCHAR(50),
  telefono          VARCHAR(30),
  email             VARCHAR(150),
  peso_kg           NUMERIC(5,2),
  talla_cm          NUMERIC(5,1),
  alergias          TEXT,                       -- texto libre; ej: "penicilina, AAS"
  antecedentes      TEXT,                       -- antecedentes personales relevantes
  activo            BOOLEAN       NOT NULL DEFAULT TRUE,
  creado_en         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  actualizado_en    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Trigger para mantener actualizado_en automáticamente
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.actualizado_en = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pacientes_updated_at
  BEFORE UPDATE ON pacientes
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- TURNOS
-- ---------------------------------------------------------------------------

CREATE TABLE turnos (
  id              SERIAL              PRIMARY KEY,
  paciente_id     INTEGER             NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
  medico_id       INTEGER             NOT NULL REFERENCES usuarios(id)  ON DELETE RESTRICT,
  especialidad    VARCHAR(100)        NOT NULL,
  fecha_hora      TIMESTAMPTZ         NOT NULL,
  duracion_min    SMALLINT            NOT NULL DEFAULT 30 CHECK (duracion_min > 0),
  estado          turno_estado_enum   NOT NULL DEFAULT 'confirmado',
  notas           TEXT,
  creado_por_id   INTEGER             NOT NULL REFERENCES usuarios(id)  ON DELETE RESTRICT,
  creado_en       TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

-- Evitar solapamiento de turnos para el mismo médico
CREATE UNIQUE INDEX idx_turnos_medico_no_overlap
  ON turnos (medico_id, fecha_hora)
  WHERE estado NOT IN ('cancelado');

-- ---------------------------------------------------------------------------
-- EVOLUCIONES (Historia Clínica)
-- ---------------------------------------------------------------------------

CREATE TABLE evoluciones (
  id               SERIAL        PRIMARY KEY,
  paciente_id      INTEGER       NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
  medico_id        INTEGER       NOT NULL REFERENCES usuarios(id)  ON DELETE RESTRICT,
  turno_id         INTEGER       REFERENCES turnos(id) ON DELETE SET NULL,  -- opcional
  motivo_consulta  TEXT          NOT NULL,
  diagnostico      TEXT          NOT NULL,
  -- Signos vitales
  ta_sistolica     SMALLINT      CHECK (ta_sistolica  BETWEEN 40 AND 300),
  ta_diastolica    SMALLINT      CHECK (ta_diastolica BETWEEN 20 AND 200),
  fc_lpm           SMALLINT      CHECK (fc_lpm        BETWEEN 20 AND 300),
  spo2_pct         NUMERIC(4,1)  CHECK (spo2_pct      BETWEEN 50  AND 100),
  temperatura      NUMERIC(4,1)  CHECK (temperatura   BETWEEN 30  AND 45),
  peso_kg          NUMERIC(5,2),                      -- peso en la consulta
  notas            TEXT,
  creado_en        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- MEDICACION
-- ---------------------------------------------------------------------------

CREATE TABLE medicaciones (
  id                  SERIAL        PRIMARY KEY,
  paciente_id         INTEGER       NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
  farmaco             VARCHAR(200)  NOT NULL,
  dosis               VARCHAR(100)  NOT NULL,          -- ej: "10 mg"
  frecuencia          VARCHAR(100)  NOT NULL,          -- ej: "cada 8 hs"
  via                 VARCHAR(50),                     -- ej: "oral", "IV", "SC"
  inicio              DATE          NOT NULL,
  fin                 DATE,                            -- NULL = crónico/indefinido
  indicacion          TEXT,                            -- motivo de prescripción
  prescripto_por_id   INTEGER       NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  activo              BOOLEAN       NOT NULL DEFAULT TRUE,
  creado_en           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_fechas_medicacion CHECK (fin IS NULL OR fin >= inicio)
);

-- ---------------------------------------------------------------------------
-- VACUNACION
-- ---------------------------------------------------------------------------

CREATE TABLE vacunaciones (
  id            SERIAL        PRIMARY KEY,
  paciente_id   INTEGER       NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
  vacuna        VARCHAR(150)  NOT NULL,               -- ej: "COVID-19 BNT162b2"
  dosis_numero  SMALLINT      NOT NULL DEFAULT 1,
  lote          VARCHAR(80),
  laboratorio   VARCHAR(100),
  fecha_aplicacion DATE       NOT NULL,
  proxima_dosis    DATE,
  registrado_por_id INTEGER   NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  observaciones TEXT,
  creado_en     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- LABORATORIO (pedidos y resultados)
-- ---------------------------------------------------------------------------

CREATE TYPE lab_estado_enum AS ENUM ('pendiente', 'en_proceso', 'disponible', 'entregado');

CREATE TABLE laboratorio_pedidos (
  id            SERIAL          PRIMARY KEY,
  paciente_id   INTEGER         NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
  medico_id     INTEGER         NOT NULL REFERENCES usuarios(id)  ON DELETE RESTRICT,
  turno_id      INTEGER         REFERENCES turnos(id) ON DELETE SET NULL,
  estudios      TEXT[]          NOT NULL,              -- ej: ['hemograma', 'glucemia']
  urgente       BOOLEAN         NOT NULL DEFAULT FALSE,
  estado        lab_estado_enum NOT NULL DEFAULT 'pendiente',
  resultado_url TEXT,                                  -- ruta al PDF de resultado
  observaciones TEXT,
  pedido_en     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  resultado_en  TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- CAMAS / INTERNACION
-- ---------------------------------------------------------------------------

CREATE TABLE camas (
  id            SERIAL            PRIMARY KEY,
  numero        VARCHAR(10)       NOT NULL,
  sector        VARCHAR(80)       NOT NULL,            -- ej: "Clínica Médica", "UCI"
  piso          SMALLINT          NOT NULL,
  estado        cama_estado_enum  NOT NULL DEFAULT 'libre',
  paciente_id   INTEGER           REFERENCES pacientes(id) ON DELETE SET NULL,
  notas         TEXT,
  actualizado_en TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_camas_numero_sector UNIQUE (numero, sector)
);

-- Una cama no puede tener paciente si no está 'ocupada'
CREATE OR REPLACE FUNCTION fn_camas_check_ocupacion()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.paciente_id IS NOT NULL AND NEW.estado <> 'ocupada' THEN
    RAISE EXCEPTION 'Una cama con paciente asignado debe tener estado ''ocupada''.';
  END IF;
  IF NEW.estado = 'ocupada' AND NEW.paciente_id IS NULL THEN
    RAISE EXCEPTION 'Una cama en estado ''ocupada'' debe tener un paciente asignado.';
  END IF;
  NEW.actualizado_en = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_camas_validar
  BEFORE INSERT OR UPDATE ON camas
  FOR EACH ROW EXECUTE FUNCTION fn_camas_check_ocupacion();

-- ---------------------------------------------------------------------------
-- GUARDIA / TRIAGE
-- ---------------------------------------------------------------------------

CREATE TYPE guardia_estado_enum AS ENUM ('espera', 'en_atencion', 'derivado', 'alta', 'internado');

CREATE TABLE guardia_ingresos (
  id              SERIAL              PRIMARY KEY,
  paciente_id     INTEGER             REFERENCES pacientes(id) ON DELETE SET NULL, -- puede ser anónimo
  nombre_guardia  VARCHAR(200),                        -- si no está registrado
  nivel_triage    triage_nivel_enum   NOT NULL,
  motivo          TEXT                NOT NULL,
  estado          guardia_estado_enum NOT NULL DEFAULT 'espera',
  medico_id       INTEGER             REFERENCES usuarios(id) ON DELETE SET NULL,
  cama_id         INTEGER             REFERENCES camas(id)    ON DELETE SET NULL,
  ingreso_en      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  atencion_inicio TIMESTAMPTZ,
  alta_en         TIMESTAMPTZ,
  observaciones   TEXT
);

-- ---------------------------------------------------------------------------
-- AUDITORIA DE ACCESO
-- ---------------------------------------------------------------------------

CREATE TABLE auditoria_accesos (
  id            BIGSERIAL               PRIMARY KEY,
  usuario_id    INTEGER                 NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  paciente_id   INTEGER                 REFERENCES pacientes(id) ON DELETE SET NULL,
  accion        auditoria_accion_enum   NOT NULL,
  recurso       VARCHAR(100),                          -- ej: 'evoluciones', 'hce_pdf'
  recurso_id    INTEGER,                               -- id del registro afectado
  ip            INET,
  dispositivo   TEXT,                                  -- User-Agent
  detalle       JSONB,                                 -- metadata extra si aplica
  timestamp     TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

-- Partición implícita por timestamp (índice BRIN es eficiente para append-only)
CREATE INDEX idx_auditoria_timestamp_brin ON auditoria_accesos USING BRIN (timestamp);

-- ---------------------------------------------------------------------------
-- INDICES ADICIONALES DE PERFORMANCE
-- ---------------------------------------------------------------------------

-- Pacientes
CREATE INDEX idx_pacientes_dni       ON pacientes (dni);
CREATE INDEX idx_pacientes_apellido  ON pacientes (apellido text_pattern_ops);
CREATE INDEX idx_pacientes_activo    ON pacientes (activo) WHERE activo = TRUE;

-- Turnos
CREATE INDEX idx_turnos_fecha        ON turnos (fecha_hora);
CREATE INDEX idx_turnos_paciente     ON turnos (paciente_id);
CREATE INDEX idx_turnos_medico       ON turnos (medico_id);
CREATE INDEX idx_turnos_estado       ON turnos (estado);

-- Evoluciones
CREATE INDEX idx_evoluciones_paciente ON evoluciones (paciente_id, creado_en DESC);
CREATE INDEX idx_evoluciones_medico   ON evoluciones (medico_id);

-- Medicaciones
CREATE INDEX idx_medicaciones_paciente ON medicaciones (paciente_id, activo);

-- Vacunaciones
CREATE INDEX idx_vacunaciones_paciente ON vacunaciones (paciente_id);

-- Laboratorio
CREATE INDEX idx_lab_paciente  ON laboratorio_pedidos (paciente_id, pedido_en DESC);
CREATE INDEX idx_lab_estado    ON laboratorio_pedidos (estado) WHERE estado <> 'entregado';

-- Camas
CREATE INDEX idx_camas_estado  ON camas (estado);
CREATE INDEX idx_camas_sector  ON camas (sector);

-- Guardia
CREATE INDEX idx_guardia_estado  ON guardia_ingresos (estado) WHERE estado IN ('espera','en_atencion');
CREATE INDEX idx_guardia_triage  ON guardia_ingresos (nivel_triage, ingreso_en);

-- Auditoría
CREATE INDEX idx_auditoria_usuario   ON auditoria_accesos (usuario_id, timestamp DESC);
CREATE INDEX idx_auditoria_paciente  ON auditoria_accesos (paciente_id, timestamp DESC);
CREATE INDEX idx_auditoria_accion    ON auditoria_accesos (accion);

-- ---------------------------------------------------------------------------
-- COMENTARIOS DE TABLA (documentación inline en la DB)
-- ---------------------------------------------------------------------------

COMMENT ON TABLE pacientes           IS 'Registro central de pacientes del establecimiento.';
COMMENT ON TABLE turnos              IS 'Agenda de turnos médicos. Un turno por slot/médico.';
COMMENT ON TABLE evoluciones         IS 'Historia Clínica Electrónica: cada consulta queda registrada.';
COMMENT ON TABLE medicaciones        IS 'Medicación prescripta por paciente (activa e histórica).';
COMMENT ON TABLE vacunaciones        IS 'Registro del plan de vacunación de cada paciente.';
COMMENT ON TABLE laboratorio_pedidos IS 'Pedidos de laboratorio e imágenes, con seguimiento de estado.';
COMMENT ON TABLE camas               IS 'Estado y asignación de camas por sector y piso.';
COMMENT ON TABLE guardia_ingresos    IS 'Ingresos a guardia con clasificación de triage.';
COMMENT ON TABLE auditoria_accesos   IS 'Log inmutable de acceso a datos sensibles (HIPAA-ready).';

COMMIT;
