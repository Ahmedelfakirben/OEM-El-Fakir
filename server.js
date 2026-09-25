/**
 * server.js
 * API Gateway + servidor de archivos estáticos para OEM Driver Matrix Explorer.
 * Express.js con cors, helmet, manejo de errores y timeout de 10s.
 */

'use strict';

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const fs      = require('fs');
const path    = require('path');

const { fetchDrivers: lenovoFetch }              = require('./lib/lenovoService');
const { fetchDrivers: hpFetch, getKnownPlatforms } = require('./lib/hpService');
const { generatePowerShellScript }                = require('./lib/scriptGeneratorService');
const fleetStorage                                = require('./lib/fleetStorageService');

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
      defaultSrc:    ["'self'"],
      scriptSrc:     ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      scriptSrcElem: ["'self'", "'unsafe-inline'"],
      styleSrc:      ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:       ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:        ["'self'", 'data:'],
      connectSrc:    ["'self'"],
    },
  },
}));

// CORS: permite conexiones desde el dashboard y agentes clientes en red
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
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
// API de Flota Corporativa y Políticas
// ------------------------------------------------------------------

// Métricas de la flota
app.get('/api/fleet/stats', (_req, res) => {
  res.json(fleetStorage.getFleetStats());
});

// Listado de dispositivos
app.get('/api/fleet/devices', (req, res) => {
  const group = req.query.group || '';
  res.json(fleetStorage.getDevices(group));
});

// Detalle de un dispositivo con su inventario de controladores
app.get('/api/fleet/devices/:id', (req, res) => {
  const dev = fleetStorage.getDeviceById(req.params.id);
  if (!dev) return res.status(404).json({ error: 'Dispositivo no encontrado' });
  res.json(dev);
});

// Cambiar grupo de un dispositivo (Piloto, General, VIP)
app.put('/api/fleet/devices/:id/group', (req, res) => {
  const { group } = req.body || {};
  if (!group) return res.status(400).json({ error: 'Grupo requerido' });
  const updated = fleetStorage.setDeviceGroup(req.params.id, group);
  res.json(updated);
});

// Lanzar orden de despliegue para un dispositivo
app.post('/api/fleet/devices/:id/deploy', (req, res) => {
  const { drivers = [], criticalOnly = false } = req.body || {};
  const dev = fleetStorage.getDeviceById(req.params.id);
  if (!dev) return res.status(404).json({ error: 'Dispositivo no encontrado' });

  let toDeploy = drivers;
  if (!toDeploy || toDeploy.length === 0) {
    toDeploy = (dev.drivers || []).filter(d => {
      if (d.status === 'ACTUALIZADO') return false;
      if (criticalOnly) return String(d.severity).toLowerCase().includes('cr');
      return true;
    });
  }

  const task = fleetStorage.createDeploymentTask(req.params.id, toDeploy);
  res.json({ success: true, task, driversCount: toDeploy.length });
});

// Eliminar un dispositivo individual de la flota
app.delete('/api/fleet/devices/:id', (req, res) => {
  const success = fleetStorage.deleteDevice(req.params.id);
  res.json({ success, message: success ? 'Dispositivo eliminado' : 'No se pudo eliminar el dispositivo' });
});

// Purgar dispositivos de prueba / demostración
app.post('/api/fleet/clear-demo', (_req, res) => {
  const count = fleetStorage.clearDemoDevices();
  res.json({ success: true, count, message: `Se eliminaron ${count} equipos de demostración` });
});

// Purgar todos los dispositivos de la flota (inicio limpio)
app.post('/api/fleet/purge', (_req, res) => {
  const success = fleetStorage.clearAllDevices();
  res.json({ success, message: 'Flota vaciada completamente. Lista para recibir clientes reales.' });
});

// Cargar flota de prueba (solo para pruebas si el usuario lo solicita explícitamente)
app.post('/api/fleet/seed-demo', (_req, res) => {
  fleetStorage.seedSampleDataIfEmpty();
  res.json({ success: true, message: 'Datos de prueba cargados correctamente' });
});

