/**
 * conectores.js — Módulo ESM
 * ─────────────────────────────────────────────────────────────────
 * Lógica de red y renderizado para la vista de Conectores & APIs.
 *
 * Patrones aplicados:
 *  · apiFetch: wrapper centralizado con JWT + gestión de sesión
 *  · AbortController: cancelación de peticiones en vuelo (skill: vanilla-dom-batching, Patrón 4)
 *  · DocumentFragment + replaceChildren: un único reflow DOM (skill: vanilla-dom-batching, Patrón 1)
 */

// ─── Clave de almacenamiento de sesión (debe coincidir con el módulo de login) ──
const SESSION_TOKEN_KEY = 'oem_admin_token';
const LOGIN_REDIRECT    = '/login';           // Ajustar si la ruta de login es distinta

// ─── AbortController de módulo: cancela la petición en vuelo al cambiar de vista ─
let _currentController = null;

// ─────────────────────────────────────────────────────────────────────────────
// apiFetch — Wrapper centralizado de red
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Wrapper sobre fetch() nativo con:
 *  1. Inyección automática del JWT desde localStorage (Authorization: Bearer).
 *  2. Propagación de AbortSignal externo para cancelación desde el llamador.
 *  3. Redirección transparente a login en errores 401 / 403.
 *  4. Lanzamiento de Error enriquecido para cualquier respuesta !ok.
 *
 * @param {string}      url      URL relativa o absoluta
 * @param {RequestInit} [opts]   Opciones fetch adicionales (method, body, headers…)
 * @param {AbortSignal} [signal] Señal de cancelación externa (AbortController.signal)
 * @returns {Promise<Response|null>} Respuesta fetch, o null si la petición fue cancelada
 */
