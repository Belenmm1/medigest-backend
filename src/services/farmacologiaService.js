/**
 * src/services/farmacologiaService.js
 * Consulta interacciones farmacológicas via OpenFDA.
 * Cachea resultados en Redis con TTL de 24hs.
 */

'use strict';

const { get: redisGet, set: redisSet } = require('../config/redis');
const logger = require('../config/logger');

const OPENFDA_BASE  = 'https://api.fda.gov/drug/label.json';
const CACHE_TTL     = 60 * 60 * 24;   // 24 horas
const TIMEOUT_MS    = 3000;            // 3 segundos por consulta

/**
 * Busca interacciones entre dos o más fármacos.
 *
 * @param {string[]} farmacos — lista de nombres de fármacos en inglés o español
 * @returns {{ interacciones: Array, sin_datos: string[] }}
 */
async function buscarInteracciones(farmacos) {
  if (!farmacos || farmacos.length < 2) {
    return { interacciones: [], sin_datos: [] };
  }

  const interacciones = [];
  const sin_datos     = [];

  // Comparar cada par de fármacos
  for (let i = 0; i < farmacos.length; i++) {
    for (let j = i + 1; j < farmacos.length; j++) {
      const a = farmacos[i].trim().toLowerCase();
      const b = farmacos[j].trim().toLowerCase();

      try {
        const resultado = await consultarPar(a, b);
        if (resultado) {
          interacciones.push(resultado);
        }
      } catch (err) {
        logger.warn({ err: err.message, farmacos: [a, b] }, 'Sin datos OpenFDA para este par');
        sin_datos.push(`${a} + ${b}`);
      }
    }
  }

  return { interacciones, sin_datos };
}

/**
 * Consulta OpenFDA para un par de fármacos específico.
 * Primero intenta el caché Redis.
 */
async function consultarPar(farmaco_a, farmaco_b) {
  const cacheKey = `fda:${[farmaco_a, farmaco_b].sort().join(':')}`;

  // 1. Intentar desde caché
  try {
    const cached = await redisGet(cacheKey);
    if (cached !== null) {
      logger.debug({ cacheKey }, 'Interacción obtenida desde caché');
      return cached === 'null' ? null : cached;
    }
  } catch (redisErr) {
    // Redis no disponible — degradación elegante
    logger.warn({ err: redisErr.message }, 'Redis no disponible, consultando OpenFDA directo');
  }

  // 2. Consultar OpenFDA con timeout
  const resultado = await consultarOpenFDA(farmaco_a, farmaco_b);

  // 3. Guardar en caché (incluso si es null, para no repetir consultas vacías)
  try {
    await redisSet(cacheKey, resultado === null ? 'null' : resultado, CACHE_TTL);
  } catch (redisErr) {
    logger.warn({ err: redisErr.message }, 'No se pudo guardar en caché Redis');
  }

  return resultado;
}

/**
 * Hace la consulta real a la API de OpenFDA.
 */
async function consultarOpenFDA(farmaco_a, farmaco_b) {
  const query    = encodeURIComponent(`drug_interactions:"${farmaco_b}"`);
  const search   = encodeURIComponent(farmaco_a);
  const url      = `${OPENFDA_BASE}?search=openfda.generic_name:"${search}"+AND+drug_interactions:${query}&limit=1`;

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 404) return null;  // Sin datos para este par

  if (!response.ok) {
    throw new Error(`OpenFDA respondió ${response.status}`);
  }

  const data = await response.json();

  if (!data.results || data.results.length === 0) return null;

  const label         = data.results[0];
  const interacciones = label.drug_interactions?.[0] || '';

  if (!interacciones) return null;

  // Determinar severidad a partir del texto
  const severidad = clasificarSeveridad(interacciones, farmaco_b);

  return {
    farmaco_a:   farmaco_a,
    farmaco_b:   farmaco_b,
    severidad,
    descripcion: truncar(interacciones, 500),
    fuente:      'OpenFDA',
  };
}

/**
 * Clasifica la severidad de la interacción según palabras clave en el texto.
 */
function clasificarSeveridad(texto, farmaco) {
  const t = texto.toLowerCase();
  const presencia = t.includes(farmaco.toLowerCase());

  if (!presencia) return 'informativa';

  if (
    t.includes('contraindicated') ||
    t.includes('avoid') ||
    t.includes('fatal') ||
    t.includes('serious')
  ) return 'severa';

  if (
    t.includes('caution') ||
    t.includes('monitor') ||
    t.includes('may increase') ||
    t.includes('may decrease')
  ) return 'moderada';

  return 'leve';
}

function truncar(texto, max) {
  if (!texto || texto.length <= max) return texto;
  return texto.slice(0, max) + '…';
}

module.exports = { buscarInteracciones };