// Consulta de configuración y políticas de la flota
app.get('/api/fleet/settings', (_req, res) => {
  res.json(fleetStorage.getSettings());
});

// Guardar configuración y políticas
app.post('/api/fleet/settings', (req, res) => {
  const updated = fleetStorage.updateSettings(req.body);
  res.json({ success: true, settings: updated });
});

// ------------------------------------------------------------------
// API del Agente Cliente (Endpoints de comunicación y telemetría)
// ------------------------------------------------------------------

// Heartbeat / Check-in del cliente con telemetría completa
app.post('/api/agent/checkin', (req, res) => {
  const {
    deviceId,
    hostname,
    oem,
    modelId,
    modelName,
    osBuild,
    biosVersion,
    cpu,
    ram,
    serialNumber,
    macAddress,
    motherboard,
    osEdition,
    auditResults = []
  } = req.body || {};

  if (!deviceId) {
    return res.status(400).json({ error: 'deviceId es requerido' });
  }

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

  // 1. Guardar/actualizar dispositivo e inventario en base de datos
  const device = fleetStorage.registerOrUpdateDevice({
    id: deviceId,
    hostname,
    oem,
    modelId,
    modelName,
    osBuild,
    biosVersion,
    ipAddress: clientIp,
    cpu,
    ram,
    serialNumber,
    macAddress,
    motherboard,
    osEdition,
    auditResults
  });

  // 2. Evaluar directivas y tareas pendientes
  const settings = fleetStorage.getSettings();

  // Si la flota está en modo "Solo Saber / Auditoría", no enviar órdenes de instalación
  if (settings.fleet_mode === 'audit_only') {
    return res.json({
      action: 'none',
      mode: 'audit_only',
      message: 'Flota en modo solo monitorización (sin cambios en clientes)'
    });
  }

  // Comprobar si el modelo del equipo está habilitado para actualización
  const modelRule = (settings.model_rules && settings.model_rules[modelId]) || { enabled: true };
  if (modelRule.enabled === false) {
    return res.json({
      action: 'none',
      mode: 'model_paused',
      message: `Actualizaciones pausadas para el modelo ${modelId}`
    });
  }

  // Comprobar si el grupo del equipo está habilitado
  const groupRule = (settings.group_rules && settings.group_rules[device.group_name]) || { enabled: true };
  if (groupRule.enabled === false) {
    return res.json({
      action: 'none',
      mode: 'group_paused',
      message: `Actualizaciones pausadas para el grupo ${device.group_name}`
    });
  }

  // Comprobar si hay una tarea manual específica en cola para este equipo
  const pendingTask = fleetStorage.getPendingTaskForDevice(deviceId);
  if (pendingTask) {
    const drivers = JSON.parse(pendingTask.drivers_payload || '[]');
    return res.json({
      action: 'install',
      taskId: pendingTask.id,
      trigger: 'manual_dispatch',
      drivers
    });
  }

  // Comprobar si corresponde la ventana mensual programada
  if (settings.schedule_type === 'monthly') {
    const today = new Date().getDate();
    const scheduledDay = Number(settings.monthly_day) || 15;
    if (today === scheduledDay) {
      const pendingDrivers = auditResults.filter(d => {
        if (d.status === 'ACTUALIZADO') return false;
        if (settings.critical_only || modelRule.criticalOnly) {
          return String(d.severity).toLowerCase().includes('cr');
        }
        return true;
      });

      if (pendingDrivers.length > 0) {
        const autoTask = fleetStorage.createDeploymentTask(deviceId, pendingDrivers);
        return res.json({
          action: 'install',
          taskId: autoTask ? autoTask.id : Date.now(),
          trigger: 'monthly_schedule',
          drivers: pendingDrivers
        });
      }
    }
  }

  // Ninguna orden pendiente
  res.json({
    action: 'none',
    mode: 'compliant',
    message: 'Equipo al día o fuera de ventana de actualización'
  });
});

