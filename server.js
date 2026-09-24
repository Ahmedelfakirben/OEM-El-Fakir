/**
 * server.js
 * API Gateway + servidor de archivos estáticos para OEM Driver Matrix Explorer.
 * Express.js con cors, helmet, manejo de errores y timeout de 10s.
 */

'use strict';

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const path    = require('path');

const { fetchDrivers: lenovoFetch }              = require('./lib/lenovoService');
const { fetchDrivers: hpFetch, getKnownPlatforms } = require('./lib/hpService');
const { generatePowerShellScript }                = require('./lib/scriptGeneratorService');

// ------------------------------------------------------------------
// Configuración
// ------------------------------------------------------------------
const PORT          = process.env.PORT || 3000;
const REQUEST_TIMEOUT_MS = 12_000; // Timeout global (ligeramente mayor que el de los servicios)

// ------------------------------------------------------------------
// Inicialización de Express
// ------------------------------------------------------------------
const app = express();

// Seguridad HTTP básica
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'"],
      styleSrc:    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:      ["'self'", 'data:'],
      connectSrc:  ["'self'"],
    },
  },
}));

// CORS: permite el mismo origen (frontend servido por Express)
// En producción interna podrías añadir dominios corporativos específicos.
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET'],
}));

app.use(express.json());

// Sirve el frontend desde /public con control de cache estricto para desarrollo
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  },
}));

// ------------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------------

/**
 * Middleware de timeout: rechaza la petición con 504 si tarda demasiado.
 */
function timeoutMiddleware(ms) {
  return (req, res, next) => {
    const id = setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({
          error:   'Gateway Timeout',
          message: `La petición tardó más de ${ms / 1000}s en completarse`,
          code:    'TIMEOUT',
        });
      }
    }, ms);
    res.on('finish', () => clearTimeout(id));
    next();
  };
}

/**
 * Valida que un ID tenga exactamente 4 caracteres alfanuméricos.
 */
function validateId(id, label) {
  if (!id || typeof id !== 'string') {
    const e = new Error(`${label} es requerido`);
    e.statusCode = 400;
    throw e;
  }
  const clean = id.trim();
  if (clean.length < 4 || clean.length > 8) {
    const e = new Error(
      `${label} debe tener entre 4 y 8 caracteres (recibido: "${clean}")`
    );
    e.statusCode = 400;
    throw e;
  }
  if (!/^[A-Za-z0-9_-]+$/.test(clean)) {
    const e = new Error(
      `${label} solo puede contener caracteres alfanuméricos (recibido: "${clean}")`
    );
    e.statusCode = 400;
    throw e;
  }
  return clean;
}

/**
 * Manejador centralizado de errores de servicio → respuesta HTTP apropiada.
 */
function handleServiceError(err, res, context) {
  const code    = err.statusCode || 500;
  const message = err.message || 'Error interno del servidor';

  console.error(`[${new Date().toISOString()}] ERROR ${context}: ${message}`);

  const payload = {
    error:   getErrorTitle(code),
    message,
    code:    err.code || String(code),
    context,
  };

  if (!res.headersSent) {
    res.status(code).json(payload);
  }
}

function getErrorTitle(code) {
  const titles = {
    400: 'Bad Request',
    404: 'Not Found',
    502: 'Bad Gateway',
    504: 'Gateway Timeout',
    500: 'Internal Server Error',
  };
  return titles[code] || 'Error';
}

// ------------------------------------------------------------------
// Rutas de API
// ------------------------------------------------------------------

/**
 * GET /api/health
 * Comprueba que el servidor está operativo.
 */
app.get('/api/health', (req, res) => {
  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    version:   '1.0.0',
    services:  ['lenovo', 'hp'],
  });
});

/**
 * GET /api/platforms/hp
 * Devuelve la lista de plataformas HP disponibles en el catálogo embebido.
 */
app.get('/api/platforms/hp', (req, res) => {
  const platforms = getKnownPlatforms();
  res.json({
    count:     platforms.length,
    platforms,
  });
});

/**
 * GET /api/drivers/lenovo/:machineType
 * Devuelve los drivers normalizados para un machineType de Lenovo.
 *
 * Parámetros de ruta:
 *   :machineType — Código de 4 caracteres del modelo ThinkPad/ThinkCentre (ej. 20W0)
 */
