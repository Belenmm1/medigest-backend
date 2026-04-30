/**
 * src/app.js
 * Configuración de la aplicación Express.
 * Separado de src/index.js para facilitar testing.
 */

'use strict';

const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const compression = require('compression');
const morgan     = require('morgan');
const cookieParser = require('cookie-parser');
const xss        = require('xss');
const env        = require('./config/env');
const logger     = require('./config/logger');

// Middlewares propios
const { globalLimiter }  = require('./middlewares/rateLimiter');
const errorHandler       = require('./middlewares/errorHandler');

// Rutas
const authRoutes         = require('./routes/auth.routes');
// Los demás módulos se irán añadiendo aquí:
// const pacientesRoutes = require('./routes/pacientes.routes');
// const turnosRoutes    = require('./routes/turnos.routes');

const app = express();

/* ─── SEGURIDAD ──────────────────────────────────────────────────── */

// Helmet: cabeceras de seguridad HTTP
app.use(helmet({
  contentSecurityPolicy: false, // Configurar según frontend
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS: solo orígenes permitidos
const allowedOrigins = env.CORS_ORIGINS.split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (ej: curl, mobile apps)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn({ origin }, 'CORS bloqueado');
      callback(new Error(`CORS: Origen no permitido: ${origin}`));
    }
  },
  credentials: true, // Necesario para cookies httpOnly
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));

/* ─── PARSING & COMPRESIÓN ───────────────────────────────────────── */

app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

/* ─── SANITIZACIÓN XSS ───────────────────────────────────────────── */

app.use((req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
});

function sanitizeObject(obj) {
  if (typeof obj === 'string') return xss(obj);
  if (Array.isArray(obj))     return obj.map(sanitizeObject);
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, sanitizeObject(v)])
    );
  }
  return obj;
}

/* ─── LOGGING HTTP ───────────────────────────────────────────────── */

// Morgan integrado con Pino
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
  skip: (req) => req.path === '/health',
}));

/* ─── REQUEST ID ─────────────────────────────────────────────────── */

app.use((req, _res, next) => {
  req.requestId = req.headers['x-request-id'] || require('uuid').v4();
  next();
});

/* ─── RATE LIMITING GLOBAL ───────────────────────────────────────── */

app.use(globalLimiter);

/* ─── HEALTH CHECK ───────────────────────────────────────────────── */

app.get('/health', async (req, res) => {
  try {
    const { healthCheck: dbCheck } = require('./config/database');
    const { healthCheck: redisCheck } = require('./config/redis');

    const [dbTime, redisOk] = await Promise.all([dbCheck(), redisCheck()]);

    res.json({
      status:  'ok',
      version: process.env.npm_package_version || '1.0.0',
      env:     env.NODE_ENV,
      checks: {
        database: { ok: true,    timestamp: dbTime },
        redis:    { ok: redisOk },
      },
    });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});

/* ─── RUTAS API ──────────────────────────────────────────────────── */

app.use('/api/auth',      authRoutes);
// app.use('/api/pacientes', authenticate, pacientesRoutes);
// app.use('/api/turnos',    authenticate, turnosRoutes);
// ... resto de módulos

/* ─── 404 ─────────────────────────────────────────────────────────── */

app.use((req, res) => {
  res.status(404).json({
    data:  null,
    meta:  {},
    error: { code: 'NOT_FOUND', message: `Ruta no encontrada: ${req.method} ${req.path}` },
  });
});

/* ─── ERROR HANDLER GLOBAL ───────────────────────────────────────── */

app.use(errorHandler);

module.exports = app;
