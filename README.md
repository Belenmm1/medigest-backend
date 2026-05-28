# MediGest Management Backend

Backend profesional del sistema de gestión hospitalaria **MediGest**.  
Está construido con **Node.js 20**, **Express**, **PostgreSQL**, **Redis** y **JWT**, con soporte para **Docker**, migraciones SQL y un módulo de autenticación completo.

## Stack principal

- Node.js 20+
- Express
- PostgreSQL 16
- Redis 7
- JWT
- Docker / Docker Compose

## Funcionalidades

- Autenticación con login, refresh token y logout
- Sesión de usuario autenticado (`/me`)
- Cambio de contraseña
- Listado de sesiones activas
- Validación de datos con Zod
- Seguridad con Helmet, CORS, rate limiting y sanitización de entradas
- Logger estructurado con Pino
- Migraciones de base de datos con `node-pg-migrate`
- Tests con Jest y Supertest
- Linting con ESLint

## Estructura del proyecto

```bash
medigest-backend/
├── src/
│   ├── config/
│   ├── controllers/
│   ├── services/
│   ├── models/
│   ├── middlewares/
│   ├── routes/
│   ├── validations/
│   ├── utils/
│   ├── app.js
│   └── index.js
├── migrations/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── FRONTEND_AUTH_INTEGRATION.js
└── package.json
```

## Requisitos

- Node.js >= 20
- PostgreSQL 16
- Redis 7

## Variables de entorno

Copiá el archivo de ejemplo y completá los valores:

```bash
cp .env.example .env
```

### Variables disponibles

```env
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

DB_HOST=localhost
DB_PORT=5432
DB_NAME=medigest_pro
DB_USER=medigest
DB_PASSWORD=medigest_secret_2024
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_SSL=false

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

JWT_SECRET=cambia_esto_por_un_secreto_muy_largo_y_aleatorio_minimo_64_chars
JWT_REFRESH_SECRET=otro_secreto_diferente_para_refresh_tokens_minimo_64_chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_LOGIN=10
RATE_LIMIT_MAX_GLOBAL=200

CORS_ORIGINS=http://localhost:8080,http://localhost:3001

LOG_LEVEL=debug
NOTIFICATION_QUEUE_CONCURRENCY=5
APP_URL=http://localhost:3000
```

## Instalación rápida con Docker

```bash
docker-compose up -d
curl http://localhost:3000/health
```

## Instalación manual

```bash
npm install
cp .env.example .env
```

Crear la base de datos y el usuario:

```bash
psql -U postgres -c "CREATE DATABASE medigest_pro;"
psql -U postgres -c "CREATE USER medigest WITH PASSWORD 'medigest_secret_2024';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE medigest_pro TO medigest;"
```

Ejecutar la migración:

```bash
psql -U medigest -d medigest_pro -f migrations/001_auth.sql
```

Levantar el proyecto:

```bash
npm run dev
```

## Scripts disponibles

```bash
npm start         # Ejecuta la app en producción
npm run dev       # Ejecuta con nodemon
npm run migrate   # Aplica migraciones
npm run migrate: down
npm run seed
npm test
npm run lint
```

## Endpoints de autenticación

| Método | Ruta | Auth | Rate limit | Descripción |
|---|---|---:|---:|---|
| POST | `/api/auth/login` | No | 10/15min | Login con email + password |
| POST | `/api/auth/refresh` | No | 5/min | Rotación de refresh token |
| POST | `/api/auth/logout` | Sí | Global | Cierre de sesión |
| GET | `/api/auth/me` | Sí | Global | Usuario autenticado |
| POST | `/api/auth/change-password` | Sí | Global | Cambio de contraseña |
| GET | `/api/auth/sessions` | Sí | Global | Sesiones activas |
| GET | `/health` | No | - | Health check de DB + Redis |

## Ejemplo de login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@medigest.pro","password":"Admin1234!"}'
```

Respuesta esperada:

```json
{
  "data": {
    "user": {
      "id": "...",
      "nombre_completo": "Administrador del Sistema",
      "rol": "admin"
    },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  },
  "meta": {},
  "error": null
}
```

## Usuarios de prueba

| Email | Password | Rol |
|---|---|---|
| admin@medigest.pro | Admin1234! | admin |
| medico@medigest.pro | Admin1234! | medico |
| enfermeria@medigest.pro | Admin1234! | enfermeria |
| recepcion@medigest.pro | Admin1234! | recepcion |

## Integración con frontend

El archivo `FRONTEND_AUTH_INTEGRATION.js` contiene el fragmento pensado para conectar este backend con el frontend del sistema.

---