// Reporte de resultado de instalación por el cliente
app.post('/api/agent/report', (req, res) => {
  const { taskId, exitCode, logOutput } = req.body || {};
  if (taskId) {
    fleetStorage.completeTask(taskId, exitCode ?? 0, logOutput || 'Completado');
  }
  res.json({ success: true, message: 'Reporte procesado' });
});

// Script de instalación/onboarding del agente cliente para Intune o PowerShell
app.get('/api/agent/install', (req, res) => {
  const host = req.headers.host || 'localhost:3000';
  const protocol = req.protocol || 'http';
  const serverUrl = `${protocol}://${host}`;

  const agentScript = `# ================================================================
# OEM Driver Explorer — Script de Instalacion y Registro del Agente
# Despliegue automatico para Microsoft Intune / PowerShell
# ================================================================

$ServerUrl = "${serverUrl}"
Write-Host "Instalando OEM Driver Agent (Servidor: $ServerUrl)..." -ForegroundColor Cyan

# 1. Identificar equipo
$cs = Get-CimInstance Win32_ComputerSystem
$bb = Get-CimInstance Win32_BaseBoard
$bios = Get-CimInstance Win32_Bios

$oem = if ($cs.Manufacturer -like "*Lenovo*") { "lenovo" } else { "hp" }
$modelId = if ($oem -eq "lenovo") {
    if ($cs.Model.Length -ge 4) { $cs.Model.Substring(0,4) } else { $cs.Model }
} else {
    $bb.Product
}

$deviceId = (Get-CimInstance Win32_ComputerSystemProduct).UUID
if (-not $deviceId) { $deviceId = "$($env:COMPUTERNAME)-$modelId" }

Write-Host "Equipo identificado: $($env:COMPUTERNAME) | $oem | $modelId | UUID: $deviceId" -ForegroundColor White

# 2. Directorio de instalacion
$installDir = "C:\\Program Files\\OEMDriverAgent"
if (-not (Test-Path $installDir)) { New-Item -ItemType Directory -Path $installDir -Force | Out-Null }

# 3. Guardar configuracion del cliente
$config = @{
    ServerUrl = $ServerUrl
    DeviceId = $deviceId
    OEM = $oem
    ModelId = $modelId
    IntervalMinutes = 120
}
$config | ConvertTo-Json | Out-File (Join-Path $installDir "config.json") -Encoding UTF8

Write-Host "Configuracion guardada en $installDir\\config.json" -ForegroundColor Green

# 4. Crear tarea programada en Windows (SYSTEM)
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -Command \`"irm $ServerUrl/api/script/$oem/$modelId | iex\`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName "OEMDriverAuditorAgent" -Action $action -Trigger $trigger -Settings $settings -User "NT AUTHORITY\\SYSTEM" -RunLevel Highest -Force | Out-Null

Write-Host "(OK) Agente registrado exitosamente como Tarea de Windows (NT AUTHORITY\\SYSTEM)." -ForegroundColor Green
Write-Host "El equipo ya esta vinculado y reportando a $ServerUrl" -ForegroundColor Cyan
`;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(agentScript);
});

// Descarga directa del instalador MSI para agentes clientes (Intune)
app.get('/api/agent/download-msi', (_req, res) => {
  const msiPath = path.join(__dirname, 'public', 'downloads', 'OEM-Client-Agent-1.0.0.msi');
  if (fs.existsSync(msiPath)) {
    return res.download(msiPath, 'OEM-Client-Agent-1.0.0.msi');
  }

  const rootMsiPath = path.join(__dirname, '..', 'OEM-Client-Agent-1.0.0.msi');
  if (fs.existsSync(rootMsiPath)) {
    return res.download(rootMsiPath, 'OEM-Client-Agent-1.0.0.msi');
  }

  res.status(404).json({
    error: 'Instalador MSI no disponible aún en el servidor.'
  });
});

