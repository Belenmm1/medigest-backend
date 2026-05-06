/**
 * MediGest Pro — Módulo de Seeds
 * Ejecutar: node src/seeds/index.js [--clean] [--module=<nombre>]
 *
 * Módulos disponibles:
 *   usuarios    → roles: admin, medico, enfermeria, recepcion
 *   pacientes   → 12 pacientes con datos clínicos completos
 *   turnos      → agenda de la semana actual
 *   camas       → 24 camas en 4 sectores
 *   evoluciones → historias clínicas de los pacientes seed
 *   medicacion  → medicación activa e inactiva
 *   vacunacion  → calendario de vacunación
 *   auditoria   → accesos de ejemplo
 */

'use strict';

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// ─── Argumentos CLI ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const CLEAN  = args.includes('--clean');
const MODULE = args.find(a => a.startsWith('--module='))?.split('=')[1];

// ─── Conexión ─────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function query(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const log = {
  info:    msg => console.log(`\x1b[36m  ℹ  ${msg}\x1b[0m`),
  ok:      msg => console.log(`\x1b[32m  ✔  ${msg}\x1b[0m`),
  warn:    msg => console.log(`\x1b[33m  ⚠  ${msg}\x1b[0m`),
  error:   msg => console.log(`\x1b[31m  ✖  ${msg}\x1b[0m`),
  section: msg => console.log(`\n\x1b[1m\x1b[35m▶ ${msg}\x1b[0m`),
};

// ─── Seeds ────────────────────────────────────────────────────────────────────

async function seedUsuarios() {
  log.section('Usuarios');
  const SALT = 10;

  const usuarios = [
    {
      email:           'admin@medigest.com',
      password:        'Admin2026!',
      nombre_completo: 'Administrador del Sistema',
      rol:             'admin',
    },
    {
      email:           'medico@medigest.com',
      password:        'Medico2026!',
      nombre_completo: 'Dr. Carlos Herrera',
      rol:             'medico',
      especialidad:    'Clínica Médica',
      matricula:       'MP-52341',
    },
    {
      email:           'medico2@medigest.com',
      password:        'Medico2026!',
      nombre_completo: 'Dra. Valentina Ruiz',
      rol:             'medico',
      especialidad:    'Cardiología',
      matricula:       'MP-61872',
    },
    {
      email:           'enf@medigest.com',
      password:        'Enf2026!',
      nombre_completo: 'Lic. María González',
      rol:             'enfermeria',
    },
    {
      email:           'enf2@medigest.com',
      password:        'Enf2026!',
      nombre_completo: 'Lic. Roberto Díaz',
      rol:             'enfermeria',
    },
    {
      email:           'recepcion@medigest.com',
      password:        'Recep2026!',
      nombre_completo: 'Laura Pérez',
      rol:             'recepcion',
    },
  ];

  let insertados = 0;
  let existentes = 0;

  for (const u of usuarios) {
    const { rows } = await query('SELECT id FROM usuarios WHERE email = $1', [u.email]);
    if (rows.length) {
      log.warn(`Ya existe: ${u.email}`);
      existentes++;
      continue;
    }

    const hash = await bcrypt.hash(u.password, SALT);
    await query(
      `INSERT INTO usuarios (email, password_hash, nombre_completo, rol, especialidad, matricula, activo)
       VALUES ($1, $2, $3, $4, $5, $6, true)`,
      [u.email, hash, u.nombre_completo, u.rol, u.especialidad || null, u.matricula || null]
    );
    log.ok(`Creado: ${u.nombre_completo} (${u.rol})`);
    insertados++;
  }

  log.info(`${insertados} creados, ${existentes} ya existían`);
}


