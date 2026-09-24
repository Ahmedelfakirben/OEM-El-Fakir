/**
 * lenovoService.js
 * Módulo de integración con la API oficial de Lenovo PC Support.
 * Obtiene y normaliza el catálogo de drivers/BIOS para un machineType dado.
 */

'use strict';

// ------------------------------------------------------------------
// Constantes de configuración
// ------------------------------------------------------------------
const LENOVO_API_BASE = 'https://pcsupport.lenovo.com/es/es/api/v4/downloads/drivers';
const LENOVO_REFERER  = 'https://pcsupport.lenovo.com/';
const REQUEST_TIMEOUT_MS = 10_000;

const { resolveWindowsCatalogInfo } = require('./windowsCatalogService');
const { translateAndEnrichFix }     = require('./translationService');

/**
 * Extrae las versiones de Windows 11 compatibles.
 * Clasifica de forma realista según modernidad, categoría y fecha de entrega.
 */
function extractOsCompatibility(d, releaseDate, category, name) {
  const normName = String(name || '').toLowerCase();
  const normCat  = String(category || '').toLowerCase();

  // Herramientas legacy (Asset ID, MFGSTAT, diagnósticos antiguos, herramientas de Windows 7/8)
  if (/asset id|mfgstat|linux diagnostics|dos|bootable cd|windows 7|windows 8|win 7|pe 10|pe 11/i.test(normName)) {
    return ['win11-24h2'];
  }

  // Utilidades y paquetes previos a 2022
  if (releaseDate && releaseDate < '2022-01-01') {
    return ['win11-24h2'];
  }

  // Controladores y utilidades de ciclo intermedio (2022 hasta mediados de 2023)
  if (releaseDate && releaseDate < '2023-06-01') {
    return ['win11-24h2', 'win11-25h2'];
  }

  // Controladores modernos y firmware reciente (2024 en adelante)
  if (releaseDate && releaseDate >= '2024-01-01') {
    if (/bios|uefi|wifi|wireless|gráficos|display/i.test(normCat) || /bios|wifi|iris|uhd/i.test(normName)) {
      return ['win11-25h2', 'win11-26h2'];
    }
  }

  // Componentes principales estables certificados para todas las ramas
  return ['win11-24h2', 'win11-25h2', 'win11-26h2'];
}

/**
 * Cabeceras HTTP que simulan un cliente de escritorio para evitar bloqueos 403/429.
 */
const DESKTOP_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
  'Referer':         LENOVO_REFERER,
  'Origin':          'https://pcsupport.lenovo.com',
  'Cache-Control':   'no-cache',
  'Pragma':          'no-cache',
};

// ------------------------------------------------------------------
// Mapas de normalización
// ------------------------------------------------------------------

/**
 * Convierte la prioridad numérica/textual de Lenovo al esquema de severidad unificado.
 * Lenovo usa: 1=Critical, 2=Recommended, 3=Optional (también strings en inglés/español)
 */
function normalizeSeverity(raw) {
  if (!raw && raw !== 0) return 'Opcional';
  const val = String(raw).toLowerCase().trim();
  if (val === '1' || val.includes('critical') || val.includes('crítico')) return 'Crítico';
  if (val === '2' || val.includes('recommend') || val.includes('recomend')) return 'Recomendado';
  return 'Opcional';
}

/**
 * Limpia y normaliza el nombre de categoría de Lenovo (soporta español e inglés).
 */
