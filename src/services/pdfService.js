/**
 * src/services/pdfService.js
 * Generación de PDFs de HCE usando Handlebars + Puppeteer.
 *
 * Stack Node.js: no usamos WeasyPrint (Python).
 * Puppeteer renderiza el template HTML a PDF con calidad de impresión.
 *
 * Dependencias a agregar en package.json:
 *   "handlebars": "^4.7.8"
 *   "puppeteer-core": "^22.0.0"
 *   "@sparticuz/chromium": "^123.0.0"   ← Chromium sin instalar Chrome
 */

'use strict';

const path        = require('path');
const fs          = require('fs');
const Handlebars  = require('handlebars');
const logger      = require('../config/logger');

// ── Template ──────────────────────────────────────────────────────────
const TEMPLATE_PATH = path.join(__dirname, '../../templates/hce.html');
let   _template     = null;

function getTemplate() {
  if (!_template) {
    const source = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    _template = Handlebars.compile(source);
  }
  return _template;
}

// ── Helpers Handlebars ─────────────────────────────────────────────────
Handlebars.registerHelper('capitalize', (str) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1) : ''
);

Handlebars.registerHelper('formatFecha', (fecha) => {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
});

Handlebars.registerHelper('formatFechaHora', (fecha) => {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
});

Handlebars.registerHelper('calcEdad', (fechaNac) => {
  if (!fechaNac) return '?';
  const hoy   = new Date();
  const nac   = new Date(fechaNac);
  let   edad  = hoy.getFullYear() - nac.getFullYear();
  const m     = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
});

Handlebars.registerHelper('splitAlergias', (alergias) => {
  if (!alergias) return [];
  return alergias.split(',').map(a => a.trim()).filter(Boolean);
});

Handlebars.registerHelper('ifExists', function(val, options) {
  return val ? options.fn(this) : options.inverse(this);
});

// ── Renderizar HTML ────────────────────────────────────────────────────
function renderHtml(data) {
  const template = getTemplate();
  return template(data);
}

// ── Generar PDF ────────────────────────────────────────────────────────
async function generarPDF({ paciente, evoluciones, medicacion, exportadoPor }) {
  const ahora = new Date();
  const fechaGen = ahora.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const html = renderHtml({
    paciente,
    evoluciones:       evoluciones  || [],
    medicacion:        medicacion   || [],
    fecha_generacion:  fechaGen,
    exportado_por:     exportadoPor,
  });

  // Intentar con Puppeteer; fallback a html2pdf-node si no está disponible
  let pdfBuffer;
  try {
    pdfBuffer = await generarConPuppeteer(html);
  } catch (err) {
    logger.warn({ err: err.message }, 'Puppeteer no disponible, usando html-pdf-node');
    pdfBuffer = await generarConHtmlPdf(html);
  }

  return pdfBuffer;
}

async function generarConPuppeteer(html) {
  // Importación dinámica para no romper si no está instalado
  let puppeteer;
  try {
    puppeteer = require('puppeteer-core');
    const chromium = require('@sparticuz/chromium');
    const browser = await puppeteer.launch({
      args:            chromium.args,
      executablePath:  await chromium.executablePath(),
      headless:        chromium.headless,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format:          'A4',
      printBackground: true,
      margin: { top: '18mm', right: '16mm', bottom: '22mm', left: '16mm' },
      displayHeaderFooter: false,
    });
    await browser.close();
    return Buffer.from(pdf);
  } catch (err) {
    // Si no hay puppeteer-core instalado, intentar con puppeteer estándar
    puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format:          'A4',
      printBackground: true,
      margin: { top: '18mm', right: '16mm', bottom: '22mm', left: '16mm' },
    });
    await browser.close();
    return Buffer.from(pdf);
  }
}

async function generarConHtmlPdf(html) {
  const htmlPdf = require('html-pdf-node');
  const file    = { content: html };
  const options = {
    format: 'A4',
    margin: { top: '18mm', right: '16mm', bottom: '22mm', left: '16mm' },
    printBackground: true,
  };
  return htmlPdf.generatePdf(file, options);
}

module.exports = { generarPDF, renderHtml };
