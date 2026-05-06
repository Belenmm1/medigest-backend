/**
 * src/app.js
 * Configuración de la aplicación Express.
 */

'use strict';

const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const compression  = require('compression');
const morgan       = require('morgan');
const cookieParser = require('cookie-parser');
const xss          = require('xss');
const env          = require('./config/env');
const logger       = require('./config/logger');

// Middlewares propios
const { globalLimiter }  = require('./middlewares/rateLimiter');
const errorHandler       = require('./middlewares/errorHandler');
const { authenticate }   = require('./middlewares/auth');

// --- RUTAS (IMPORTACIÓN ÚNICA) ---

const authRoutes      = require('./routes/auth.routes');
const pacientesRoutes = require('./routes/pacientes.routes'); 
const turnosRoutes    = require('./routes/turnos.routes');

const app = express();

/* ─── SEGURIDAD ──────────────────────────────────────────────────── */

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// 1. Definimos una lista extendida de orígenes para desarrollo
const allowedOrigins = [
  ...env.CORS_ORIGINS.split(',').map(o => o.trim()),
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'null' // 👈 Esto permite que el origen 'null' del navegador no sea rebotado
];

app.use(cors({
  origin: (origin, callback) => {
    // Permitimos la conexión si no hay origin (ej: Postman) o si está en la lista
    if (!origin || allowedOrigins.includes(origin) || origin === 'null') {
      callback(null, true);
    } else {
      logger.warn({ origin }, 'CORS bloqueado');
      callback(new Error(`CORS: Origen no permitido: ${origin}`));
    }
  },
  credentials: true,
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
app.use('/api/pacientes', authenticate, pacientesRoutes);
app.use('/api/turnos',    authenticate, turnosRoutes);

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