async function seedPacientes() {
  log.section('Pacientes');

  const pacientes = [
    {
      nombre: 'Ricardo',  apellido: 'Montoya',
      dni: '28543219', fecha_nacimiento: '1975-03-15',
      sexo: 'M', grupo_sanguineo: 'A+',
      obra_social: 'OSDE',      nro_afiliado: '1234-56789-01',
      telefono: '011-4523-8841', email: 'r.montoya@email.com',
      peso_kg: 82.5, talla_cm: 175,
      alergias: 'Penicilina',
      antecedentes: 'HTA, Dislipemia',
      localidad: 'Buenos Aires', provincia: 'Buenos Aires',
    },
    {
      nombre: 'Elena',    apellido: 'Vásquez',
      dni: '31892045', fecha_nacimiento: '1988-11-22',
      sexo: 'F', grupo_sanguineo: 'O+',
      obra_social: 'Swiss Medical', nro_afiliado: 'SM-448821',
      telefono: '011-5512-0034', email: 'elena.vasquez@email.com',
      peso_kg: 61.0, talla_cm: 162,
      alergias: null,
      antecedentes: 'Hipotiroidismo',
      localidad: 'Rosario', provincia: 'Santa Fe',
    },
    {
      nombre: 'Jorge',    apellido: 'Fernández',
      dni: '20117843', fecha_nacimiento: '1960-07-08',
      sexo: 'M', grupo_sanguineo: 'B+',
      obra_social: 'PAMI',        nro_afiliado: 'PA-7731984',
      telefono: '011-4887-2210', email: null,
      peso_kg: 91.0, talla_cm: 172,
      alergias: 'AAS, AINE',
      antecedentes: 'DBT2, HTA, IRC leve, EPOC',
      localidad: 'Buenos Aires', provincia: 'Buenos Aires',
    },
    {
      nombre: 'Sofía',    apellido: 'Ramírez',
      dni: '38004712', fecha_nacimiento: '1995-01-30',
      sexo: 'F', grupo_sanguineo: 'AB-',
      obra_social: 'Galeno',      nro_afiliado: 'GL-990012',
      telefono: '341-4412-8863', email: 'sofia.ramirez@email.com',
      peso_kg: 55.5, talla_cm: 158,
      alergias: null,
      antecedentes: 'Asma moderada persistente',
      localidad: 'Rosario', provincia: 'Santa Fe',
    },
    {
      nombre: 'Héctor',   apellido: 'Molina',
      dni: '17632198', fecha_nacimiento: '1952-09-14',
      sexo: 'M', grupo_sanguineo: 'A-',
      obra_social: 'IOMA',        nro_afiliado: 'IO-331256',
      telefono: '221-4561-7720', email: null,
      peso_kg: 78.0, talla_cm: 168,
      alergias: 'Sulfas',
      antecedentes: 'IAM 2019, TBC resuelta, HTA',
      localidad: 'La Plata', provincia: 'Buenos Aires',
    },
    {
      nombre: 'Natalia',  apellido: 'Cruz',
      dni: '34512089', fecha_nacimiento: '1991-06-05',
      sexo: 'F', grupo_sanguineo: 'O-',
      obra_social: 'OSDE',        nro_afiliado: '2211-87643-00',
      telefono: '011-5544-1123', email: 'ncruz@email.com',
      peso_kg: 67.0, talla_cm: 165,
      alergias: 'Látex',
      antecedentes: 'Lupus eritematoso sistémico',
      localidad: 'Buenos Aires', provincia: 'Buenos Aires',
    },
    {
      nombre: 'Manuel',   apellido: 'Aguirre',
      dni: '25789034', fecha_nacimiento: '1978-12-20',
      sexo: 'M', grupo_sanguineo: 'B-',
      obra_social: 'Medicus',     nro_afiliado: 'MD-556633',
      telefono: '011-4712-9900', email: 'm.aguirre@email.com',
      peso_kg: 95.0, talla_cm: 180,
      alergias: null,
      antecedentes: 'Obesidad G2, SAHOS, HTA',
      localidad: 'Córdoba', provincia: 'Córdoba',
    },
    {
      nombre: 'Camila',   apellido: 'Torres',
      dni: '40123456', fecha_nacimiento: '2001-04-18',
      sexo: 'F', grupo_sanguineo: 'A+',
      obra_social: 'Swiss Medical', nro_afiliado: 'SM-881134',
      telefono: '011-6612-3345', email: 'camila.t@email.com',
      peso_kg: 52.0, talla_cm: 160,
      alergias: null,
      antecedentes: null,
      localidad: 'Buenos Aires', provincia: 'Buenos Aires',
    },
    {
      nombre: 'Antonio',  apellido: 'Pereyra',
      dni: '14098765', fecha_nacimiento: '1945-02-28',
      sexo: 'M', grupo_sanguineo: 'AB+',
      obra_social: 'PAMI',        nro_afiliado: 'PA-4412009',
      telefono: '011-4236-5578', email: null,
      peso_kg: 68.0, talla_cm: 165,
      alergias: 'Contraste yodado',
      antecedentes: 'Estenosis aórtica, FA crónica, HTA, DM2',
      localidad: 'Buenos Aires', provincia: 'Buenos Aires',
    },
    {
      nombre: 'Patricia', apellido: 'Romero',
      dni: '29871234', fecha_nacimiento: '1982-08-10',
      sexo: 'F', grupo_sanguineo: 'O+',
      obra_social: 'OSECAC',      nro_afiliado: 'OC-7788112',
      telefono: '351-4451-2230', email: 'p.romero@email.com',
      peso_kg: 70.5, talla_cm: 163,
      alergias: 'Ibuprofeno',
      antecedentes: 'Artritis reumatoidea, Anemia ferropénica',
      localidad: 'Córdoba', provincia: 'Córdoba',
    },
    {
      nombre: 'Lucas',    apellido: 'Giménez',
      dni: '36452108', fecha_nacimiento: '1993-05-25',
      sexo: 'M', grupo_sanguineo: 'A+',
      obra_social: 'DOSEP',       nro_afiliado: 'DS-334410',
      telefono: '264-4412-7730', email: 'lgimenez@email.com',
      peso_kg: 74.0, talla_cm: 177,
      alergias: null,
      antecedentes: 'Depresión mayor, Migraña crónica',
      localidad: 'San Juan', provincia: 'San Juan',
    },
    {
      nombre: 'Graciela', apellido: 'Ibáñez',
      dni: '22341098', fecha_nacimiento: '1968-10-03',
      sexo: 'F', grupo_sanguineo: 'B+',
      obra_social: 'IOSE',        nro_afiliado: 'IS-9901823',
      telefono: '011-4523-0091', email: 'g.ibanez@email.com',
      peso_kg: 73.0, talla_cm: 160,
      alergias: 'Codeína',
      antecedentes: 'Hipotiroidismo, Osteoporosis, HTA',
      localidad: 'Buenos Aires', provincia: 'Buenos Aires',
    },
  ];

  let insertados = 0;
  let existentes = 0;

  for (const p of pacientes) {
    const { rows } = await query('SELECT id FROM pacientes WHERE dni = $1', [p.dni]);
    if (rows.length) {
      log.warn(`Ya existe DNI: ${p.dni} — ${p.nombre} ${p.apellido}`);
      existentes++;
      continue;
    }

    await query(
      `INSERT INTO pacientes
         (nombre, apellido, dni, fecha_nacimiento, sexo, grupo_sanguineo,
          obra_social, nro_afiliado, telefono, email, peso_kg, talla_cm,
          alergias, antecedentes, localidad, provincia)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        p.nombre, p.apellido, p.dni, p.fecha_nacimiento, p.sexo, p.grupo_sanguineo,
        p.obra_social, p.nro_afiliado, p.telefono, p.email, p.peso_kg, p.talla_cm,
        p.alergias, p.antecedentes, p.localidad, p.provincia,
      ]
    );
    log.ok(`Creado: ${p.nombre} ${p.apellido} (DNI ${p.dni})`);
    insertados++;
  }

  log.info(`${insertados} creados, ${existentes} ya existían`);
}


async function seedTurnos() {
  log.section('Turnos (agenda semanal)');

  // Obtener IDs de médicos y pacientes
  const { rows: medicos } = await query(
    "SELECT id, nombre_completo FROM usuarios WHERE rol = 'medico' ORDER BY id"
  );
  const { rows: pacientes } = await query(
    'SELECT id, nombre, apellido FROM pacientes ORDER BY id LIMIT 12'
  );

  if (!medicos.length) { log.warn('Sin médicos — ejecutar seedUsuarios primero'); return; }
  if (!pacientes.length) { log.warn('Sin pacientes — ejecutar seedPacientes primero'); return; }

  const medico1 = medicos[0];
  const medico2 = medicos[1] || medicos[0];

  // Días de la semana actual (lunes → sábado)
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

  const dias = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  const turnos = [
    // Lunes
    { fecha: dias[0], hora: '08:00', medico: medico1, paciente: pacientes[0], especialidad: 'Clínica Médica',  estado: 'atendido',   notas: 'Control rutinario. TA 130/85.' },
    { fecha: dias[0], hora: '08:30', medico: medico1, paciente: pacientes[1], especialidad: 'Clínica Médica',  estado: 'atendido',   notas: 'Control hipotiroidismo. TSH OK.' },
    { fecha: dias[0], hora: '09:00', medico: medico2, paciente: pacientes[4], especialidad: 'Cardiología',    estado: 'atendido',   notas: 'Seguimiento post-IAM.' },
    { fecha: dias[0], hora: '10:00', medico: medico1, paciente: pacientes[2], especialidad: 'Clínica Médica',  estado: 'cancelado',  notas: 'Paciente no se presentó.' },

    // Martes
    { fecha: dias[1], hora: '08:00', medico: medico1, paciente: pacientes[3], especialidad: 'Clínica Médica',  estado: 'atendido',   notas: 'Control asma. Espirómetro normal.' },
    { fecha: dias[1], hora: '09:30', medico: medico2, paciente: pacientes[8], especialidad: 'Cardiología',    estado: 'atendido',   notas: 'Revisión FA. Anticoagulación ajustada.' },
    { fecha: dias[1], hora: '10:00', medico: medico1, paciente: pacientes[5], especialidad: 'Clínica Médica',  estado: 'atendido',   notas: 'Control LES. Labs solicitados.' },

    // Miércoles
    { fecha: dias[2], hora: '08:30', medico: medico1, paciente: pacientes[6], especialidad: 'Clínica Médica',  estado: 'atendido',   notas: 'Control HTA y obesidad.' },
    { fecha: dias[2], hora: '09:00', medico: medico2, paciente: pacientes[9], especialidad: 'Cardiología',    estado: 'atendido',   notas: 'ECG dentro de parámetros.' },
    { fecha: dias[2], hora: '10:30', medico: medico1, paciente: pacientes[10], especialidad: 'Clínica Médica', estado: 'atendido',   notas: 'Seguimiento depresión. Derivación psiquiatría.' },

    // Jueves (hoy o próximo día hábil — estados mixtos)
    { fecha: dias[3], hora: '08:00', medico: medico1, paciente: pacientes[7], especialidad: 'Clínica Médica',  estado: 'confirmado', notas: null },
    { fecha: dias[3], hora: '08:30', medico: medico1, paciente: pacientes[0], especialidad: 'Clínica Médica',  estado: 'en_sala',    notas: null },
    { fecha: dias[3], hora: '09:00', medico: medico2, paciente: pacientes[4], especialidad: 'Cardiología',    estado: 'en_curso',   notas: null },
    { fecha: dias[3], hora: '09:30', medico: medico1, paciente: pacientes[2], especialidad: 'Clínica Médica',  estado: 'confirmado', notas: null },
    { fecha: dias[3], hora: '10:00', medico: medico2, paciente: pacientes[8], especialidad: 'Cardiología',    estado: 'confirmado', notas: null },
    { fecha: dias[3], hora: '10:30', medico: medico1, paciente: pacientes[11], especialidad: 'Clínica Médica', estado: 'confirmado', notas: null },

    // Viernes
    { fecha: dias[4], hora: '08:00', medico: medico1, paciente: pacientes[1], especialidad: 'Clínica Médica',  estado: 'confirmado', notas: null },
    { fecha: dias[4], hora: '08:30', medico: medico2, paciente: pacientes[3], especialidad: 'Cardiología',    estado: 'confirmado', notas: null },
    { fecha: dias[4], hora: '09:30', medico: medico1, paciente: pacientes[5], especialidad: 'Clínica Médica',  estado: 'confirmado', notas: null },

    // Sábado
    { fecha: dias[5], hora: '08:00', medico: medico1, paciente: pacientes[6], especialidad: 'Clínica Médica',  estado: 'confirmado', notas: null },
    { fecha: dias[5], hora: '09:00', medico: medico2, paciente: pacientes[9], especialidad: 'Cardiología',    estado: 'confirmado', notas: null },
  ];

  // Obtener admin para creado_por
  const { rows: admins } = await query("SELECT id FROM usuarios WHERE rol = 'admin' LIMIT 1");
  const adminId = admins[0]?.id || medico1.id;

  let insertados = 0;

  for (const t of turnos) {
    const fechaHora = `${t.fecha} ${t.hora}:00`;
    const { rows } = await query(
      'SELECT id FROM turnos WHERE medico_id = $1 AND fecha_hora = $2',
      [t.medico.id, fechaHora]
    );
    if (rows.length) { log.warn(`Conflicto: ${t.medico.nombre_completo} @ ${fechaHora}`); continue; }

    await query(
      `INSERT INTO turnos
         (paciente_id, medico_id, especialidad, fecha_hora, duracion_min, estado, notas, creado_por_id)
       VALUES ($1,$2,$3,$4,30,$5,$6,$7)`,
      [t.paciente.id, t.medico.id, t.especialidad, fechaHora, t.estado, t.notas, adminId]
    );
    log.ok(`Turno: ${t.paciente.nombre} ${t.paciente.apellido} — ${fechaHora} (${t.estado})`);
    insertados++;
  }

  log.info(`${insertados} turnos creados`);
}


async function seedCamas() {
  log.section('Camas');

  const sectores = [
    { sector: 'Clínica Médica', piso: 2, camas: 8 },
    { sector: 'Cardiología',    piso: 3, camas: 6 },
    { sector: 'Guardia',        piso: 0, camas: 6 },
    { sector: 'UCI',            piso: 4, camas: 4 },
  ];

  // Obtener pacientes para asignar a algunas camas
  const { rows: pacientes } = await query(
    'SELECT id FROM pacientes ORDER BY id LIMIT 8'
  );

  const estados = ['libre','libre','libre','ocupada','ocupada','limpieza','libre','libre'];
  let numero = 100;
  let insertados = 0;

  for (const s of sectores) {
    for (let i = 1; i <= s.camas; i++) {
      numero++;
      const { rows } = await query('SELECT id FROM camas WHERE numero = $1', [String(numero)]);
      if (rows.length) { log.warn(`Cama ${numero} ya existe`); continue; }

      const estado = estados[(i - 1) % estados.length];
      const pacienteIdx = estado === 'ocupada' ? pacientes[(numero - 101) % pacientes.length]?.id : null;

      await query(
        `INSERT INTO camas (numero, sector, piso, estado, paciente_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [String(numero), s.sector, s.piso, estado, pacienteIdx]
      );
      log.ok(`Cama ${numero} — ${s.sector} P${s.piso} [${estado}]`);
      insertados++;
    }
  }

  log.info(`${insertados} camas creadas`);
}