export async function apiFetch(url, opts = {}, signal = null) {
  // 1. Leer token JWT del almacenamiento de sesión
  const token = localStorage.getItem(SESSION_TOKEN_KEY);

  // 2. Fusionar cabeceras: las del llamador + Authorization si hay token
  const headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // 3. Gestión de AbortController:
  //    Si no hay señal externa, crear un controller de módulo y cancelar el anterior
  const controller = signal ? null : new AbortController();
  const effectiveSignal = signal ?? controller?.signal;

  if (controller) {
    if (_currentController) _currentController.abort();  // Cancelar petición anterior en vuelo
    _currentController = controller;
  }

  try {
    const res = await fetch(url, { ...opts, headers, signal: effectiveSignal });

    // 4. Gestión de errores de sesión: limpiar y redirigir al login
    if (res.status === 401 || res.status === 403) {
      console.warn(`[apiFetch] Acceso denegado (${res.status}) en ${url} — Sesión expirada o token inválido`);
      localStorage.removeItem(SESSION_TOKEN_KEY);
      window.location.href = '/login.html';
      const err = new Error(res.status === 401 ? 'TOKEN_MISSING' : 'TOKEN_INVALID_OR_EXPIRED');
      err.status = res.status;
      throw err;
    }

    // 5. Cualquier otra respuesta no-ok
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}: ${res.statusText}`);
      err.status = res.status;
      throw err;
    }

    return res;
  } catch (err) {
    // AbortError → petición cancelada intencionalmente, no es un error real
    if (err.name === 'AbortError') {
      return null;  // El llamador comprueba null para no procesar datos obsoletos
    }
    throw err;
  } finally {
    // Limpiar referencia del controller si ya completó
    if (controller && _currentController === controller) {
      _currentController = null;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades de UI
// ─────────────────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function showToast(message, type = 'info', duration = 3500) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.className = 'toast'; }, duration);
}

function formatLatency(ms) {
  if (ms === null || ms === undefined || ms < 0) return '—';
  return `${ms} ms`;
}

function getLatencyClass(ms) {
  if (ms < 400)  return 'text-green';
  if (ms < 1000) return 'text-yellow';
  return 'text-red';
}

// ─────────────────────────────────────────────────────────────────────────────
// loadConnectorsStatus
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Solicita el estado de conectores al backend y actualiza la UI.
 *
 * @param {boolean}     [isManual=false]  true si el usuario pulsa el botón de refresco
 * @param {AbortSignal} [signal]          Señal de cancelación externa opcional
 */
export async function loadConnectorsStatus(isManual = false, signal = null) {
  const refreshBtn = $('btn-refresh-all-connectors');

  if (refreshBtn && isManual) {
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Comprobando...';
  }

  try {
    // JWT inyectado automáticamente; AbortSignal propagado al fetch nativo
    const res = await apiFetch('/api/connectors/status', { method: 'GET' }, signal);

    // null = petición cancelada (AbortError absorbido por apiFetch)
    if (res === null) return;

    const data = await res.json();
    const { summary, connectors } = data;

    // ── KPIs ─────────────────────────────────────────────────────────────────
    const totalEl = $('stat-total-connectors');
    if (totalEl) totalEl.textContent = summary.total;

    const globalStatusEl = $('stat-global-status');
    const onlineRatioEl  = $('stat-online-ratio');
    if (globalStatusEl) {
      if (summary.allOperational) {
        globalStatusEl.textContent = '100% OPERATIVO';
        globalStatusEl.className   = 'fleet-stat-value font-mono text-green';
      } else if (summary.online > 0) {
        globalStatusEl.textContent = 'DEGRADADO';
        globalStatusEl.className   = 'fleet-stat-value font-mono text-yellow';
      } else {
        globalStatusEl.textContent = 'OFFLINE';
        globalStatusEl.className   = 'fleet-stat-value font-mono text-red';
      }
    }
    if (onlineRatioEl) {
      onlineRatioEl.textContent = `${summary.online} de ${summary.total} servicios activos`;
    }

    // ── Latencia media ────────────────────────────────────────────────────────
    const onlineConnectors = connectors.filter(c => c.status === 'online' && c.latencyMs > 0);
    const avgLatency = onlineConnectors.length > 0
      ? Math.round(onlineConnectors.reduce((acc, c) => acc + c.latencyMs, 0) / onlineConnectors.length)
      : 0;

    const avgLatencyEl = $('stat-avg-latency');
    if (avgLatencyEl) {
      avgLatencyEl.textContent = `${avgLatency} ms`;
      avgLatencyEl.className   = `fleet-stat-value font-mono ${getLatencyClass(avgLatency)}`;
    }

    // ── Timestamps ────────────────────────────────────────────────────────────
    const lastCheckEl = $('stat-last-check');
    if (lastCheckEl) lastCheckEl.textContent = new Date(summary.timestamp).toLocaleTimeString();

    const tsHeader = $('header-timestamp-label');
    if (tsHeader) tsHeader.textContent = `Actualizado ${new Date().toLocaleTimeString()}`;

    // ── Renderizar tarjetas con DocumentFragment ──────────────────────────────
    renderConnectorsGrid(connectors);

    if (isManual) showToast('Conectividad con APIs verificada correctamente', 'success');

  } catch (err) {
    // Errores 401/403 ya manejados internamente por apiFetch
    if (err.status === 401 || err.status === 403) return;
    console.error('[conectores] Error al cargar estado:', err);
    showToast('Error al conectar con el servidor: ' + err.message, 'error');
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.textContent = 'Comprobar Todos los Conectores';
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// renderConnectorsGrid — DocumentFragment (skill: vanilla-dom-batching, Patrón 1)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Construye las tarjetas de conector usando DocumentFragment y replaceChildren
 * para provocar un único reflow DOM, evitando layout thrashing.
 * Usa createElement + textContent (nunca innerHTML con datos de usuario).
 *
 * @param {Array<Object>} connectors Lista de conectores del backend
 */
export function renderConnectorsGrid(connectors) {
  const container = $('connectors-cards-grid');
  if (!container) return;

  const fragment = document.createDocumentFragment();

  for (const c of connectors) {
    const isOnline   = c.status === 'online';
    const isDegraded = c.status === 'degraded';

    const statusClass = isOnline ? 'compliant' : (isDegraded ? 'outdated' : 'critical');
    const statusText  = isOnline ? 'ONLINE'    : (isDegraded ? 'DEGRADADO' : 'OFFLINE');
    const borderColor = isOnline
      ? 'rgba(52, 211, 153, 0.3)'
      : 'rgba(239, 68, 68, 0.4)';

    let oemBadgeClass = 'ms';
    if (c.id === 'lenovo')      oemBadgeClass = 'lenovo';
    else if (c.id === 'hp')     oemBadgeClass = 'hp';
    else if (c.id === 'fleet_core') oemBadgeClass = 'audit';

    // ── Tarjeta principal ────────────────────────────────────────────────────
    const card = document.createElement('div');
    card.style.cssText = `background:var(--bg-card);border:1px solid ${borderColor};border-radius:var(--radius-lg);padding:24px;box-shadow:var(--shadow-card);display:flex;flex-direction:column;justify-content:space-between;`;

    // ── Cabecera: badge OEM + proveedor + pill de estado ─────────────────────
    const headerRow = document.createElement('div');
    headerRow.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;gap:12px;flex-wrap:wrap;';

    const badgeGroup = document.createElement('div');
    badgeGroup.style.cssText = 'display:flex;align-items:center;gap:8px;';

    const oemBadge = document.createElement('span');
    oemBadge.className = `tab-btn-pill ${oemBadgeClass}`;
    oemBadge.style.cssText = 'font-size:10px;padding:2px 8px;';
    oemBadge.textContent = c.id.toUpperCase();

    const providerSpan = document.createElement('span');
    providerSpan.style.cssText = 'font-size:12px;color:var(--text-muted);font-weight:500;';
    providerSpan.textContent = c.provider;

    badgeGroup.append(oemBadge, providerSpan);

    const statusPill = document.createElement('span');
    statusPill.className = `status-pill ${statusClass}`;
    statusPill.style.cssText = 'font-size:11px;padding:3px 10px;display:flex;align-items:center;gap:5px;';

    const dot = document.createElement('span');
    dot.style.cssText = 'width:6px;height:6px;border-radius:50%;background:currentColor;display:inline-block;flex-shrink:0;';
    statusPill.append(dot, document.createTextNode(
      `${statusText}${c.statusCode ? ` (${c.statusCode})` : ''}`
    ));

    headerRow.append(badgeGroup, statusPill);

    // ── Título y descripción ──────────────────────────────────────────────────
    const title = document.createElement('h2');
    title.style.cssText = 'font-size:18px;font-weight:700;color:var(--text-primary);margin-bottom:6px;';
    title.textContent = c.name;

    const desc = document.createElement('p');
    desc.style.cssText = 'font-size:13px;color:var(--text-secondary);line-height:1.55;margin-bottom:16px;';
    desc.textContent = c.description;

    // ── Caja de endpoint ──────────────────────────────────────────────────────
    const endpointBox = document.createElement('div');
    endpointBox.style.cssText = 'background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:12px 14px;margin-bottom:18px;font-family:var(--font-mono);font-size:12px;';

    const endpointLabel = document.createElement('div');
    endpointLabel.style.cssText = 'color:var(--text-muted);font-size:10px;text-transform:uppercase;margin-bottom:4px;letter-spacing:0.05em;';
    endpointLabel.textContent = 'Dirección / Endpoint Oficial:';

    const endpointWrapper = document.createElement('div');
    endpointWrapper.style.wordBreak = 'break-all';

    const endpointLink = document.createElement('a');
    endpointLink.href   = c.endpoint;           // URL procedente del backend (de confianza)
    endpointLink.target = '_blank';
    endpointLink.rel    = 'noopener noreferrer';
    endpointLink.style.cssText = 'color:var(--accent-cyan);text-decoration:none;';
    endpointLink.title  = 'Abrir endpoint en navegador';
    endpointLink.textContent = `${c.endpoint} ↗`;

    endpointWrapper.appendChild(endpointLink);
    endpointBox.append(endpointLabel, endpointWrapper);

    // ── Métricas de pie de tarjeta ────────────────────────────────────────────
    const metricsRow = document.createElement('div');
    metricsRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,0.06);padding-top:14px;margin-top:8px;font-size:12px;flex-wrap:wrap;gap:8px;';

    const protocolDiv = document.createElement('div');
    const protocolLabel = document.createElement('span');
    protocolLabel.style.color = 'var(--text-muted)';
    protocolLabel.textContent = 'Protocolo:';
    const protocolValue = document.createElement('span');
    protocolValue.style.cssText = 'color:var(--text-primary);font-weight:600;margin-left:4px;';
    protocolValue.textContent = c.protocol;
    protocolDiv.append(protocolLabel, protocolValue);

    const latencyDiv = document.createElement('div');
    latencyDiv.style.cssText = 'display:flex;align-items:center;gap:6px;';
    const latencyLabel = document.createElement('span');
    latencyLabel.style.color = 'var(--text-muted)';
    latencyLabel.textContent = 'Latencia:';
    const latencyValue = document.createElement('span');
    latencyValue.className = `font-mono font-bold ${getLatencyClass(c.latencyMs)}`;
    latencyValue.textContent = formatLatency(c.latencyMs);
    latencyDiv.append(latencyLabel, latencyValue);

    metricsRow.append(protocolDiv, latencyDiv);

    // ── Ensamblar tarjeta ─────────────────────────────────────────────────────
    const topSection = document.createElement('div');
    topSection.append(headerRow, title, desc, endpointBox);

    const bottomSection = document.createElement('div');
    bottomSection.appendChild(metricsRow);

    card.append(topSection, bottomSection);
    fragment.appendChild(card);
  }

  // Un único reflow para todos los conectores (skill: vanilla-dom-batching)
  container.replaceChildren(fragment);
}

// ─────────────────────────────────────────────────────────────────────────────
// Inicialización del módulo
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadConnectorsStatus(false);

  const refreshBtn = $('btn-refresh-all-connectors');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => loadConnectorsStatus(true));
  }
});

// Exponer en window para compatibilidad con el onclick inline del HTML
window.loadConnectorsStatus = loadConnectorsStatus;
