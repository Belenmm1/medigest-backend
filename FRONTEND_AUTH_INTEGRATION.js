/**
 * MÓDULO 01 — Integración frontend con la API de autenticación
 *
 * Este bloque reemplaza la función `intentarLogin()` del index.html
 * y añade el interceptor global de fetch para JWT.
 *
 * INSTRUCCIONES:
 *  1. Buscar la función `intentarLogin()` en index.html y reemplazarla
 *     por el código de abajo.
 *  2. Agregar el resto del bloque justo después.
 *  3. Ajustar API_BASE_URL al dominio real del backend.
 */

/* ─── CONFIGURACIÓN ──────────────────────────────────────────────── */
const API_BASE_URL = 'http://localhost:3000/api'; // Cambiar en producción

/* ─── ESTADO DE AUTENTICACIÓN ────────────────────────────────────── */
let accessToken = localStorage.getItem('mg_access_token') || null;

/**
 * Interceptor global de fetch: adjunta JWT a cada request y maneja
 * el refresco automático cuando el token expira (401).
 */
const originalFetch = window.fetch.bind(window);

async function apiFetch(url, options = {}) {
  // Añadir Authorization header si hay token
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let response = await originalFetch(url, { ...options, headers });

  // Si el access token expiró, intentar refrescar
  if (response.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      // Reintentar la request original con el nuevo token
      headers['Authorization'] = `Bearer ${accessToken}`;
      response = await originalFetch(url, { ...options, headers });
    } else {
      // Refresh falló — volver al login
      cerrarSesion();
      return response;
    }
  }

  return response;
}

/**
 * Intenta refrescar el access token usando el refresh token guardado.
 * @returns {boolean} true si se refrescó correctamente
 */
async function tryRefreshToken() {
  const refreshToken = localStorage.getItem('mg_refresh_token');
  if (!refreshToken) return false;

  try {
    const response = await originalFetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return false;

    const { data } = await response.json();
    accessToken = data.accessToken;
    localStorage.setItem('mg_access_token',  data.accessToken);
    localStorage.setItem('mg_refresh_token', data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

/* ─── LOGIN ──────────────────────────────────────────────────────── */

/**
 * Reemplaza la función `intentarLogin()` del index.html original.
 * Lee email/password del formulario y llama a la API real.
 */
async function intentarLogin() {
  const emailInput    = document.getElementById('loginEmail');
  const passInput     = document.getElementById('loginPassword');
  const btnLogin      = document.getElementById('btnLogin');
  const errorEl       = document.getElementById('loginError');

  const email    = emailInput?.value.trim()    || '';
  const password = passInput?.value            || '';

  // Validación básica en cliente
  if (!email || !password) {
    mostrarErrorLogin('Completá email y contraseña');
    return;
  }

  // Estado de carga
  if (btnLogin) {
    btnLogin.disabled = true;
    btnLogin.textContent = 'Ingresando...';
  }
  if (errorEl) errorEl.style.display = 'none';

  try {
    const response = await originalFetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const json = await response.json();

    if (!response.ok) {
      const msg = json?.error?.message || 'Credenciales incorrectas';
      mostrarErrorLogin(msg);
      return;
    }

    // Guardar tokens
    const { user, accessToken: at, refreshToken: rt } = json.data;
    accessToken = at;
    localStorage.setItem('mg_access_token',  at);
    localStorage.setItem('mg_refresh_token', rt);

    // Usar la función existente para entrar al sistema con el usuario real
    entrarAlSistema(user);

  } catch (err) {
    console.error('Error de red en login:', err);
    mostrarErrorLogin('Sin conexión con el servidor. Verificá que el backend esté corriendo.');
  } finally {
    if (btnLogin) {
      btnLogin.disabled = false;
      btnLogin.textContent = 'Ingresar';
    }
  }
}

function mostrarErrorLogin(mensaje) {
  const errorEl = document.getElementById('loginError');
  if (errorEl) {
    errorEl.textContent = mensaje;
    errorEl.style.display = 'block';
  }
}

/* ─── LOGOUT ─────────────────────────────────────────────────────── */

/**
 * Sobreescribe la función `cerrarSesion()` para notificar al backend.
 */
const _cerrarSesionOriginal = window.cerrarSesion;
window.cerrarSesion = async function() {
  try {
    const refreshToken = localStorage.getItem('mg_refresh_token');
    await apiFetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // Cerrar sesión localmente aunque falle el backend
  } finally {
    accessToken = null;
    localStorage.removeItem('mg_access_token');
    localStorage.removeItem('mg_refresh_token');
    // Llamar al cierre visual original
    if (typeof _cerrarSesionOriginal === 'function') {
      _cerrarSesionOriginal();
    }
  }
};

/* ─── AUTO-LOGIN si hay token válido ─────────────────────────────── */

(async function checkExistingSession() {
  if (!accessToken) return;

  try {
    const response = await apiFetch(`${API_BASE_URL}/auth/me`);
    if (response.ok) {
      const { data: user } = await response.json();
      // Entrar directamente sin pasar por el formulario de login
      entrarAlSistema(user);
    } else {
      // Token inválido — limpiar
      localStorage.removeItem('mg_access_token');
      localStorage.removeItem('mg_refresh_token');
      accessToken = null;
    }
  } catch {
    // Sin conexión — mantener pantalla de login
  }
})();