async function seedEvoluciones() {
  log.section('Evoluciones / Historia Clínica');

  const { rows: medicos } = await query(
    "SELECT id FROM usuarios WHERE rol = 'medico' ORDER BY id"
  );
  const { rows: pacientes } = await query(
    'SELECT id, nombre, apellido FROM pacientes ORDER BY id LIMIT 8'
  );

  if (!medicos.length || !pacientes.length) {
    log.warn('Sin médicos o pacientes — ejecutar dependencias primero');
    return;
  }

  const medico1 = medicos[0];
  const medico2 = medicos[1] || medicos[0];

  const evoluciones = [
    // Paciente 0 — Ricardo Montoya (HTA, Dislipemia)
    {
      paciente: pacientes[0], medico: medico1,
      motivo:      'Control periódico HTA y dislipemia',
      diagnostico: 'HTA controlada. LDL en rango con atorvastatina 20 mg.',
      ta_s: 132, ta_d: 84, fc: 72, spo2: 98, temp: 36.4,
      notas:       'Continúa tratamiento. Próximo control en 3 meses.',
      dias_atras:  90,
    },
    {
      paciente: pacientes[0], medico: medico1,
      motivo:      'Control HTA. Refiere cefaleas matutinas.',
      diagnostico: 'HTA no del todo controlada. Ajuste de dosis de amlodipina.',
      ta_s: 148, ta_d: 92, fc: 78, spo2: 97, temp: 36.2,
      notas:       'Se aumenta amlodipina a 10 mg. Control en 4 semanas.',
      dias_atras:  30,
    },
    // Paciente 1 — Elena Vásquez (Hipotiroidismo)
    {
      paciente: pacientes[1], medico: medico1,
      motivo:      'Control hipotiroidismo. TSH solicitada.',
      diagnostico: 'Hipotiroidismo en tratamiento con levotiroxina. TSH 2.1 mUI/L (normal).',
      ta_s: 110, ta_d: 70, fc: 68, spo2: 99, temp: 36.6,
      notas:       'Se mantiene dosis actual. Control anual.',
      dias_atras:  180,
    },
    // Paciente 2 — Jorge Fernández (DBT2, HTA, IRC, EPOC)
    {
      paciente: pacientes[2], medico: medico1,
      motivo:      'Control DBT2. Hemoglobina glicosilada solicitada.',
      diagnostico: 'DBT2 con HbA1c 7.8% — ajuste de metformina. IRC leve estable.',
      ta_s: 145, ta_d: 88, fc: 80, spo2: 95, temp: 36.3,
      notas:       'Se sube metformina a 1500 mg/día. Nefrólogo en 2 meses. Espirometría anual.',
      dias_atras:  60,
    },
    {
      paciente: pacientes[2], medico: medico1,
      motivo:      'Disnea de esfuerzo. EPOC reagudizado.',
      diagnostico: 'EPOC reagudización leve. Se agrega broncodilatador de rescate.',
      ta_s: 150, ta_d: 90, fc: 88, spo2: 93, temp: 37.1,
      notas:       'Salbutamol spray QID x 7 días. Control en 10 días.',
      dias_atras:  15,
    },
    // Paciente 4 — Héctor Molina (IAM 2019, HTA)
    {
      paciente: pacientes[4], medico: medico2,
      motivo:      'Control cardiológico post-IAM anual.',
      diagnostico: 'Post-IAM estable. FEVI 55% en ecocardiograma reciente.',
      ta_s: 128, ta_d: 78, fc: 65, spo2: 98, temp: 36.5,
      notas:       'Continúa AAS + atorvastatina + enalapril + carvedilol. Ecocardiograma anual.',
      dias_atras:  45,
    },
    // Paciente 5 — Natalia Cruz (LES)
    {
      paciente: pacientes[5], medico: medico1,
      motivo:      'Control LES. Refiere artralgias y fatiga.',
      diagnostico: 'LES activo leve. SLEDAI 4. Labs: ANA positivo, complemento bajo.',
      ta_s: 118, ta_d: 75, fc: 76, spo2: 99, temp: 37.0,
      notas:       'Se agrega hidroxicloroquina. Reumatología en 30 días.',
      dias_atras:  20,
    },
    // Paciente 6 — Manuel Aguirre (Obesidad, SAHOS, HTA)
    {
      paciente: pacientes[6], medico: medico1,
      motivo:      'Control HTA y SAHOS. Pérdida de peso referida: 4 kg.',
      diagnostico: 'HTA en buen control. SAHOS moderado con CPAP. Obesidad G2.',
      ta_s: 135, ta_d: 82, fc: 74, spo2: 96, temp: 36.4,
      notas:       'Felicitar por pérdida de peso. Continúa CPAP. Control en 2 meses.',
      dias_atras:  10,
    },
  ];

  let insertados = 0;

  for (const e of evoluciones) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - e.dias_atras);
    const fechaStr = fecha.toISOString();

    // Verificar si ya existe una evolución similar (mismo paciente, fecha y diagnóstico)
    const { rows } = await query(
      `SELECT id FROM evoluciones
       WHERE paciente_id = $1 AND diagnostico = $2
       LIMIT 1`,
      [e.paciente.id, e.diagnostico]
    );
    if (rows.length) {
      log.warn(`Evolución duplicada: ${e.paciente.nombre} — ${e.diagnostico.substring(0, 40)}...`);
      continue;
    }

    await query(
      `INSERT INTO evoluciones
         (paciente_id, medico_id, motivo_consulta, diagnostico,
          ta_sistolica, ta_diastolica, fc_lpm, spo2_pct, temperatura, notas, creado_en)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        e.paciente.id, e.medico.id, e.motivo, e.diagnostico,
        e.ta_s, e.ta_d, e.fc, e.spo2, e.temp, e.notas, fechaStr,
      ]
    );
    log.ok(`Evolución: ${e.paciente.nombre} ${e.paciente.apellido} — hace ${e.dias_atras}d`);
    insertados++;
  }

  log.info(`${insertados} evoluciones creadas`);
}


async function seedMedicacion() {
  log.section('Medicación');

  const { rows: medicos } = await query(
    "SELECT id FROM usuarios WHERE rol = 'medico' ORDER BY id LIMIT 2"
  );
  const { rows: pacientes } = await query(
    'SELECT id, nombre, apellido FROM pacientes ORDER BY id LIMIT 10'
  );

  if (!medicos.length || !pacientes.length) {
    log.warn('Sin médicos o pacientes'); return;
  }

  const today = new Date().toISOString().split('T')[0];
  const medico1 = medicos[0];
  const medico2 = medicos[1] || medicos[0];

  const medicaciones = [
    // Paciente 0 — Ricardo Montoya
    { paciente: pacientes[0], medico: medico1, farmaco: 'Amlodipina',    dosis: '10 mg',  frecuencia: '1 vez/día',       inicio: '2023-01-15', fin: null, activo: true },
    { paciente: pacientes[0], medico: medico1, farmaco: 'Atorvastatina', dosis: '20 mg',  frecuencia: '1 vez/día (noche)', inicio: '2023-01-15', fin: null, activo: true },

    // Paciente 1 — Elena Vásquez
    { paciente: pacientes[1], medico: medico1, farmaco: 'Levotiroxina',  dosis: '75 mcg', frecuencia: '1 vez/día (ayuno)', inicio: '2020-06-10', fin: null, activo: true },

    // Paciente 2 — Jorge Fernández (múltiple)
    { paciente: pacientes[2], medico: medico1, farmaco: 'Metformina',    dosis: '1500 mg',frecuencia: '3 veces/día (con comidas)', inicio: '2018-03-01', fin: null, activo: true },
    { paciente: pacientes[2], medico: medico1, farmaco: 'Enalapril',     dosis: '10 mg',  frecuencia: '2 veces/día',      inicio: '2018-03-01', fin: null, activo: true },
    { paciente: pacientes[2], medico: medico1, farmaco: 'Salbutamol',    dosis: '200 mcg (spray)', frecuencia: 'QID x 7 días',inicio: today, fin: null, activo: true },
    { paciente: pacientes[2], medico: medico1, farmaco: 'Furosemida',    dosis: '40 mg',  frecuencia: '1 vez/día',        inicio: '2021-07-20', fin: '2022-03-01', activo: false },

    // Paciente 4 — Héctor Molina
    { paciente: pacientes[4], medico: medico2, farmaco: 'AAS',           dosis: '100 mg', frecuencia: '1 vez/día',        inicio: '2019-05-10', fin: null, activo: true },
    { paciente: pacientes[4], medico: medico2, farmaco: 'Atorvastatina', dosis: '40 mg',  frecuencia: '1 vez/día (noche)', inicio: '2019-05-10', fin: null, activo: true },
    { paciente: pacientes[4], medico: medico2, farmaco: 'Carvedilol',    dosis: '25 mg',  frecuencia: '2 veces/día',      inicio: '2019-05-10', fin: null, activo: true },
    { paciente: pacientes[4], medico: medico2, farmaco: 'Enalapril',     dosis: '20 mg',  frecuencia: '1 vez/día',        inicio: '2019-05-10', fin: null, activo: true },

    // Paciente 5 — Natalia Cruz (LES)
    { paciente: pacientes[5], medico: medico1, farmaco: 'Hidroxicloroquina', dosis: '200 mg', frecuencia: '2 veces/día', inicio: today, fin: null, activo: true },
    { paciente: pacientes[5], medico: medico1, farmaco: 'Deflazacort',   dosis: '6 mg',   frecuencia: '1 vez/día',        inicio: '2023-11-01', fin: null, activo: true },

    // Paciente 6 — Manuel Aguirre
    { paciente: pacientes[6], medico: medico1, farmaco: 'Losartán',      dosis: '100 mg', frecuencia: '1 vez/día',        inicio: '2022-04-01', fin: null, activo: true },

    // Paciente 8 — Antonio Pereyra (FA, HTA, DM2)
    { paciente: pacientes[8], medico: medico2, farmaco: 'Apixabán',      dosis: '5 mg',   frecuencia: '2 veces/día',      inicio: '2021-09-01', fin: null, activo: true },
    { paciente: pacientes[8], medico: medico2, farmaco: 'Metformina',    dosis: '850 mg', frecuencia: '2 veces/día',      inicio: '2019-02-01', fin: null, activo: true },
    { paciente: pacientes[8], medico: medico2, farmaco: 'Bisoprolol',    dosis: '5 mg',   frecuencia: '1 vez/día',        inicio: '2021-09-01', fin: null, activo: true },
  ];

  let insertados = 0;

  for (const m of medicaciones) {
    const { rows } = await query(
      `SELECT id FROM medicacion
       WHERE paciente_id = $1 AND farmaco = $2 AND dosis = $3 AND activo = $4`,
      [m.paciente.id, m.farmaco, m.dosis, m.activo]
    );
    if (rows.length) {
      log.warn(`Medicación duplicada: ${m.paciente.nombre} — ${m.farmaco}`);
      continue;
    }

    await query(
      `INSERT INTO medicacion
         (paciente_id, farmaco, dosis, frecuencia, inicio, fin, prescripto_por_id, activo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [m.paciente.id, m.farmaco, m.dosis, m.frecuencia, m.inicio, m.fin, m.medico.id, m.activo]
    );
    log.ok(`${m.activo ? '🟢' : '⚫'} ${m.paciente.nombre} ${m.paciente.apellido} — ${m.farmaco} ${m.dosis}`);
    insertados++;
  }

  log.info(`${insertados} medicaciones creadas`);
}