// ------------------------------------------------------------------
// Estado de Salud de Conectores y APIs Oficiales
// ------------------------------------------------------------------
app.get('/api/connectors/status', async (_req, res) => {
  const desktopHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Referer': 'https://pcsupport.lenovo.com/',
    'Origin': 'https://pcsupport.lenovo.com'
  };

  const checks = [
    {
      id: 'lenovo',
      name: 'Lenovo PC Support API v4',
      provider: 'Lenovo Group Ltd.',
      endpoint: 'https://pcsupport.lenovo.com/es/es/api/v4/downloads/drivers',
      probeUrl: 'https://pcsupport.lenovo.com/es/es/api/v4/downloads/drivers?productId=20W0',
      headers: desktopHeaders,
      method: 'GET',
      protocol: 'REST / JSON (HTTPS)',
      description: 'Catálogo oficial de controladores, firmwares UEFI/BIOS y paquetes SCCM para ThinkPad, ThinkCentre y ThinkStation.'
    },
    {
      id: 'hp',
      name: 'HP Image Assistant & SoftPaq CDN',
      provider: 'HP Development Company, L.P.',
      endpoint: 'https://ftp.hp.com/pub/softpaq/',
      probeUrl: 'https://ftp.hp.com/pub/softpaq/sp142501-143000/sp142980.exe',
      headers: {},
      method: 'HEAD',
      protocol: 'HTTP / HTTPS CDN',
      description: 'Repositorio oficial SoftPaq corporativo de Hewlett-Packard para portátiles EliteBook, ProBook y ZBook Workstations.'
    },
    {
      id: 'microsoft',
      name: 'Microsoft Update Catalog & WHQL',
      provider: 'Microsoft Corporation',
      endpoint: 'https://www.catalog.update.microsoft.com',
      probeUrl: 'https://www.catalog.update.microsoft.com/',
      headers: {},
      method: 'GET',
      protocol: 'HTTPS / WHQL Taxonomy',
      description: 'Catálogo oficial de controladores certificados y firmados digitalmente para distribución mediante Windows Update y WSUS.'
    },
    {
      id: 'fleet_core',
      name: 'Servidor Local OEM Auditor Core',
      provider: 'OEM Driver Auditor (Instancia Local)',
      endpoint: `http://localhost:${PORT}/api/health`,
      probeUrl: `http://localhost:${PORT}/api/health`,
      headers: {},
      method: 'GET',
      protocol: 'REST / SQLite WAL',
      description: 'Base de datos de flota, motor de auditoría de agentes clientes y servidor de políticas corporativas.'
    }
  ];

  const results = await Promise.all(checks.map(async (c) => {
    const start = Date.now();
    try {
      const resp = await fetch(c.probeUrl, {
        method: c.method,
        headers: c.headers,
        signal: AbortSignal.timeout(6000)
      });
      const latency = Date.now() - start;
      const isOk = resp.status >= 200 && resp.status < 400;
      return {
        id: c.id,
        name: c.name,
        provider: c.provider,
        endpoint: c.endpoint,
        status: isOk ? 'online' : 'degraded',
        statusCode: resp.status,
        latencyMs: latency,
        protocol: c.protocol,
        description: c.description,
        lastChecked: new Date().toISOString()
      };
    } catch (err) {
      const latency = Date.now() - start;
      return {
        id: c.id,
        name: c.name,
        provider: c.provider,
        endpoint: c.endpoint,
        status: 'offline',
        statusCode: 0,
        latencyMs: latency,
        error: err.message,
        protocol: c.protocol,
        description: c.description,
        lastChecked: new Date().toISOString()
      };
    }
  }));

  const totalOnline = results.filter(r => r.status === 'online').length;
  res.json({
    summary: {
      total: results.length,
      online: totalOnline,
      allOperational: totalOnline === results.length,
      timestamp: new Date().toISOString()
    },
    connectors: results
  });
});

// ------------------------------------------------------------------
// Vistas Dedicadas HTML (Arquitectura Modular)
// ------------------------------------------------------------------
app.get('/flota', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'flota.html'));
});

app.get('/equipo', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'equipo.html'));
});

app.get('/configuracion', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'configuracion.html'));
});

app.get('/conectores', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'conectores.html'));
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

