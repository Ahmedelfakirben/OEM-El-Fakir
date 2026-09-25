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

const DB_PATH = path.join(DATA_DIR, 'fleet.db');
const JSON_BACKUP_PATH = path.join(DATA_DIR, 'fleet.json');

// Configuración predeterminada de políticas de flota
const DEFAULT_SETTINGS = {
  fleet_mode: 'audit_only',       // 'audit_only' (solo saber / monitorizar) | 'scheduled' (actualización automática)
  schedule_type: 'monthly',       // 'monthly' (una vez al mes) | 'manual'
  monthly_day: 15,                // Día del mes en que se ejecutan las actualizaciones
  critical_only: true,            // En modo automático, aplicar solo parches críticos de seguridad
  pilot_group_enabled: true,      // Despliegue anticipado para el grupo Piloto
  model_rules: {                  // Políticas por modelo: true = habilitado, false = solo auditoría
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
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  // Esquema de tablas
  db.exec(`
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
  `);
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
    const existing = db.prepare('SELECT group_name, created_at FROM devices WHERE id = ?').get(id);
    const groupName = existing ? existing.group_name : 'general';
    const createdAt = existing ? existing.created_at : now;

    db.prepare(`
      INSERT INTO devices (
        id, hostname, oem, model_id, model_name, group_name,
        os_build, bios_version, ip_address, total_drivers,
        uptodate_drivers, outdated_drivers, pending_drivers,
        critical_pending, compliance_rate, last_seen, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        hostname = excluded.hostname,
        oem = excluded.oem,
        model_id = excluded.model_id,
        model_name = excluded.model_name,
        os_build = excluded.os_build,
        bios_version = excluded.bios_version,
        ip_address = excluded.ip_address,
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
      total,
      uptodate,
      outdated,
      pending,
      critical,
      compliance,
      now,
      createdAt
    );

    // Actualizar inventario de controladores
    db.prepare('DELETE FROM device_drivers WHERE device_id = ?').run(id);
    const insertDriver = db.prepare(`
      INSERT INTO device_drivers (
        device_id, driver_name, category, installed_version,
        target_version, status, severity, is_admitted, download_url, file_size, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const d of auditResults) {
      insertDriver.run(
        id,
        d.name || 'Controlador',
        d.category || 'Sistema',
        d.installedVersion || d.installedVer || 'No detectado',
        d.targetVersion || d.targetVer || d.version || '1.0',
        d.status || 'PENDIENTE',
        d.severity || 'Recomendado',
        d.isAdmitted ? 1 : 0,
        d.downloadUrl || '',
        d.fileSize || 'N/A',
        now
      );
    }

    return getDeviceById(id);
  } catch (e) {
    console.error('Error registrando dispositivo en base de datos:', e);
    throw e;
  }
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
        groupName: s.groupName
      });
      setDeviceGroup(s.id, s.groupName);
    }
  }
}

// Inicializar semilla si la base está vacía o incompleta
try {
  seedSampleDataIfEmpty();
} catch (e) {
  console.warn('No se pudo sembrar datos iniciales:', e.message);
}

module.exports = {
  getSettings,
  updateSettings,
  getDevices,
  getDeviceById,
  registerOrUpdateDevice,
  setDeviceGroup,
  createDeploymentTask,
  getPendingTaskForDevice,
  completeTask,
  getFleetStats,
  seedSampleDataIfEmpty,
  DEFAULT_SETTINGS
};