async function seedVacunacion() {
  log.section('Vacunación');

  const { rows: pacientes } = await query(
    'SELECT id, nombre, apellido, fecha_nacimiento FROM pacientes ORDER BY id LIMIT 6'
  );
  const { rows: medicos } = await query(
    "SELECT id FROM usuarios WHERE rol = 'medico' ORDER BY id LIMIT 1"
  );

  if (!pacientes.length || !medicos.length) {
    log.warn('Sin pacientes o médicos'); return;
  }

  const medicoId = medicos[0].id;

  // Verificar si la tabla existe
  const { rows: tables } = await query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='vacunacion'"
  );
  if (!tables.length) {
    log.warn('Tabla vacunacion no existe — omitiendo');
    return;
  }

  const registros = [
    { pac: pacientes[0], vacuna: 'Doble bacteriana (dT)',    lote: 'L-DT-2024-01', fecha: '2024-03-10', laboratorio: 'Sanofi', dosis: '1ra refuerzo' },
    { pac: pacientes[0], vacuna: 'Influenza estacional',     lote: 'L-FL-2024-05', fecha: '2024-04-15', laboratorio: 'GSK',    dosis: '2024' },
    { pac: pacientes[1], vacuna: 'Doble bacteriana (dT)',    lote: 'L-DT-2024-02', fecha: '2024-02-20', laboratorio: 'Sanofi', dosis: '1ra refuerzo' },
    { pac: pacientes[2], vacuna: 'Influenza estacional',     lote: 'L-FL-2024-03', fecha: '2024-04-01', laboratorio: 'GSK',    dosis: '2024' },
    { pac: pacientes[2], vacuna: 'Neumococo 23-valente',     lote: 'L-PN-2023-11', fecha: '2023-09-15', laboratorio: 'Pfizer', dosis: 'única' },
    { pac: pacientes[4], vacuna: 'Influenza estacional',     lote: 'L-FL-2024-07', fecha: '2024-04-10', laboratorio: 'GSK',    dosis: '2024' },
    { pac: pacientes[4], vacuna: 'Neumococo 13-valente',     lote: 'L-PN13-2022-4',fecha: '2022-11-20', laboratorio: 'Pfizer', dosis: 'única' },
    { pac: pacientes[5], vacuna: 'COVID-19 (mRNA)',          lote: 'L-CV-2023-01', fecha: '2023-01-10', laboratorio: 'Moderna', dosis: 'refuerzo bivalente' },
    { pac: pacientes[3], vacuna: 'Doble bacteriana (dT)',    lote: 'L-DT-2024-08', fecha: '2024-01-15', laboratorio: 'Sanofi', dosis: '1ra refuerzo' },
  ];

  let insertados = 0;

  for (const r of registros) {
    const { rows } = await query(
      'SELECT id FROM vacunacion WHERE paciente_id = $1 AND vacuna = $2 AND fecha_aplicacion = $3',
      [r.pac.id, r.vacuna, r.fecha]
    );
    if (rows.length) {
      log.warn(`Vacuna duplicada: ${r.pac.nombre} — ${r.vacuna}`);
      continue;
    }

    await query(
      `INSERT INTO vacunacion
         (paciente_id, vacuna, dosis, fecha_aplicacion, lote, laboratorio, registrado_por_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [r.pac.id, r.vacuna, r.dosis, r.fecha, r.lote, r.laboratorio, medicoId]
    );
    log.ok(`${r.pac.nombre} ${r.pac.apellido} — ${r.vacuna} (${r.fecha})`);
    insertados++;
  }

  log.info(`${insertados} registros de vacunación creados`);
}


async function seedAuditoria() {
  log.section('Auditoría (accesos de ejemplo)');

  const { rows: usuarios } = await query(
    'SELECT id, rol FROM usuarios ORDER BY id'
  );
  const { rows: pacientes } = await query(
    'SELECT id FROM pacientes ORDER BY id LIMIT 6'
  );

  if (!usuarios.length || !pacientes.length) {
    log.warn('Sin usuarios o pacientes'); return;
  }

  const { rows: tables } = await query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='auditoria_accesos'"
  );
  if (!tables.length) {
    log.warn('Tabla auditoria_accesos no existe — omitiendo');
    return;
  }

  const acciones = ['ver', 'ver', 'ver', 'modificar', 'exportar'];
  const ips = ['192.168.1.10', '192.168.1.12', '10.0.0.5', '10.0.0.8'];
  const dispositivos = ['Chrome 124 / Windows', 'Safari 17 / macOS', 'Chrome 124 / Android'];

  let insertados = 0;

  for (let i = 0; i < 15; i++) {
    const usuario  = usuarios[i % usuarios.length];
    const paciente = pacientes[i % pacientes.length];
    const accion   = acciones[i % acciones.length];
    const ts       = new Date();
    ts.setMinutes(ts.getMinutes() - i * 23);

    await query(
      `INSERT INTO auditoria_accesos
         (usuario_id, paciente_id, accion, ip, dispositivo, timestamp)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [usuario.id, paciente.id, accion, ips[i % ips.length], dispositivos[i % dispositivos.length], ts]
    );
    insertados++;
  }

  log.info(`${insertados} registros de auditoría creados`);
}


