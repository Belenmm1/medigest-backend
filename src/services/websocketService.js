'use strict';

const { WebSocketServer, WebSocket } = require('ws');
const { verifyToken } = require('./tokenService');
const logger = require('../config/logger');

// ---------------------------------------------------------------------------
// Tipos de evento válidos
// ---------------------------------------------------------------------------
const EVENTOS = {
  TURNO_LLEGADA:   'turno_llegada',
  RESULTADO_LAB:   'resultado_lab',
  CAMA_LIBERADA:   'cama_liberada',
  GUARDIA_INGRESO: 'guardia_ingreso',
  MENSAJE_NUEVO:   'mensaje_nuevo',
  PING:            'ping',
  PONG:            'pong',
  ERROR:           'error',
};

// ---------------------------------------------------------------------------
// ConnectionManager
// ---------------------------------------------------------------------------
class ConnectionManager {
  constructor() {
    /**
     * Map<usuarioId (number), Set<WebSocket>>
     * Un mismo usuario puede tener múltiples pestañas abiertas.
     */
    this.clientes = new Map();
  }

  /**
   * Registra una nueva conexión autenticada.
   * @param {number} usuarioId
   * @param {WebSocket} ws
   */
  agregar(usuarioId, ws) {
    if (!this.clientes.has(usuarioId)) {
      this.clientes.set(usuarioId, new Set());
    }
    this.clientes.get(usuarioId).add(ws);
    logger.info(`[WS] Conexión abierta — usuario ${usuarioId} | total: ${this.totalConexiones()}`);
  }

  /**
   * Elimina una conexión. Si el usuario no tiene más conexiones, elimina la entrada.
   * @param {number} usuarioId
   * @param {WebSocket} ws
   */
  eliminar(usuarioId, ws) {
    const sockets = this.clientes.get(usuarioId);
    if (!sockets) return;
    sockets.delete(ws);
    if (sockets.size === 0) this.clientes.delete(usuarioId);
    logger.info(`[WS] Conexión cerrada — usuario ${usuarioId} | total: ${this.totalConexiones()}`);
  }

  /**
   * Envía un mensaje a todos los clientes conectados.
   * @param {object} payload
   */
  broadcast(payload) {
    const mensaje = JSON.stringify(payload);
    let enviados = 0;
    for (const sockets of this.clientes.values()) {
      for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(mensaje);
          enviados++;
        }
      }
    }
    logger.debug(`[WS] broadcast '${payload.tipo}' → ${enviados} cliente(s)`);
  }

  /**
   * Envía un mensaje únicamente al usuario indicado (todas sus pestañas).
   * @param {number} usuarioId
   * @param {object} payload
   */
  enviarAUsuario(usuarioId, payload) {
    const sockets = this.clientes.get(usuarioId);
    if (!sockets) return;
    const mensaje = JSON.stringify(payload);
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) ws.send(mensaje);
    }
    logger.debug(`[WS] send_to_user ${usuarioId} '${payload.tipo}'`);
  }

  totalConexiones() {
    let n = 0;
    for (const s of this.clientes.values()) n += s.size;
    return n;
  }
}

// Instancia singleton exportada para usar desde controllers
const manager = new ConnectionManager();

// ---------------------------------------------------------------------------
// Inicialización del servidor WebSocket
// ---------------------------------------------------------------------------

/**
 * Adjunta el WebSocketServer al servidor HTTP existente de Express.
 *
 * Uso en src/index.js:
 *   const { initWebSocket } = require('./services/websocketService');
 *   initWebSocket(httpServer);
 *
 * @param {import('http').Server} httpServer
 */