function normalizeCategory(raw) {
  if (!raw) return 'Otros';
  let cat = '';
  if (typeof raw === 'object') {
    cat = String(raw.Name || raw.name || raw.Title || raw.title || raw.Desc || raw.ID || '').trim();
  } else {
    cat = String(raw).trim();
  }
  if (!cat || cat === '[object Object]') return 'Otros';

  // Mapa de substrings frecuentes (ES/EN) → categoría canónica
  const map = [
    [/bios|uefi|firmware/i,                                      'BIOS/UEFI'],
    [/audio|sound|sonido/i,                                     'Audio'],
    [/display|graphic|video|gpu|pantalla|vídeo|grafic/i,         'Gráficos/Display'],
    [/bluetooth/i,                                              'Bluetooth'],
    [/network|lan|ethernet|wifi|wlan|wireless|red/i,            'Red'],
    [/chipset|intel\s+platform|plataforma/i,                    'Chipset'],
    [/storage|nvme|sata|ssd|hdd|almacenamiento|disco/i,         'Almacenamiento'],
    [/usb|thunderbolt/i,                                        'USB/Thunderbolt'],
    [/camera|webcam|cámara/i,                                   'Cámara'],
    [/keyboard|trackpad|touchpad|mouse|ratón|teclado/i,         'Periféricos'],
    [/power|battery|energy|energía|batería/i,                   'Energía/Batería'],
    [/security|tpm|fingerprint|seguridad|huella/i,              'Seguridad'],
    [/vantage|system\s+update|diagnostics|diagnóstico|software|utilidad|gestión|tool/i, 'Software Lenovo'],
  ];

  for (const [pattern, label] of map) {
    if (pattern.test(cat)) return label;
  }
  return cat; // devuelve tal cual si no hay coincidencia
}

/**
 * Normaliza una fecha a formato YYYY-MM-DD.
 * Lenovo puede devolver timestamps Unix (ms), strings ISO o "DD/MM/YYYY".
 */
function normalizeDate(raw) {
  if (!raw) return null;

  // Unix timestamp en milisegundos (número grande)
  if (typeof raw === 'number' && raw > 1_000_000_000_000) {
    return new Date(raw).toISOString().split('T')[0];
  }
  // Unix timestamp en segundos
  if (typeof raw === 'number' && raw > 1_000_000_000) {
    return new Date(raw * 1000).toISOString().split('T')[0];
  }

  const str = String(raw).trim();

  // Intenta parseo directo
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  // Formato DD/MM/YYYY
  const ddmm = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmm) {
    return `${ddmm[3]}-${ddmm[2].padStart(2,'0')}-${ddmm[1].padStart(2,'0')}`;
  }

  return str; // devuelve raw si no puede parsear
}

/**
 * Transforma un item crudo de la API de Lenovo al esquema unificado.
 * La estructura real de la API v4 ubica versión, URL y peso bajo Files[0].
 */
function normalizeDriver(item) {
  const d = item.Download || item;

  // Extrae archivo primario y metadatos reales de Files[0]
  let downloadUrl  = null;
  let fileSize     = null;
  let fileVersion  = null;
  let filePriority = null;

  if (Array.isArray(d.Files) && d.Files.length > 0) {
    const file = d.Files[0];
    downloadUrl  = file.URL || file.url || file.DownloadUrl || null;
    fileSize     = file.Size || file.size || null;
    fileVersion  = file.Version || file.version || null;
    filePriority = file.Priority || file.priority || null;
  } else if (d.DownloadUrl || d.downloadUrl) {
    downloadUrl = d.DownloadUrl || d.downloadUrl;
  }

  const name = String(d.Title || d.title || d.Name || d.name || 'Sin nombre').trim();

  // Resuelve la versión precisa: prioridad a Files[0].Version, luego Title regex, luego fallback
  const titleVerMatch = name.match(/\b(?:v|version\s*)?(\d+(?:\.\d+)+)\b/i);
  let resolvedVersion = d.Version || d.version || fileVersion;
  if (!resolvedVersion || resolvedVersion === 'N/A') {
    resolvedVersion = titleVerMatch ? titleVerMatch[1] : '1.0.0.0';
  }
  const version = String(resolvedVersion).trim();

  // ID único
  const id = String(
    d.ID || d.id || d.DriverId || d.driverId || d.DocId ||
    `${name}-${version}`
  );

  // Descripción: qué soluciona el parche (traducida y enriquecida en español)
  const rawDesc = d.Description || d.description || d.Summary || d.summary ||
                  d.SummaryStr || d.summaryStr || d.FixList || d.fixList ||
                  d.ReleaseNotes || d.releaseNotes || '';
  const category = normalizeCategory(d.Category || d.category || d.Type || d.type);

  // Traducción y contextualización técnica en español de alta calidad
  const fixInfo = translateAndEnrichFix(rawDesc, name, category, 'lenovo');

  const severity    = normalizeSeverity(d.Priority || d.priority || filePriority || d.Severity || d.severity);
  const releaseDate = normalizeDate(d.Date?.Unix || d.ReleaseDate || d.releaseDate || d.Date || d.date);

  // Resolución de admisión en Windows Update y taxonomía canónica Microsoft WHQL
  const winInfo = resolveWindowsCatalogInfo({
    oem: 'lenovo',
    category,
    name,
    version,
    severity,
    id,
  });

  return {
    id:                  id,
    category:            category,
    name:                name,
    version:             version,
    releaseDate:         releaseDate,
    severity:            severity,
    description:         fixInfo.description,
    detailsSpanish:      fixInfo.details,
    osCompatibility:     extractOsCompatibility(d, releaseDate, category, name),
    windowsApproved:     winInfo.windowsAdmitted,
    windowsAdmitted:     winInfo.windowsAdmitted,
    deliverySource:      winInfo.deliverySource,
    windowsAdmittedName: winInfo.windowsAdmittedName,
    windowsChannel:      winInfo.windowsChannel,
    whqlId:              winInfo.whqlId,
    driverClass:         winInfo.driverClass,
    intuneStatus:        winInfo.windowsChannel.includes('Prioritario') ? 'priority_firmware' : (winInfo.windowsChannel.includes('Opcional') ? 'manual_optional' : 'automatic'),
    intuneLabel:         winInfo.windowsChannel,
    intuneNotes:         winInfo.intunePolicy,
    downloadUrl,
    fileSize:            fileSize ? String(fileSize) : null,
  };
}