// ─── Clean ────────────────────────────────────────────────────────────────────
async function clean() {
  log.section('Limpiando datos seed...');

  const tables = [
    'auditoria_accesos', 'vacunacion', 'medicacion',
    'evoluciones', 'turnos', 'camas', 'pacientes', 'usuarios',
  ];

  for (const t of tables) {
    try {
      await query(`DELETE FROM ${t}`);
      log.ok(`${t} vaciada`);
    } catch (e) {
      log.warn(`${t}: ${e.message}`);
    }
  }
}


// ─── Runner principal ─────────────────────────────────────────────────────────
const MODULES = {
  usuarios:    seedUsuarios,
  pacientes:   seedPacientes,
  turnos:      seedTurnos,
  camas:       seedCamas,
  evoluciones: seedEvoluciones,
  medicacion:  seedMedicacion,
  vacunacion:  seedVacunacion,
  auditoria:   seedAuditoria,
};

async function run() {
  console.log('\n\x1b[1m\x1b[35m╔══════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[1m\x1b[35m║  MediGest Pro — Seeds v1.0           ║\x1b[0m');
  console.log('\x1b[1m\x1b[35m╚══════════════════════════════════════╝\x1b[0m');

  try {
    // Test de conexión
    await query('SELECT NOW()');
    log.ok('Conexión a PostgreSQL establecida\n');
  } catch (err) {
    log.error(`No se pudo conectar a la base de datos: ${err.message}`);
    process.exit(1);
  }

  if (CLEAN) {
    await clean();
    if (!MODULE && !args.some(a => a.startsWith('--module'))) {
      log.info('\nDatos eliminados. Usa --module=<nombre> o vuelve a ejecutar sin --clean para poblar.');
      await pool.end();
      return;
    }
  }

  if (MODULE) {
    if (!MODULES[MODULE]) {
      log.error(`Módulo desconocido: "${MODULE}". Disponibles: ${Object.keys(MODULES).join(', ')}`);
      process.exit(1);
    }
    await MODULES[MODULE]();
  } else {
    // Ejecutar todos en orden de dependencias
    for (const [name, fn] of Object.entries(MODULES)) {
      try {
        await fn();
      } catch (err) {
        log.error(`Error en módulo "${name}": ${err.message}`);
        if (process.env.SEED_FAIL_FAST === 'true') throw err;
      }
    }
  }

  console.log('\n\x1b[32m✔ Seeds completados\x1b[0m\n');
  await pool.end();
}

run().catch(err => {
  log.error(err.message);
  pool.end();
  process.exit(1);
});