function initWebSocket(httpServer) {
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws',
  });

  wss.on('connection', async (ws, req) => {
    // -----------------------------------------------------------------------
    // Autenticación por query param: /ws?token=<jwt>
    // -----------------------------------------------------------------------
    let usuario;
    try {
      const url    = new URL(req.url, `http://${req.headers.host}`);
      const token  = url.searchParams.get('token');

      if (!token) throw new Error('Token ausente');
      usuario = await verifyToken(token);          // lanza si el token es inválido
    } catch (err) {
      logger.warn(`[WS] Conexión rechazada: ${err.message}`);
      ws.send(JSON.stringify({ tipo: EVENTOS.ERROR, mensaje: 'No autorizado' }));
      ws.close(1008, 'No autorizado');
      return;
    }

    manager.agregar(usuario.id, ws);

    // Confirmar conexión al cliente
    ws.send(JSON.stringify({
      tipo:    'conectado',
      mensaje: `Bienvenido ${usuario.nombre_completo}`,
      ts:      new Date().toISOString(),
    }));

    // -----------------------------------------------------------------------
    // Mensajes entrantes (keepalive ping/pong)
    // -----------------------------------------------------------------------
    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw);
        if (data.tipo === EVENTOS.PING) {
          ws.send(JSON.stringify({ tipo: EVENTOS.PONG, ts: new Date().toISOString() }));
        }
      } catch {
        // Ignorar mensajes malformados
      }
    });

    // -----------------------------------------------------------------------
    // Cierre de conexión
    // -----------------------------------------------------------------------
    ws.on('close', () => manager.eliminar(usuario.id, ws));

    ws.on('error', (err) => {
      logger.error(`[WS] Error en socket usuario ${usuario.id}: ${err.message}`);
      manager.eliminar(usuario.id, ws);
    });
  });

  // Keepalive: cierra conexiones zombies cada 30 segundos
  const intervalo = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState !== WebSocket.OPEN) ws.terminate();
    });
  }, 30_000);

  wss.on('close', () => clearInterval(intervalo));

  logger.info('[WS] WebSocketServer iniciado en /ws');
  return wss;
}

// ---------------------------------------------------------------------------
// Helpers para emitir eventos desde cualquier controller
// ---------------------------------------------------------------------------

const emitir = {
  /**
   * Turno llegó a la sala de espera.
   * @param {{ paciente: string, hora: string, especialidad: string }} datos
   */
  turnoLlegada({ paciente, hora, especialidad }) {
    manager.broadcast({
      tipo: EVENTOS.TURNO_LLEGADA,
      paciente,
      hora,
      especialidad,
      ts: new Date().toISOString(),
    });
  },

  /**
   * Resultado de laboratorio disponible.
   * @param {{ paciente: string, estudio: string, medico_id: number }} datos
   */
  resultadoLab({ paciente, estudio, medico_id }) {
    manager.broadcast({
      tipo: EVENTOS.RESULTADO_LAB,
      paciente,
      estudio,
      medico_id,
      ts: new Date().toISOString(),
    });
  },

  /**
   * Cama liberada.
   * @param {{ cama: string, sector: string }} datos
   */
  camaLiberada({ cama, sector }) {
    manager.broadcast({
      tipo: EVENTOS.CAMA_LIBERADA,
      cama,
      sector,
      ts: new Date().toISOString(),
    });
  },

  /**
   * Nuevo ingreso a guardia.
   * @param {{ nivel_triage: string, paciente: string }} datos
   */
  guardiaIngreso({ nivel_triage, paciente }) {
    manager.broadcast({
      tipo: EVENTOS.GUARDIA_INGRESO,
      nivel_triage,
      paciente,
      ts: new Date().toISOString(),
    });
  },

  /**
   * Mensaje interno entre usuarios.
   * @param {{ destinatario_id: number, de: string, preview: string }} datos
   */
  mensajeNuevo({ destinatario_id, de, preview }) {
    manager.enviarAUsuario(destinatario_id, {
      tipo: EVENTOS.MENSAJE_NUEVO,
      de,
      preview,
      ts: new Date().toISOString(),
    });
  },
};

module.exports = { initWebSocket, manager, emitir, EVENTOS };