app.get('/api/drivers/lenovo/:machineType', timeoutMiddleware(REQUEST_TIMEOUT_MS), async (req, res) => {
  const start = Date.now();
  let machineType;

  try {
    machineType = validateId(req.params.machineType, 'machineType');
  } catch (err) {
    return handleServiceError(err, res, 'lenovo-validate');
  }

  console.log(`[${new Date().toISOString()}] GET /api/drivers/lenovo/${machineType}`);

  try {
    const drivers = await lenovoFetch(machineType);
    const elapsed = Date.now() - start;

    res.json({
      oem:        'Lenovo',
      machineType,
      count:      drivers.length,
      elapsed_ms: elapsed,
      drivers,
    });
  } catch (err) {
    handleServiceError(err, res, `lenovo/${machineType}`);
  }
});

/**
 * GET /api/drivers/hp/:platformId
 * Devuelve los drivers normalizados para un platformId de HP.
 *
 * Parámetros de ruta:
 *   :platformId — System Board ID hexadecimal (ej. 880D)
 *
 * Parámetros de query:
 *   ?os=win11-64 (default) | win10-64
 */
app.get('/api/drivers/hp/:platformId', timeoutMiddleware(REQUEST_TIMEOUT_MS), async (req, res) => {
  const start = Date.now();
  let platformId;

  try {
    platformId = validateId(req.params.platformId, 'platformId');
  } catch (err) {
    return handleServiceError(err, res, 'hp-validate');
  }

  const allowedOS = ['win11-64', 'win10-64', 'win10-32'];
  let os = (req.query.os || 'win11-64').toLowerCase();
  if (!allowedOS.includes(os)) {
    os = 'win11-64';
  }

  console.log(`[${new Date().toISOString()}] GET /api/drivers/hp/${platformId}?os=${os}`);

  try {
    const drivers = await hpFetch(platformId, os);
    const elapsed = Date.now() - start;

    res.json({
      oem:        'HP',
      platformId,
      os,
      count:      drivers.length,
      elapsed_ms: elapsed,
      drivers,
    });
  } catch (err) {
    handleServiceError(err, res, `hp/${platformId}`);
  }
});

/**
 * GET /api/script/:oem/:modelId
 * Genera dinámicamente un script PowerShell para auditoría e instalación interactiva en equipos cliente.
 * Soporta descarga directa (?download=1) o ejecución con:
 *   irm http://<host>:3000/api/script/:oem/:modelId | iex
 */
app.get('/api/script/:oem/:modelId', timeoutMiddleware(REQUEST_TIMEOUT_MS), async (req, res) => {
  const oem = (req.params.oem || '').toLowerCase();
  let modelId;

  try {
    modelId = validateId(req.params.modelId, 'modelId');
  } catch (err) {
    return handleServiceError(err, res, 'script-validate');
  }

  const isDownload = req.query.download === '1' || req.query.download === 'true';

  try {
    let drivers = [];
    if (oem === 'hp') {
      drivers = await hpFetch(modelId, 'win11-64');
    } else {
      drivers = await lenovoFetch(modelId);
    }

    const script = generatePowerShellScript(oem, modelId, modelId, drivers);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    if (isDownload) {
      res.setHeader('Content-Disposition', `attachment; filename="auditar-${oem}-${modelId}.ps1"`);
    }

    res.send(script);
  } catch (err) {
    handleServiceError(err, res, `script/${oem}/${modelId}`);
  }
});

// ------------------------------------------------------------------
// Fallback SPA: cualquier ruta no-API sirve el index.html
// ------------------------------------------------------------------
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ------------------------------------------------------------------
// Manejador global de errores Express
// ------------------------------------------------------------------
app.use((err, req, res, _next) => {
  console.error(`[${new Date().toISOString()}] UNHANDLED ERROR:`, err);
  if (!res.headersSent) {
    res.status(500).json({
      error:   'Internal Server Error',
      message: err.message || 'Error inesperado del servidor',
    });
  }
});

// ------------------------------------------------------------------
// Inicio del servidor
// ------------------------------------------------------------------
function startServer(port = PORT) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      const activePort = server.address().port;
      console.log('');
      console.log('  ╔══════════════════════════════════════════════════╗');
      console.log('  ║     OEM Driver Matrix Explorer  v1.0.0           ║');
      console.log('  ╠══════════════════════════════════════════════════╣');
      console.log(`  ║  Servidor:  http://localhost:${activePort}                  ║`);
      console.log('  ║  Health:    http://localhost:' + activePort + '/api/health        ║');
      console.log('  ║  Lenovo:    /api/drivers/lenovo/:machineType      ║');
      console.log('  ║  HP:        /api/drivers/hp/:platformId           ║');
      console.log('  ╚══════════════════════════════════════════════════╝');
      console.log('');
      resolve(server);
    });
    server.on('error', reject);
  });
}

if (require.main === module) {
  startServer(PORT).catch(err => {
    console.error('Error al iniciar servidor Express:', err);
  });
}

module.exports = { app, startServer };