// ------------------------------------------------------------------
// Función principal exportada
// ------------------------------------------------------------------

/**
 * Obtiene y normaliza los drivers de Lenovo para un machineType dado.
 *
 * @param {string} machineType - Código de 4 caracteres del modelo (ej. "20W0")
 * @returns {Promise<Array>} Array de drivers normalizados al esquema unificado
 * @throws {Error} Con propiedad .statusCode para que server.js responda apropiadamente
 */
const driverCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

async function fetchDrivers(machineType) {
  const cacheKey = String(machineType).toUpperCase();
  const cached = driverCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data;
  }

  const url = `${LENOVO_API_BASE}?productId=${encodeURIComponent(machineType)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      method:  'GET',
      headers: DESKTOP_HEADERS,
      signal:  controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      const e = new Error('Timeout: la API de Lenovo no respondió en 10 segundos');
      e.statusCode = 504;
      throw e;
    }
    const e = new Error(`Error de red al contactar la API de Lenovo: ${err.message}`);
    e.statusCode = 502;
    throw e;
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 404) {
    const e = new Error(`Modelo "${machineType}" no encontrado en el catálogo de Lenovo`);
    e.statusCode = 404;
    throw e;
  }

  if (!response.ok) {
    const e = new Error(`La API de Lenovo devolvió HTTP ${response.status}`);
    e.statusCode = 502;
    throw e;
  }

  let data;
  try {
    data = await response.json();
  } catch {
    const e = new Error('La API de Lenovo devolvió una respuesta no válida (no es JSON)');
    e.statusCode = 502;
    throw e;
  }

  // La API v4 estructura la respuesta como:
  // { body: { DownloadItems: [...] } }  o  { body: { [...] } }  o  { [...] }
  let items = [];

  if (data?.body?.DownloadItems && Array.isArray(data.body.DownloadItems)) {
    items = data.body.DownloadItems;
  } else if (data?.body?.download && Array.isArray(data.body.download)) {
    items = data.body.download;
  } else if (Array.isArray(data?.body)) {
    items = data.body;
  } else if (Array.isArray(data)) {
    items = data;
  } else if (data?.body) {
    // Intenta encontrar el primer array en el body
    const firstArray = Object.values(data.body).find(v => Array.isArray(v));
    if (firstArray) items = firstArray;
  }

  if (items.length === 0) {
    const e = new Error(
      `No se encontraron drivers para el machineType "${machineType}". ` +
      'Verifica que el código de 4 caracteres es correcto.'
    );
    e.statusCode = 404;
    throw e;
  }

  const normalized = items.map(normalizeDriver).filter(d => d.name !== 'Sin nombre' || d.downloadUrl);
  driverCache.set(cacheKey, { timestamp: Date.now(), data: normalized });
  return normalized;
}

module.exports = { fetchDrivers };
