## 🔗 Ecosistema del Proyecto
Para un funcionamiento integral, este repositorio se conecta con nuestra API dedicada. Puedes encontrar la documentación y el código del lado del servidor aquí:

*   **Repositorio Backend:** [Belenmm1/medigest-backend](https://github.com/Belenmm1/medigest-backend)


# MediGest  — Backend

Backend profesional para el sistema de gestión MediGest.

**Stack:** Node.js 20 · Express · PostgreSQL 16 · Redis 7 · JWT · Docker

---

## Arquitectura

```
medigest-backend/
├── src/
│   ├── config/
│   │   ├── env.js          # Validación de variables de entorno (envalid)
│   │   ├── database.js     # Pool PostgreSQL + helpers query/transaction
│   │   ├── redis.js        # Cliente Redis + helpers cache/blacklist
│   │   └── logger.js       # Logger estructurado (Pino)
│   │
│   ├── controllers/
│   │   └── authController.js   # HTTP handlers — solo request/response
│   │
│   ├── services/
│   │   ├── authService.js      # Lógica de negocio de auth
│   │   └── tokenService.js     # JWT: generación, verificación, rotación
│   │
│   ├── models/
│   │   └── User.js             # Queries SQL de usuarios
│   │
│   ├── middlewares/
│   │   ├── auth.js             # authenticate, authorize, selfOrAdmin
│   │   ├── rateLimiter.js      # Rate limiters por endpoint
│   │   ├── validate.js         # Factory de validación Zod
│   │   └── errorHandler.js     # Manejador centralizado de errores
│   │
│   ├── routes/
│   │   └── auth.routes.js      # Rutas /api/auth/*
│   │
│   ├── validations/
│   │   └── auth.validations.js # Schemas Zod para auth
│   │
│   ├── utils/
│   │   └── response.js         # createSuccess/createError/createPaginated
│   │
│   ├── app.js                  # Express app con middlewares
│   └── index.js                # Entry point + graceful shutdown
│
├── migrations/
│   └── 001_auth.sql            # Schema: usuarios + refresh_tokens
│
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── FRONTEND_AUTH_INTEGRATION.js  # Fragmento para integrar al index.html
└── package.json
```

---

## Setup rápido con Docker

```bash
# 1. Clonar y entrar al directorio
cd medigest-backend

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores (especialmente los secretos JWT)

# 3. Levantar todo
docker-compose up -d

# 4. Verificar que todo esté corriendo
curl http://localhost:3000/health
```

---

## Setup manual (sin Docker)

### Prerequisitos
- Node.js >= 20
- PostgreSQL 16
- Redis 7

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar entorno
cp .env.example .env
# Editar .env

# 3. Crear base de datos
psql -U postgres -c "CREATE DATABASE medigest_pro;"
psql -U postgres -c "CREATE USER medigest WITH PASSWORD 'medigest_secret_2024';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE medigest_pro TO medigest;"

# 4. Ejecutar migración
psql -U medigest -d medigest_pro -f migrations/001_auth.sql

# 5. Arrancar en desarrollo
npm run dev

# 6. Arrancar en producción
npm start
```

---

## Endpoints — Módulo 01: Autenticación

| Método | Ruta                        | Auth | Rate limit | Descripción                    |
|--------|-----------------------------|------|------------|--------------------------------|
| POST   | /api/auth/login             | ❌   | 10/15min   | Login con email + password     |
| POST   | /api/auth/refresh           | ❌   | 5/min      | Rotar refresh token            |
| POST   | /api/auth/logout            | ✅   | global     | Cerrar sesión                  |
| GET    | /api/auth/me                | ✅   | global     | Usuario autenticado            |
| POST   | /api/auth/change-password   | ✅   | global     | Cambiar contraseña             |
| GET    | /api/auth/sessions          | ✅   | global     | Sesiones activas               |
| GET    | /health                     | ❌   | -          | Health check (DB + Redis)      |

### Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@medigest.pro", "password": "Admin1234!"}'
```

Respuesta:
```json
{
  "data": {
    "user": { "id": "...", "nombre_completo": "Administrador del Sistema", "rol": "admin" },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  },
  "meta": {},
  "error": null
}
```

### Usuarios de prueba

| Email                       | Password    | Rol         |
|-----------------------------|-------------|-------------|
| admin@medigest.pro          | Admin1234!  | admin       |
| medico@medigest.pro         | Admin1234!  | medico      |
| enfermeria@medigest.pro     | Admin1234!  | enfermeria  |
| recepcion@medigest.pro      | Admin1234!  | recepcion   |

> ⚠️ Cambiar todas las contraseñas antes de cualquier deploy.

---

## Integración con el frontend

Ver `FRONTEND_AUTH_INTEGRATION.js` para el fragmento que reemplaza la función
`intentarLogin()` en `index.html` por llamadas reales a la API.

Características del interceptor incluido:
- Adjunta el JWT a cada request automáticamente
- Refresca el access token silenciosamente al expirar
- Redirige al login si el refresh también expiró
- Auto-login si hay sesión activa al abrir la página

---

## Seguridad implementada

- **bcrypt** rounds=12 para hashing de contraseñas
- **JWT** access (15min) + refresh (7d) con rotación y detección de reuso
- **Blacklist Redis** para tokens revocados antes de expirar
- **Rate limiting** por IP + email en /login (10 intentos/15min)
- **Helmet.js** con cabeceras HTTP de seguridad
- **CORS** restringido a orígenes configurados
- **Sanitización XSS** en todos los inputs del body
- **Soft deletes** — ningún registro se borra físicamente
- **Logs estructurados** con redacción automática de datos sensibles

---

## Próximos módulos

- 02 — Schema completo PostgreSQL (todas las tablas)
- 03 — API REST: Pacientes con historia clínica versionada
- 04 — API REST: Turnos con detección de conflictos
- 05 — WebSockets (sala de espera, camas en tiempo real)
- 06 — Queue de notificaciones (BullMQ + Redis)
- 07 — Exportación PDF de historia clínica
- 08 — Auditoría inmutable de accesos
