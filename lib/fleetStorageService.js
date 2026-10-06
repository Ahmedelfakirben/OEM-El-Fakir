/**
 * fleetStorageService.js
 * Capa de persistencia para la gestión de flota de clientes, inventarios y políticas.
 * Utiliza SQLite nativo (node:sqlite) con fallback automático a JSON atómico.
 * Totalmente compatible con volúmenes de Docker en Coolify.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'fleet.db');
const JSON_BACKUP_PATH = path.join(DATA_DIR, 'fleet.json');

// Configuración predeterminada de políticas de flota
const DEFAULT_SETTINGS = {
  fleet_mode: 'audit_only',       // 'audit_only' (solo saber / monitorizar) | 'scheduled' (actualización automática)
  schedule_type: 'monthly',       // 'monthly' (una vez al mes) | 'continuous' (en cada check-in) | 'manual'
  monthly_day: 15,                // Día del mes en que se ejecutan las actualizaciones
  critical_only: true,            // En modo automático, aplicar solo parches críticos de seguridad
  pilot_group_enabled: true,      // Despliegue anticipado para el grupo Piloto
  auto_retry_failed: true,        // Reintentar parches con fallo en siguiente ciclo
  model_rules: {                  // Políticas por modelo: true = habilitado, false = solo auditoría
    '20W7': { enabled: true, criticalOnly: true, name: 'ThinkPad L14 Gen 2 Intel' },
    '20L5': { enabled: true, criticalOnly: true, name: 'ThinkPad T480' },
    '20N2': { enabled: true, criticalOnly: true, name: 'ThinkPad T490' },
    '20U1': { enabled: true, criticalOnly: true, name: 'ThinkPad L14 G1' },
    '888A': { enabled: true, criticalOnly: true, name: 'HP ProBook 440 G8' },
    '8A4E': { enabled: true, criticalOnly: true, name: 'HP ProBook 440 G9' },
    '880D': { enabled: false, criticalOnly: true, name: 'HP EliteBook 840 G7' },
  },
  group_rules: {                  // Políticas por grupo de equipos
    'pilot': { enabled: true, name: 'Grupo Piloto / IT', immediate: true },
    'general': { enabled: true, name: 'Grupo General / Producción', immediate: false },
    'vip': { enabled: false, name: 'Grupo VIP / Dirección (Solo Auditoría)', immediate: false },
  }
};

let db = null;
let useJsonFallback = false;

// Inicialización de SQLite
try {
  const { DatabaseSync } = require('node:sqlite');
  db = new DatabaseSync(DB_PATH);

  // ─── PRAGMAs de rendimiento y seguridad (skill: sqlite-wal-indexing) ───
  db.exec('PRAGMA journal_mode = WAL;');       // Lecturas concurrentes sin bloqueo
  db.exec('PRAGMA synchronous = NORMAL;');     // Balance perfecto seguridad/rendimiento en WAL
  db.exec('PRAGMA foreign_keys = ON;');        // Integridad referencial
  db.exec('PRAGMA busy_timeout = 5000;');      // Espera hasta 5s ante bloqueos de escritura

  // Esquema de tablas
  db.exec(`
    CREATE TABLE IF NOT EXISTS deployment_rings (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      install_day TEXT,
      time_window_start TEXT,
      time_window_end TEXT,
      is_canary INTEGER DEFAULT 0,
      frequency TEXT DEFAULT 'weekly',
      allow_manual_update INTEGER DEFAULT 0
    );


    INSERT OR IGNORE INTO deployment_rings (id, name, install_day, time_window_start, time_window_end, is_canary)
    VALUES ('ring-0', 'Anillo 0 - Piloto/IT', 'Monday', '02:00', '05:00', 1);

    CREATE TABLE IF NOT EXISTS dynamic_catalogs (\n      platform_id TEXT PRIMARY KEY,\n      oem TEXT NOT NULL,\n      last_updated TEXT NOT NULL,\n      json_data TEXT NOT NULL\n    );\n
    CREATE TABLE IF NOT EXISTS hardware_baselines (
      id TEXT PRIMARY KEY,
      model_name TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'Quarantine',
      block_windows_update INTEGER DEFAULT 0,
      require_critical_only INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS fleet_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      hostname TEXT NOT NULL,
      oem TEXT NOT NULL,
      model_id TEXT NOT NULL,
      model_name TEXT NOT NULL,
      group_name TEXT DEFAULT 'general',
      os_build TEXT,
      bios_version TEXT,
      ip_address TEXT,
      cpu TEXT,
      ram TEXT,
      serial_number TEXT,
      mac_address TEXT,
      motherboard TEXT,
      os_edition TEXT,
      is_demo INTEGER DEFAULT 0,
      total_drivers INTEGER DEFAULT 0,
      uptodate_drivers INTEGER DEFAULT 0,
      outdated_drivers INTEGER DEFAULT 0,
      pending_drivers INTEGER DEFAULT 0,
      critical_pending INTEGER DEFAULT 0,
      compliance_rate INTEGER DEFAULT 100,
      last_seen TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS device_drivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      driver_name TEXT NOT NULL,
      category TEXT NOT NULL,
      installed_version TEXT NOT NULL,
      target_version TEXT NOT NULL,
      status TEXT NOT NULL,
      severity TEXT NOT NULL,
      is_admitted INTEGER DEFAULT 1,
      download_url TEXT,
      file_size TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS deployment_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      task_type TEXT DEFAULT 'install_updates',
      status TEXT DEFAULT 'pending',
      drivers_payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      exit_code INTEGER,
      log_output TEXT,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_user TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT NOT NULL,
      ip TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS client_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      FOREIGN KEY (machine_id) REFERENCES devices(id) ON DELETE CASCADE
    );
  `);

  // ─── Índices de rendimiento (skill: sqlite-wal-indexing) ───────────────
  db.exec(`
    -- Búsqueda rápida por número de serie (requisito explícito del sistema de distribución)
    CREATE INDEX IF NOT EXISTS idx_devices_serial_number
    ON devices (serial_number);

    -- Listado de dispositivos por grupo ordenado por última conexión (endpoint /api/fleet/devices)
    CREATE INDEX IF NOT EXISTS idx_devices_group_lastseen
    ON devices (group_name, last_seen DESC);

    -- Filtros por fabricante y modelo (detección de modelos, policy-impact)
    CREATE INDEX IF NOT EXISTS idx_devices_oem_model
    ON devices (oem, model_id);

    -- Lookup de controladores de un equipo con filtro de estado y severidad
    CREATE INDEX IF NOT EXISTS idx_device_drivers_lookup
    ON device_drivers (device_id, status, severity);

    -- Índice parcial: controladores críticos pendientes de instalación
    CREATE INDEX IF NOT EXISTS idx_drivers_critical_pending
    ON device_drivers (device_id)
    WHERE status = 'OUTDATED' AND severity = 'CRITICAL';

    -- Tareas de despliegue pendientes por dispositivo (getPendingTaskForDevice)
    CREATE INDEX IF NOT EXISTS idx_tasks_device_status
    ON deployment_tasks (device_id, status, created_at ASC);
  `);

  // Migración dinámica de columnas en bases de datos SQLite existentes
  try {
    const tableCols = db.prepare("PRAGMA table_info(devices)").all().map(c => c.name);
    if (!tableCols.includes('cpu')) db.exec("ALTER TABLE devices ADD COLUMN cpu TEXT;");
    if (!tableCols.includes('ram')) db.exec("ALTER TABLE devices ADD COLUMN ram TEXT;");
    if (!tableCols.includes('serial_number')) db.exec("ALTER TABLE devices ADD COLUMN serial_number TEXT;");
    if (!tableCols.includes('mac_address')) db.exec("ALTER TABLE devices ADD COLUMN mac_address TEXT;");
    if (!tableCols.includes('motherboard')) db.exec("ALTER TABLE devices ADD COLUMN motherboard TEXT;");
    if (!tableCols.includes('os_edition')) db.exec("ALTER TABLE devices ADD COLUMN os_edition TEXT;");
    if (!tableCols.includes('is_demo')) db.exec("ALTER TABLE devices ADD COLUMN is_demo INTEGER DEFAULT 0;");
    if (!tableCols.includes('ring_id')) db.exec("ALTER TABLE devices ADD COLUMN ring_id TEXT DEFAULT 'ring-0';");
  } catch (migErr) {
    console.warn('Advertencia en migración de columnas devices:', migErr.message);
  }
} catch (err) {
  console.warn('node:sqlite no disponible, usando almacenamiento JSON en disco:', err.message);
  useJsonFallback = true;
}

// ------------------------------------------------------------------
// Helpers JSON Fallback
// ------------------------------------------------------------------
function readJsonStore() {
  try {
    if (fs.existsSync(JSON_BACKUP_PATH)) {
      return JSON.parse(fs.readFileSync(JSON_BACKUP_PATH, 'utf8'));
    }
  } catch (e) {}
  return {
    settings: { ...DEFAULT_SETTINGS },
    devices: {},
    drivers: {},
    tasks: [],
  };
}

function writeJsonStore(data) {
  try {
    fs.writeFileSync(JSON_BACKUP_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error escribiendo JSON store:', e);
  }
}

// ------------------------------------------------------------------
// Gestión de Políticas y Configuración
// ------------------------------------------------------------------

function getSettings() {
  if (useJsonFallback) {
    const store = readJsonStore();
    return { ...DEFAULT_SETTINGS, ...store.settings };
  }

  try {
    const row = db.prepare('SELECT value FROM fleet_settings WHERE key = ?').get('fleet_config');
    if (row && row.value) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(row.value) };
    }
  } catch (e) {
    console.error('Error leyendo fleet_settings:', e);
  }
  return { ...DEFAULT_SETTINGS };
}

function updateSettings(newSettings) {
  const current = getSettings();
  const merged = { ...current, ...newSettings };
  const now = new Date().toISOString();

  if (useJsonFallback) {
    const store = readJsonStore();
    store.settings = merged;
    writeJsonStore(store);
    return merged;
  }

  try {
    db.prepare(`
      INSERT INTO fleet_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run('fleet_config', JSON.stringify(merged), now);
  } catch (e) {
    console.error('Error actualizando fleet_settings:', e);
  }

  return merged;
}

// ------------------------------------------------------------------
// Registro y Consulta de Dispositivos (Endpoints)
// ------------------------------------------------------------------

function getDevices(filterGroup = '') {
  if (useJsonFallback) {
    const store = readJsonStore();
    let list = Object.values(store.devices || {});
    if (filterGroup) {
      list = list.filter(d => d.group_name === filterGroup);
    }
    return list.sort((a, b) => new Date(b.last_seen) - new Date(a.last_seen));
  }

  try {
    if (filterGroup) {
      return db.prepare('SELECT * FROM devices WHERE group_name = ? ORDER BY last_seen DESC').all(filterGroup);
    }
    return db.prepare('SELECT * FROM devices ORDER BY last_seen DESC').all();
  } catch (e) {
    console.error('Error al obtener dispositivos:', e);
    return [];
  }
}

function getDetectedModels() {
  if (useJsonFallback) {
    const store = readJsonStore();
    const modelsMap = {};
    for (const d of Object.values(store.devices || {})) {
      if (!d.model_id) continue;
      if (!modelsMap[d.model_id]) {
        modelsMap[d.model_id] = { model_id: d.model_id, model_name: d.model_name, oem: d.oem, count: 0 };
      }
      modelsMap[d.model_id].count++;
    }
    return Object.values(modelsMap);
  }

  try {
    return db.prepare(`
      SELECT model_id, model_name, oem, COUNT(*) as count
      FROM devices
      WHERE model_id IS NOT NULL AND model_id != ''
      GROUP BY model_id
    `).all();
  } catch (e) {
    console.error('Error obteniendo modelos detectados:', e);
    return [];
  }
}

function getGroupCounts() {
  if (useJsonFallback) {
    const store = readJsonStore();
    const groupsMap = { pilot: 0, general: 0, vip: 0 };
    for (const d of Object.values(store.devices || {})) {
      const g = d.group_name || 'general';
      groupsMap[g] = (groupsMap[g] || 0) + 1;
    }
    return groupsMap;
  }

  try {
    const rows = db.prepare(`
      SELECT group_name, COUNT(*) as count
      FROM devices
      GROUP BY group_name
    `).all();
    const res = { pilot: 0, general: 0, vip: 0 };
    for (const r of rows) {
      if (r.group_name) res[r.group_name] = r.count;
    }
    return res;
  } catch (e) {
    console.error('Error obteniendo conteo de grupos:', e);
    return { pilot: 0, general: 0, vip: 0 };
  }
}

function getDeviceById(id) {
  if (useJsonFallback) {
    const store = readJsonStore();
    const dev = store.devices ? store.devices[id] : null;
    if (!dev) return null;
    const devDrivers = (store.drivers && store.drivers[id]) || [];
    const devTasks = (store.tasks || []).filter(t => t.device_id === id);
    return { ...dev, drivers: devDrivers, tasks: devTasks };
  }

  try {
    const dev = db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
    if (!dev) return null;
    const drivers = db.prepare('SELECT * FROM device_drivers WHERE device_id = ? ORDER BY status ASC, severity DESC').all(id);
    const tasks = db.prepare('SELECT * FROM deployment_tasks WHERE device_id = ? ORDER BY created_at DESC LIMIT 10').all(id);
    return { ...dev, drivers, tasks };
  } catch (e) {
    console.error('Error al obtener dispositivo por ID:', e);
    return null;
  }
}

function registerOrUpdateDevice(deviceData) {
  const {
    id,
    hostname,
    oem,
    modelId,
    modelName,
    osBuild,
    biosVersion,
    ipAddress,
    cpu,
    ram,
    serialNumber,
    macAddress,
    motherboard,
    osEdition,
    isDemo = 0,
    auditResults = []
  } = deviceData;

  const now = new Date().toISOString();

  // Calcular métricas del inventario
  const total = auditResults.length;
  const uptodate = auditResults.filter(d => d.status === 'ACTUALIZADO').length;
  const outdated = auditResults.filter(d => d.status === 'DESACTUALIZADO').length;
  const pending = auditResults.filter(d => d.status === 'PENDIENTE').length;
  const critical = auditResults.filter(d => (d.status === 'DESACTUALIZADO' || d.status === 'PENDIENTE') && String(d.severity).toLowerCase().includes('cr')).length;
  const compliance = total > 0 ? Math.round((uptodate / total) * 100) : 100;

  if (useJsonFallback) {
    const store = readJsonStore();
    const existing = store.devices[id] || {};
    const groupName = existing.group_name || 'general';

    store.devices[id] = {
      id,
      hostname: hostname || existing.hostname || 'DESCONOCIDO',
      oem: (oem || 'lenovo').toLowerCase(),
      model_id: modelId || existing.model_id || 'UNKNOWN',
      model_name: modelName || existing.model_name || modelId,
      group_name: groupName,
      os_build: osBuild || existing.os_build || 'Windows 11',
      bios_version: biosVersion || existing.bios_version || 'N/A',
      ip_address: ipAddress || existing.ip_address || '127.0.0.1',
      cpu: cpu || existing.cpu || 'No reportado',
      ram: ram || existing.ram || 'No reportado',
      serial_number: serialNumber || existing.serial_number || 'No reportado',
      mac_address: macAddress || existing.mac_address || 'No reportado',
      motherboard: motherboard || existing.motherboard || 'No reportado',
      os_edition: osEdition || existing.os_edition || 'Windows',
      is_demo: isDemo ? 1 : (existing.is_demo || 0),
      total_drivers: total,
      uptodate_drivers: uptodate,
      outdated_drivers: outdated,
      pending_drivers: pending,
      critical_pending: critical,
      compliance_rate: compliance,
      last_seen: now,
      created_at: existing.created_at || now,
    };

    store.drivers[id] = auditResults.map((d, idx) => ({
      id: idx + 1,
      device_id: id,
      driver_name: d.name,
      category: d.category,
      installed_version: d.installedVersion || d.installedVer || 'No detectado',
      target_version: d.targetVersion || d.targetVer || d.version || '1.0',
      status: d.status,
      severity: d.severity,
      is_admitted: d.isAdmitted ? 1 : 0,
      download_url: d.downloadUrl || '',
      file_size: d.fileSize || 'N/A',
      updated_at: now
    }));

    writeJsonStore(store);
    return store.devices[id];
  }

  try {
    const existing = db.prepare('SELECT group_name, created_at, cpu, ram, serial_number, mac_address, motherboard, os_edition FROM devices WHERE id = ?').get(id);
    const groupName = existing ? existing.group_name : 'general';
    const createdAt = existing ? existing.created_at : now;

    const mName = modelName || modelId || 'UNKNOWN';
    try {
      db.prepare(`
        INSERT OR IGNORE INTO hardware_baselines (id, model_name, status, block_windows_update, require_critical_only)
        VALUES (?, ?, 'Quarantine', 1, 1)
      `).run(Math.random().toString(36).substring(2, 15), mName);
    } catch (e) {}

    db.prepare(`
      INSERT INTO devices (
        id, hostname, oem, model_id, model_name, group_name,
        os_build, bios_version, ip_address, cpu, ram, serial_number,
        mac_address, motherboard, os_edition, is_demo,
        total_drivers, uptodate_drivers, outdated_drivers, pending_drivers,
        critical_pending, compliance_rate, last_seen, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        hostname = excluded.hostname,
        oem = excluded.oem,
        model_id = excluded.model_id,
        model_name = excluded.model_name,
        os_build = excluded.os_build,
        bios_version = excluded.bios_version,
        ip_address = excluded.ip_address,
        cpu = COALESCE(excluded.cpu, devices.cpu),
        ram = COALESCE(excluded.ram, devices.ram),
        serial_number = COALESCE(excluded.serial_number, devices.serial_number),
        mac_address = COALESCE(excluded.mac_address, devices.mac_address),
        motherboard = COALESCE(excluded.motherboard, devices.motherboard),
        os_edition = COALESCE(excluded.os_edition, devices.os_edition),
        is_demo = excluded.is_demo,
        total_drivers = excluded.total_drivers,
        uptodate_drivers = excluded.uptodate_drivers,
        outdated_drivers = excluded.outdated_drivers,
        pending_drivers = excluded.pending_drivers,
        critical_pending = excluded.critical_pending,
        compliance_rate = excluded.compliance_rate,
        last_seen = excluded.last_seen
    `).run(
      id,
      hostname || 'DESCONOCIDO',
      (oem || 'lenovo').toLowerCase(),
      modelId || 'UNKNOWN',
      modelName || modelId,
      groupName,
      osBuild || 'Windows 11',
      biosVersion || 'N/A',
      ipAddress || '127.0.0.1',
      cpu || (existing && existing.cpu) || 'No reportado',
      ram || (existing && existing.ram) || 'No reportado',
      serialNumber || (existing && existing.serial_number) || 'No reportado',
      macAddress || (existing && existing.mac_address) || 'No reportado',
      motherboard || (existing && existing.motherboard) || 'No reportado',
      osEdition || (existing && existing.os_edition) || 'Windows',
      isDemo ? 1 : 0,
      total,
      uptodate,
      outdated,
      pending,
      critical,
      compliance,
      now,
      createdAt
    );

function inferCategory(driverName, category) {
  const catStr = String(category || '').trim();
  if (catStr && catStr !== 'Sistema' && catStr !== 'Otros' && catStr !== 'General') {
    return catStr;
  }
  const name = String(driverName || '').toLowerCase();
  if (/bios|uefi|firmware/i.test(name)) return 'BIOS/UEFI';
  if (/audio|realtek|sound|mic/i.test(name)) return 'Audio';
  if (/nfc|near field/i.test(name)) return 'NFC';
  if (/card reader|cardreader|alcor|realtek card/i.test(name)) return 'Lector de Tarjetas';
  if (/fingerprint|huella|goodix|synaptics fingerprint/i.test(name)) return 'Biometría/Huella';
  if (/camera|camara|webcam|luxvision/i.test(name)) return 'Cámara';
  if (/display|graphic|video|gpu|intel hd|nvidia|amd/i.test(name)) return 'Gráficos/Display';
  if (/bluetooth/i.test(name)) return 'Bluetooth';
  if (/network|lan|ethernet|wifi|wlan|wireless|quectel|wwan|realtek pcie|intel pro1000/i.test(name)) return 'Red/Conectividad';
  if (/chipset|management engine|txt|mfgstat|platform/i.test(name)) return 'Chipset/Sistema';
  if (/storage|nvme|ssd|sata|disk/i.test(name)) return 'Almacenamiento';
  if (/thunderbolt|usb/i.test(name)) return 'USB/Thunderbolt';
  if (/touchpad|trackpoint|mouse|keyboard|teclado/i.test(name)) return 'Periféricos/Touchpad';
  if (/power|battery|energy/i.test(name)) return 'Energía/Batería';
  if (/tpm|security/i.test(name)) return 'Seguridad';
  if (/sccm|hsa|diagnostics|diagnóstico|utility|maintenance|asset id/i.test(name)) return 'Software/Paquete IT';
  return catStr || 'Sistema';
}

function normalizeTargetVersion(rawVer, driverName, downloadUrl) {
  const ver = String(rawVer || '').trim();
  if (ver && ver !== '1.0' && ver !== '1.0.0.0' && ver !== 'N/A' && ver !== '--') {
    return ver;
  }
  const match = String(driverName || '').match(/\b(?:v|version\s*)?(\d+\.\d+(?:\.\d+)*)\b/i);
  if (match && match[1]) {
    return match[1];
  }
  if (downloadUrl) {
    const urlVerMatch = downloadUrl.match(/[\/_](\d+\.\d+(?:\.\d+)*)[\/_.]/);
    if (urlVerMatch && urlVerMatch[1]) {
      return urlVerMatch[1];
    }
  }
  return ver || '1.0';
}

    // Actualizar inventario de controladores
    db.prepare('DELETE FROM device_drivers WHERE device_id = ?').run(id);
    const insertDriver = db.prepare(`
      INSERT INTO device_drivers (
        device_id, driver_name, category, installed_version,
        target_version, status, severity, is_admitted, download_url, file_size, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const d of auditResults) {
      const driverName = d.driver_name || d.name || 'Controlador';
      const downloadUrl = d.download_url || d.downloadUrl || '';
      const category = inferCategory(driverName, d.category || d.cat);
      const targetVer = normalizeTargetVersion(d.target_version || d.latest_version || d.targetVersion || d.targetVer || d.version, driverName, downloadUrl);
      let status = d.status || 'PENDIENTE';
      let installedVer = d.installed_version || d.installedVersion || d.installedVer || 'No detectado';

      if (status === 'ACTUALIZADO' && (installedVer === 'No detectado' || !installedVer)) {
        installedVer = targetVer;
      }

      insertDriver.run(
        id,
        driverName,
        category,
        installedVer,
        targetVer,
        status,
        d.severity || 'Recomendado',
        d.is_admitted !== undefined ? (d.is_admitted ? 1 : 0) : (d.isAdmitted ? 1 : 0),
        downloadUrl,
        d.file_size || d.fileSize || 'N/A',
        now
      );
    }

    return getDeviceById(id);
  } catch (e) {
    console.error('Error registrando dispositivo en base de datos:', e);
    throw e;
  }
}

function deleteDevice(id) {
  if (useJsonFallback) {
    const store = readJsonStore();
    if (store.devices) delete store.devices[id];
    if (store.drivers) delete store.drivers[id];
    store.tasks = (store.tasks || []).filter(t => t.device_id !== id);
    writeJsonStore(store);
    return true;
  }

  try {
    db.prepare('DELETE FROM device_drivers WHERE device_id = ?').run(id);
    db.prepare('DELETE FROM deployment_tasks WHERE device_id = ?').run(id);
    db.prepare('DELETE FROM devices WHERE id = ?').run(id);
    return true;
  } catch (e) {
    console.error('Error eliminando dispositivo:', e);
    return false;
  }
}

function clearDemoDevices() {
  if (useJsonFallback) {
    const store = readJsonStore();
    const demoIds = Object.keys(store.devices || {}).filter(k => {
      const d = store.devices[k];
      return d.is_demo === 1 ||
             ['LNV-PF12A9B1', 'LNV-PF23B8C2', 'HP-5CD142980', 'HP-5CD932014'].includes(k) ||
             String(d.hostname).startsWith('PC-MAD-') ||
             String(d.hostname).startsWith('PC-BCN-') ||
             String(d.hostname).startsWith('PC-VAL-');
    });
    for (const id of demoIds) {
      delete store.devices[id];
      delete (store.drivers || {})[id];
      store.tasks = (store.tasks || []).filter(t => t.device_id !== id);
    }
    writeJsonStore(store);
    return demoIds.length;
  }

  try {
    const demoRows = db.prepare(`
      SELECT id FROM devices
      WHERE is_demo = 1
         OR id IN ('LNV-PF12A9B1', 'LNV-PF23B8C2', 'HP-5CD142980', 'HP-5CD932014')
         OR hostname LIKE 'PC-MAD-%'
         OR hostname LIKE 'PC-BCN-%'
         OR hostname LIKE 'PC-VAL-%'
    `).all();

    for (const r of demoRows) {
      deleteDevice(r.id);
    }
    return demoRows.length;
  } catch (e) {
    console.error('Error al limpiar dispositivos demo:', e);
    return 0;
  }
}

function clearAllDevices() {
  if (useJsonFallback) {
    const store = readJsonStore();
    store.devices = {};
    store.drivers = {};
    store.tasks = [];
    writeJsonStore(store);
    return true;
  }

  try {
    db.prepare('DELETE FROM device_drivers').run();
    db.prepare('DELETE FROM deployment_tasks').run();
    db.prepare('DELETE FROM devices').run();
    return true;
  } catch (e) {
    console.error('Error vaciando flota:', e);
    return false;
  }
}

function assignMachinesToRing(ringId, machineIdsArray) {
  if (!machineIdsArray || !machineIdsArray.length) return;
  const placeholders = machineIdsArray.map(() => '?').join(',');
  db.prepare(`UPDATE devices SET ring_id = ? WHERE id IN (${placeholders})`).run(ringId, ...machineIdsArray);
}

function setDeviceGroup(id, groupName) {
  if (useJsonFallback) {
    const store = readJsonStore();
    if (store.devices[id]) {
      store.devices[id].group_name = groupName;
      writeJsonStore(store);
      return store.devices[id];
    }
    return null;
  }

  try {
    db.prepare('UPDATE devices SET group_name = ? WHERE id = ?').run(groupName, id);
    return getDeviceById(id);
  } catch (e) {
    console.error('Error asignando grupo al dispositivo:', e);
    return null;
  }
}

// ------------------------------------------------------------------
// Cola de Tareas de Despliegue para Agentes
// ------------------------------------------------------------------

function createDeploymentTask(deviceId, driversPayload) {
  const now = new Date().toISOString();
  const payloadStr = JSON.stringify(driversPayload);

  if (useJsonFallback) {
    const store = readJsonStore();
    const task = {
      id: Date.now(),
      device_id: deviceId,
      task_type: 'install_updates',
      status: 'pending',
      drivers_payload: payloadStr,
      created_at: now,
      completed_at: null,
      exit_code: null,
      log_output: ''
    };
    store.tasks.push(task);
    writeJsonStore(store);
    return task;
  }

  try {
    const res = db.prepare(`
      INSERT INTO deployment_tasks (device_id, task_type, status, drivers_payload, created_at)
      VALUES (?, 'install_updates', 'pending', ?, ?)
    `).run(deviceId, payloadStr, now);

    return {
      id: res.lastInsertRowid,
      device_id: deviceId,
      status: 'pending',
      drivers_payload: payloadStr,
      created_at: now
    };
  } catch (e) {
    console.error('Error creando tarea de despliegue:', e);
    return null;
  }
}

function getPendingTaskForDevice(deviceId) {
  if (useJsonFallback) {
    const store = readJsonStore();
    const task = (store.tasks || []).find(t => t.device_id === deviceId && t.status === 'pending');
    return task || null;
  }

  try {
    return db.prepare('SELECT * FROM deployment_tasks WHERE device_id = ? AND status = ? ORDER BY created_at ASC LIMIT 1').get(deviceId, 'pending');
  } catch (e) {
    console.error('Error buscando tarea pendiente:', e);
    return null;
  }
}

function completeTask(taskId, exitCode, logOutput) {
  const now = new Date().toISOString();
  const status = (exitCode === 0 || exitCode === 3010) ? 'completed' : 'failed';

  if (useJsonFallback) {
    const store = readJsonStore();
    const task = (store.tasks || []).find(t => t.id === Number(taskId));
    if (task) {
      task.status = status;
      task.exit_code = exitCode;
      task.log_output = logOutput;
      task.completed_at = now;
      writeJsonStore(store);
      return task;
    }
    return null;
  }

  try {
    db.prepare(`
      UPDATE deployment_tasks
      SET status = ?, exit_code = ?, log_output = ?, completed_at = ?
      WHERE id = ?
    `).run(status, exitCode, logOutput, now, taskId);

    return db.prepare('SELECT * FROM deployment_tasks WHERE id = ?').get(taskId);
  } catch (e) {
    console.error('Error completando tarea:', e);
    return null;
  }
}

// ------------------------------------------------------------------
// Métricas Globales de la Flota
// ------------------------------------------------------------------

function getFleetStats() {
  const devices = getDevices();
  const total = devices.length;
  const uptodate = devices.filter(d => d.compliance_rate === 100).length;
  const outdated = devices.filter(d => d.compliance_rate < 100).length;
  const critical = devices.reduce((acc, d) => acc + (d.critical_pending || 0), 0);
  const avgCompliance = total > 0
    ? Math.round(devices.reduce((acc, d) => acc + (d.compliance_rate || 0), 0) / total)
    : 100;

  return {
    totalDevices: total,
    uptodateDevices: uptodate,
    outdatedDevices: outdated,
    criticalPendingCount: critical,
    averageComplianceRate: avgCompliance,
  };
}

// ------------------------------------------------------------------
// Semilla de Demostración para Flota Inicial
// ------------------------------------------------------------------

function seedSampleDataIfEmpty() {
  const current = getDevices();
  if (current.length >= 4) return;

  const samples = [
    {
      id: 'LNV-PF12A9B1',
      hostname: 'PC-MAD-FIN-01',
      oem: 'lenovo',
      modelId: '20L5',
      modelName: 'ThinkPad T480',
      groupName: 'general',
      osBuild: 'Windows 11 24H2',
      biosVersion: 'N24ET70W (1.47)',
      ipAddress: '192.168.10.45',
      auditResults: [
        { name: 'Intel Management Engine 12.0 Firmware', category: 'BIOS/UEFI', installedVer: '12.0.70.1652', targetVer: '12.0.94.2380', status: 'DESACTUALIZADO', severity: 'Crítico', isAdmitted: true, downloadUrl: 'https://download.lenovo.com/ibmdl/pub/pc/pccbbs/mobiles/n24rg24w.exe', fileSize: '12.4 MB' },
        { name: 'Intel Dual Band Wireless-AC 8265', category: 'Red', installedVer: '20.70.30.1', targetVer: '20.70.32.1', status: 'DESACTUALIZADO', severity: 'Recomendado', isAdmitted: true, downloadUrl: 'https://download.lenovo.com/ibmdl/pub/pc/pccbbs/mobiles/n24w124w.exe', fileSize: '8.8 MB' },
        { name: 'Synaptics Audio Driver', category: 'Audio', installedVer: '9.0.230.1', targetVer: '9.0.230.1', status: 'ACTUALIZADO', severity: 'Recomendado', isAdmitted: true },
        { name: 'Intel Iris Xe and UHD Graphics Driver', category: 'Gráficos/Display', installedVer: '31.0.101.2111', targetVer: '31.0.101.2111', status: 'ACTUALIZADO', severity: 'Recomendado', isAdmitted: true },
      ]
    },
    {
      id: 'LNV-PF23B8C2',
      hostname: 'PC-BCN-DEV-03',
      oem: 'lenovo',
      modelId: '20X1',
      modelName: 'ThinkPad L14 Gen 2 Intel',
      groupName: 'pilot',
      osBuild: 'Windows 11 24H2',
      biosVersion: 'N34ET52W (1.52)',
      ipAddress: '192.168.20.102',
      auditResults: [
        { name: 'ThinkPad BIOS Update (R1FET52W)', category: 'BIOS/UEFI', installedVer: '1.52', targetVer: '1.52', status: 'ACTUALIZADO', severity: 'Crítico', isAdmitted: true },
        { name: 'Intel AX201 Wi-Fi 6 Driver', category: 'Red', installedVer: '22.190.0.4', targetVer: '22.190.0.4', status: 'ACTUALIZADO', severity: 'Recomendado', isAdmitted: true },
        { name: 'Realtek Audio Codec Driver', category: 'Audio', installedVer: '6.0.9250.1', targetVer: '6.0.9250.1', status: 'ACTUALIZADO', severity: 'Recomendado', isAdmitted: true },
      ]
    },
    {
      id: 'HP-5CD142980',
      hostname: 'PC-VAL-OPS-02',
      oem: 'hp',
      modelId: '888A',
      modelName: 'HP ProBook 440 G8',
      groupName: 'general',
      osBuild: 'Windows 11 24H2',
      biosVersion: 'T84 Ver. 01.12.00',
      ipAddress: '192.168.30.88',
      auditResults: [
        { name: 'HP ProBook 440 G8 System BIOS (T84)', category: 'BIOS/UEFI', installedVer: '01.12.00', targetVer: '01.14.00', status: 'DESACTUALIZADO', severity: 'Crítico', isAdmitted: true, downloadUrl: 'https://ftp.hp.com/pub/softpaq/sp143001-143500/sp143320.exe', fileSize: '12.6 MB' },
        { name: 'Intel Iris Xe Graphics Driver', category: 'Gráficos/Display', installedVer: '30.0.100.9864', targetVer: '31.0.101.5333', status: 'DESACTUALIZADO', severity: 'Recomendado', isAdmitted: true, downloadUrl: 'https://ftp.hp.com/pub/softpaq/sp141501-142000/sp141910.exe', fileSize: '168 MB' },
        { name: 'Realtek High Definition Audio Driver', category: 'Audio', installedVer: '6.0.9431.10', targetVer: '6.0.9431.10', status: 'ACTUALIZADO', severity: 'Opcional', isAdmitted: true },
      ]
    },
    {
      id: 'HP-5CD932014',
      hostname: 'PC-MAD-DIR-01',
      oem: 'hp',
      modelId: '880D',
      modelName: 'HP EliteBook 840 G7',
      groupName: 'vip',
      osBuild: 'Windows 11 24H2',
      biosVersion: 'S70 Ver. 01.15.00',
      ipAddress: '192.168.10.12',
      auditResults: [
        { name: 'HP EliteBook 840 G7 System BIOS (S70)', category: 'BIOS/UEFI', installedVer: '01.15.00', targetVer: '01.15.00', status: 'ACTUALIZADO', severity: 'Crítico', isAdmitted: true },
        { name: 'Intel AX201 WiFi Driver', category: 'Red', installedVer: '22.160.0.3', targetVer: '22.160.0.3', status: 'ACTUALIZADO', severity: 'Recomendado', isAdmitted: true },
        { name: 'HP BIOS and System Firmware Update Utility', category: 'BIOS/UEFI', installedVer: 'No detectado', targetVer: '1.2.0.0', status: 'PENDIENTE', severity: 'Opcional', isAdmitted: false },
      ]
    }
  ];

  for (const s of samples) {
    if (!getDeviceById(s.id)) {
      registerOrUpdateDevice({
        ...s,
        isDemo: 1,
        groupName: s.groupName
      });
      setDeviceGroup(s.id, s.groupName);
    }
  }
  return samples.length;
}

// ------------------------------------------------------------------
// Auditoría de Seguridad (Logs)
// ------------------------------------------------------------------

function logAdminAction(adminUser, action, target, ip) {
  const now = new Date().toISOString();
  if (useJsonFallback) {
    const store = readJsonStore();
    if (!store.audit_logs) store.audit_logs = [];
    store.audit_logs.push({
      id: Date.now(),
      admin_user: adminUser,
      action: action,
      target: target,
      ip: ip,
      timestamp: now
    });
    writeJsonStore(store);
    return;
  }
  
  try {
    db.prepare(`
      INSERT INTO audit_logs (admin_user, action, target, ip, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).run(adminUser, action, target, ip, now);
  } catch (e) {
    console.error('Error guardando log de auditoría:', e);
  }
}

function getAuditLogs({ limit = 50, offset = 0, adminUser, startDate, endDate } = {}) {
  if (useJsonFallback) {
    const store = readJsonStore();
    let logs = store.audit_logs || [];
    if (adminUser) logs = logs.filter(l => l.admin_user === adminUser);
    if (startDate) logs = logs.filter(l => l.timestamp >= startDate);
    if (endDate) logs = logs.filter(l => l.timestamp <= endDate);
    
    // Orden descendente
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return logs.slice(offset, offset + limit);
  }

  try {
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];

    if (adminUser) {
      query += ' AND admin_user = ?';
      params.push(adminUser);
    }
    if (startDate) {
      query += ' AND timestamp >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND timestamp <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return db.prepare(query).all(...params);
  } catch (e) {
    console.error('Error obteniendo audit logs:', e);
    return [];
  }
}

// Nota: No se ejecuta automáticamente seedSampleDataIfEmpty() para asegurar
// que el dashboard muestre únicamente datos reales de agentes en producción.


// ------------------------------------------------------------------
// Telemetria de Cliente (Client Logs)
// ------------------------------------------------------------------

function logClientAction(machineId, timestamp, level, message) {
  if (useJsonFallback) return;
  try {
    db.prepare(
      'INSERT INTO client_logs (machine_id, timestamp, level, message) VALUES (?, ?, ?, ?)'
    ).run(machineId, timestamp || new Date().toISOString(), level, message);
  } catch (e) {
    console.error('Error guardando log de cliente:', e);
  }
}

function markDriverInstalledByFile(machineId, fileName) {
  if (useJsonFallback) return;
  try {
    const driver = db.prepare(`SELECT id, target_version FROM device_drivers WHERE device_id = ? AND download_url LIKE '%' || ? || '%' AND (status = 'PENDIENTE' OR status = 'DESACTUALIZADO') LIMIT 1`).get(machineId, fileName);
    if (driver) {
      const newVersion = driver.target_version || '1.0';
      db.prepare(`UPDATE device_drivers SET status = 'ACTUALIZADO', installed_version = ? WHERE id = ?`).run(newVersion, driver.id);
      console.log(`[FleetDB] Controlador marcado como ACTUALIZADO para ${machineId} (${fileName})`);
      
      // Recalcular métricas del dispositivo (pending_drivers y critical_pending) para el dashboard
      const counts = db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'ACTUALIZADO' THEN 1 ELSE 0 END) as uptodate,
          SUM(CASE WHEN status = 'DESACTUALIZADO' THEN 1 ELSE 0 END) as outdated,
          SUM(CASE WHEN status = 'PENDIENTE' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status != 'ACTUALIZADO' AND (severity LIKE '%Cr%' OR severity = 'Critical') THEN 1 ELSE 0 END) as critical
        FROM device_drivers WHERE device_id = ?
      `).get(machineId);
      
      if (counts) {
        const compliance = counts.total > 0 ? Math.round((counts.uptodate / counts.total) * 100) : 100;
        db.prepare(`UPDATE devices SET uptodate_drivers = ?, outdated_drivers = ?, pending_drivers = ?, critical_pending = ?, compliance_rate = ? WHERE id = ?`)
          .run(counts.uptodate || 0, counts.outdated || 0, counts.pending || 0, counts.critical || 0, compliance, machineId);
      }
    }
  } catch (e) {
    console.error('Error actualizando estado del controlador:', e);
  }
}

function getClientLogs(machineId, limit = 100) {
  if (useJsonFallback) return [];
  try {
    return db.prepare(
      'SELECT * FROM client_logs WHERE machine_id = ? ORDER BY timestamp DESC LIMIT ?'
    ).all(machineId, limit);
  } catch (e) {
    console.error('Error obteniendo logs de cliente:', e);
    return [];
  }
}

function updateLastSeen(id) {
  if (useJsonFallback) return;
  try {
    const now = new Date().toISOString();
    db.prepare('UPDATE devices SET last_seen = ? WHERE id = ?').run(now, id);
  } catch (e) {
    console.error('Error al actualizar last_seen:', e);
  }
}
function getDb() {
  return db;
}


function updateDynamicCatalog(platformId, oem, jsonData) {
  if (useJsonFallback) return;
  try {
    db.prepare('INSERT OR REPLACE INTO dynamic_catalogs (platform_id, oem, last_updated, json_data) VALUES (?, ?, ?, ?)').run(platformId, oem, new Date().toISOString(), jsonData);
  } catch(e) { console.error('[fleetStorage] Error al actualizar catalogo dinamico:', e); }
}

function getDynamicCatalog(platformId) {
  if (useJsonFallback) return null;
  try {
    return db.prepare('SELECT * FROM dynamic_catalogs WHERE platform_id = ?').get(platformId);
  } catch(e) { return null; }
}

module.exports = {
  updateDynamicCatalog,
  getDynamicCatalog,
  getDb,
  getSettings,
  updateSettings,
  getDevices,
  getDetectedModels,
  getGroupCounts,
  getDeviceById,
  registerOrUpdateDevice,
  setDeviceGroup,
  deleteDevice,
  clearDemoDevices,
  clearAllDevices,
  createDeploymentTask,
  getPendingTaskForDevice,
  completeTask,
  getFleetStats,
  assignMachinesToRing,
  seedSampleDataIfEmpty,
  DEFAULT_SETTINGS,
  logAdminAction,
  getAuditLogs,
  logClientAction,
  getClientLogs,
  markDriverInstalledByFile,
  updateLastSeen
};


