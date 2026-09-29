/**
 * equipo.js
 * Ficha Tecnica y Telemetria de un Equipo individual - Vanilla JS optimizado.
 *
 * Patrones aplicados:
 *  - apiFetch: wrapper JWT + AbortSignal
 *  - mostrarCargandoDrivers/ocultarCargandoDrivers: Skeleton Loader hook
 *  - renderDriversList: DocumentFragment, un unico reflow (vanilla-dom-batching P1)
 *  - onDriverSearchInput: debounce 300ms (vanilla-dom-batching P4)
 */

'use strict';

const $ = (id) => document.getElementById(id);

let currentDevice      = null;
let currentDriverFilter = 'all';
let currentSortKey     = 'driver_name';
let currentSortDir     = 'asc';

// ================================================================
// Utilidades
// ================================================================

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, type = 'info', duration = 3500) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className   = `toast show ${type}`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.className = 'toast'; }, duration);
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return '--';
  try {
    const date = new Date(dateStr);
    const now  = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 60) return 'Hace unos segundos';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Hace ${diffHours} h`;
    return `Hace ${Math.floor(diffHours / 24)} dias`;
  } catch { return String(dateStr); }
}

// ================================================================
// apiFetch -- wrapper JWT + AbortSignal
// ================================================================
const SESSION_TOKEN_KEY = 'oem_admin_token';

function apiFetch(url, opts = {}, signal = null) {
  const token = localStorage.getItem(SESSION_TOKEN_KEY);
  const headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(url, { ...opts, headers, signal }).then(res => {
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem(SESSION_TOKEN_KEY);
      const err = new Error(res.status === 401 ? 'TOKEN_MISSING' : 'TOKEN_INVALID');
      err.status = res.status;
      throw err;
    }
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}: ${res.statusText}`);
      err.status = res.status;
      throw err;
    }
    return res;
  });
}

// ================================================================
// Feedback Visual -- Skeleton Loader para la tabla de drivers
// ================================================================

function mostrarCargandoDrivers() {
  const tbody = $('eq-drivers-tbody');
  if (!tbody) return;
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 4; i++) {
    const tr = document.createElement('tr');
    tr.className = 'skeleton-row';
    tr.setAttribute('aria-hidden', 'true');
    for (let j = 0; j < 7; j++) {
      const td  = document.createElement('td');
      const div = document.createElement('div');
      div.className = 'skeleton-pulse';
      td.appendChild(div);
      tr.appendChild(td);
    }
    fragment.appendChild(tr);
  }
  tbody.replaceChildren(fragment);
}

function ocultarCargandoDrivers() {
  // Las filas reales sustituyen a las skeleton en renderDriversList
}

// ================================================================
// Carga del Dispositivo
// ================================================================

let _deviceFetchController = null;

async function loadDeviceData() {
  const params   = new URLSearchParams(window.location.search);
  const deviceId = params.get('id');
  if (!deviceId) { window.location.href = '/flota'; return; }

  if (_deviceFetchController) _deviceFetchController.abort();
  _deviceFetchController = new AbortController();
  const { signal } = _deviceFetchController;

  mostrarCargandoDrivers();

  try {
    const res = await apiFetch(`/api/fleet/devices/${encodeURIComponent(deviceId)}`, { method: 'GET' }, signal);
    const dev = await res.json();
    currentDevice = dev;

    // Titulo y breadcrumb
    document.title = `${dev.hostname} -- OEM Driver Explorer`;
    const breadcrumb = $('eq-breadcrumb-name');
    if (breadcrumb) breadcrumb.textContent = dev.hostname;
    const titleEl = $('eq-hostname-title');
    if (titleEl)  titleEl.textContent = dev.hostname;
    const subEl = $('eq-model-subtitle');
    if (subEl)    subEl.textContent = `${dev.model_name} (ID: ${dev.model_id}) - IP: ${dev.ip_address || '--'} - BIOS: ${dev.bios_version || '--'}`;

    // Badges superiores
    const oemBadge = $('eq-badge-oem');
    if (oemBadge) {
      oemBadge.className   = `tab-btn-pill ${dev.oem}`;
      oemBadge.textContent = (dev.oem || 'OEM').toUpperCase();
    }
    const groupBadge = $('eq-badge-group');
    if (groupBadge) groupBadge.textContent = `Grupo: ${(dev.group_name || 'General').toUpperCase()}`;
    const compBadge = $('eq-badge-compliance');
    if (compBadge) {
      compBadge.textContent = `${dev.compliance_rate}% CUMPLIMIENTO`;
      compBadge.className   = dev.compliance_rate >= 90 ? 'admit-badge-lg admit'
        : dev.compliance_rate >= 60 ? 'admit-badge-lg' : 'admit-badge-lg rejected';
    }
    const isDemo = dev.is_demo === 1 || ['LNV-PF12A9B1','LNV-PF23B8C2','HP-5CD142980','HP-5CD932014'].includes(dev.id);
    const demoBadge = $('eq-badge-demo');
    if (demoBadge) demoBadge.style.display = isDemo ? 'inline-block' : 'none';

    // Telemetria de Hardware
    const fields = {
      'eq-cpu':         dev.cpu          || 'No reportado',
      'eq-ram':         dev.ram          || 'No reportado',
      'eq-serial':      dev.serial_number || dev.id || 'N/A',
      'eq-motherboard': dev.motherboard  || `${(dev.oem||'').toUpperCase()} ${dev.model_id||''}`,
      'eq-os':          `${dev.os_edition || 'Windows'} -- ${dev.os_build || ''}`,
      'eq-bios':        dev.bios_version || 'N/A',
      'eq-mac':         dev.mac_address  || 'No detectada',
      'eq-ip':          dev.ip_address   || '127.0.0.1',
      'eq-uuid':        dev.id           || '--',
    };
    for (const [id, val] of Object.entries(fields)) {
      const el = $(id);
      if (el) el.textContent = val;
    }
    const lastSeenEl = $('eq-last-seen');
    if (lastSeenEl) lastSeenEl.textContent = formatTimeAgo(dev.last_seen);

    // Boton de despliegue
    const pendingTotal = (dev.outdated_drivers || 0) + (dev.pending_drivers || 0);
    const deployBtn    = $('eq-btn-deploy');
    if (deployBtn) {
      deployBtn.disabled     = pendingTotal === 0;
      deployBtn.textContent  = pendingTotal === 0
        ? 'Equipo Totalmente al Dia'
        : `Actualizar ${pendingTotal} Controladores Pendientes`;
    }

    // Pestanas y resumen
    const drivers  = dev.drivers || [];
    const uptodate = drivers.filter(d => d.status === 'ACTUALIZADO').length;
    const pending  = drivers.filter(d => d.status !== 'ACTUALIZADO').length;

    const tabAll = $('tab-drv-all');
    if (tabAll) tabAll.textContent = `Todos (${drivers.length})`;
    const tabPending = $('tab-drv-pending');
    if (tabPending) tabPending.textContent = `Pendientes (${pending})`;
    const tabUptodate = $('tab-drv-uptodate');
    if (tabUptodate) tabUptodate.textContent = `Al Dia (${uptodate})`;

    const summaryEl = $('eq-drivers-summary');
    if (summaryEl) {
      summaryEl.textContent = `${drivers.length} controladores cotejados con el catalogo de ${dev.oem.toUpperCase()} (${uptodate} al dia, ${pending} desactualizados o pendientes).`;
    }

    renderDriversList();
  } catch (err) {
    if (err.name === 'AbortError') return;
    console.error('[equipo] Error cargando equipo:', err);
    showToast('Error al cargar datos del equipo: ' + err.message, 'error');
  } finally {
    ocultarCargandoDrivers();
    _deviceFetchController = null;
  }
}

function sortByColumn(key) {
  if (currentSortKey === key) {
    currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    currentSortKey = key;
    currentSortDir = 'asc';
  }
  updateSortHeaderUI();
  renderDriversList();
}

function updateSortHeaderUI() {
  const keys = ['driver_name', 'category', 'installed_version', 'target_version', 'status', 'severity', 'is_admitted'];
  for (const k of keys) {
    const el = document.getElementById(`sort-icon-${k}`);
    if (el) {
      if (k === currentSortKey) {
        el.textContent = currentSortDir === 'asc' ? '▲' : '▼';
      } else {
        el.textContent = '';
      }
    }
  }
}

// ================================================================
// Renderizado del Inventario de Drivers -- DocumentFragment
// (skill: vanilla-dom-batching, Patron 1)
// ================================================================

function renderDriversList() {
  if (!currentDevice) return;
  const tbody = $('eq-drivers-tbody');
  if (!tbody)  return;

  const query = ($('eq-driver-search')?.value || '').toLowerCase().trim();
  let drivers  = currentDevice.drivers || [];

  if (currentDriverFilter === 'pending')  drivers = drivers.filter(d => d.status !== 'ACTUALIZADO');
  if (currentDriverFilter === 'uptodate') drivers = drivers.filter(d => d.status === 'ACTUALIZADO');
  if (query) {
    drivers = drivers.filter(d =>
      (d.driver_name || '').toLowerCase().includes(query) ||
      (d.category    || '').toLowerCase().includes(query)
    );
  }

  // Ordenamiento dinámico según la columna seleccionada
  drivers = [...drivers].sort((a, b) => {
    let valA = a[currentSortKey] ?? '';
    let valB = b[currentSortKey] ?? '';

    if (typeof valA === 'number' && typeof valB === 'number') {
      return currentSortDir === 'asc' ? valA - valB : valB - valA;
    }

    valA = String(valA).toLowerCase();
    valB = String(valB).toLowerCase();

    if (valA < valB) return currentSortDir === 'asc' ? -1 : 1;
    if (valA > valB) return currentSortDir === 'asc' ? 1 : -1;
    return 0;
  });

  if (drivers.length === 0) {
    const tr  = document.createElement('tr');
    const td  = document.createElement('td');
    td.colSpan = 7;
    td.style.cssText = 'text-align:center;padding:32px;color:var(--text-muted);';
    td.textContent   = 'No se encontraron controladores con los criterios de busqueda aplicados.';
    tr.appendChild(td);
    tbody.replaceChildren(tr);
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const d of drivers) {
    const tr = document.createElement('tr');

    // Col 1: Nombre + enlace de descarga
    const tdName = document.createElement('td');
    const nameDiv = document.createElement('div');
    nameDiv.style.cssText = 'font-weight:600;color:var(--text-primary);font-size:13px;';
    nameDiv.textContent = d.driver_name;
    tdName.appendChild(nameDiv);
    if (d.download_url) {
      const dlLink = document.createElement('a');
      dlLink.href   = d.download_url;
      dlLink.target = '_blank';
      dlLink.rel    = 'noopener noreferrer';
      dlLink.style.cssText = 'font-size:11px;color:var(--accent-cyan);text-decoration:none;margin-top:2px;display:inline-block;';
      dlLink.textContent = `Descarga Oficial (${d.file_size || '--'}) ->`;
      tdName.appendChild(dlLink);
    }

    // Col 2: Categoria
    const tdCat  = document.createElement('td');
    const catBadge = document.createElement('span');
    catBadge.className = 'category-badge';
    catBadge.style.cssText = 'font-size:10px;padding:2px 6px;';
    catBadge.textContent = d.category || 'General';
    tdCat.appendChild(catBadge);

    // Col 3: Version instalada
    const tdInstalled = document.createElement('td');
    tdInstalled.className = 'font-mono';
    tdInstalled.style.cssText = 'font-size:12px;color:var(--text-secondary);';
    tdInstalled.textContent = d.installed_version || 'No detectada';

    // Col 4: Version objetivo
    const tdTarget = document.createElement('td');
    tdTarget.className = 'font-mono';
    tdTarget.style.cssText = 'font-size:12px;color:var(--accent-cyan);font-weight:600;';
    tdTarget.textContent = d.target_version || '--';

    // Col 5: Estado
    const tdStatus   = document.createElement('td');
    const statusPill = document.createElement('span');
    if (d.status === 'ACTUALIZADO') {
      statusPill.className = 'status-pill compliant';
      statusPill.textContent = 'Actualizado';
    } else if (d.status === 'DESACTUALIZADO') {
      statusPill.className = 'status-pill outdated';
      statusPill.textContent = 'Desactualizado';
    } else {
      statusPill.className = 'status-pill critical';
      statusPill.textContent = 'Pendiente';
    }
    tdStatus.appendChild(statusPill);

    // Col 6: Severidad
    const tdSev     = document.createElement('td');
    const sevStr    = String(d.severity || '').toLowerCase();
    const sevClass  = sevStr.includes('cr') ? 'critical' : sevStr.includes('op') ? 'optional' : 'recommended';
    const sevBadge  = document.createElement('span');
    sevBadge.className = `severity-badge ${sevClass}`;
    sevBadge.style.cssText = 'font-size:10px;padding:2px 6px;';
    sevBadge.textContent = d.severity || 'Recomendado';
    tdSev.appendChild(sevBadge);

    // Col 7: Admitido WU
    const tdAdm     = document.createElement('td');
    const admPill   = document.createElement('span');
    if (d.is_admitted) {
      admPill.className = 'status-pill compliant';
      admPill.style.fontSize = '10px';
      admPill.textContent = 'Admitido WU';
    } else {
      admPill.className = 'status-pill outdated';
      admPill.style.fontSize = '10px';
      admPill.textContent = 'Catalogo OEM';
    }
    tdAdm.appendChild(admPill);

    tr.append(tdName, tdCat, tdInstalled, tdTarget, tdStatus, tdSev, tdAdm);
    fragment.appendChild(tr);
  }

  // Un unico reflow para toda la tabla (skill: vanilla-dom-batching, Patron 1)
  tbody.replaceChildren(fragment);
}

// ================================================================
// Filtros de Drivers -- debounce 300ms en busqueda
// (skill: vanilla-dom-batching, Patron 4)
// ================================================================

let _driverSearchTimer = null;

function onDriverSearchInput() {
  clearTimeout(_driverSearchTimer);
  _driverSearchTimer = setTimeout(() => renderDriversList(), 300);
}

function setDriverFilter(type) {
  currentDriverFilter = type;
  const tabAll      = $('tab-drv-all');
  const tabPending  = $('tab-drv-pending');
  const tabUptodate = $('tab-drv-uptodate');
  if (tabAll)      tabAll.className      = type === 'all'      ? 'export-btn selected' : 'export-btn';
  if (tabPending)  tabPending.className  = type === 'pending'  ? 'export-btn selected' : 'export-btn';
  if (tabUptodate) tabUptodate.className = type === 'uptodate' ? 'export-btn selected' : 'export-btn';
  renderDriversList();
}

// filterDriversList mantiene compatibilidad con onchange inline del HTML
function filterDriversList() { renderDriversList(); }

// ================================================================
// Acciones del Equipo
// ================================================================

async function triggerCurrentDeviceDeploy() {
  if (!currentDevice) return;
  const btn = $('eq-btn-deploy');
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando orden...'; }
  try {
    const res  = await apiFetch(`/api/fleet/devices/${encodeURIComponent(currentDevice.id)}/deploy`, {
      method: 'POST', body: JSON.stringify({}),
    });
    const data = await res.json();
    showToast(`Orden de actualizacion enviada (${data.driversCount} parches). Se aplicara en el proximo check-in.`, 'success', 5000);
  } catch (err) {
    showToast('Error al enviar actualizacion: ' + err.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Actualizar Controladores Pendientes'; }
  }
}

async function confirmDeleteCurrentDevice() {
  if (!currentDevice) return;
  if (!confirm(`Seguro que quieres eliminar el equipo "${currentDevice.hostname}" de la flota? Esta accion es permanente.`)) return;
  try {
    await apiFetch(`/api/fleet/devices/${encodeURIComponent(currentDevice.id)}`, { method: 'DELETE' });
    showToast('Equipo eliminado exitosamente', 'success');
    setTimeout(() => { window.location.href = '/flota'; }, 1000);
  } catch (err) {
    showToast('Error al eliminar equipo: ' + err.message, 'error');
  }
}

// ================================================================
// Exposicion global + inicializacion
// ================================================================
window.setDriverFilter             = setDriverFilter;
window.filterDriversList           = filterDriversList;
window.triggerCurrentDeviceDeploy  = triggerCurrentDeviceDeploy;
window.confirmDeleteCurrentDevice  = confirmDeleteCurrentDevice;
window.loadClientTelemetry         = loadClientTelemetry;
window.sortByColumn                = sortByColumn;

document.addEventListener('DOMContentLoaded', () => {
  loadDeviceData();

  const btnDeploy = $('eq-btn-deploy');
  if (btnDeploy) btnDeploy.addEventListener('click', triggerCurrentDeviceDeploy);

  const btnDelete = $('eq-btn-delete');
  if (btnDelete)  btnDelete.addEventListener('click', confirmDeleteCurrentDevice);

  const tabAll = $('tab-drv-all');
  if (tabAll)   tabAll.addEventListener('click', () => setDriverFilter('all'));

  const tabPending = $('tab-drv-pending');
  if (tabPending)  tabPending.addEventListener('click', () => setDriverFilter('pending'));

  const tabUptodate = $('tab-drv-uptodate');
  if (tabUptodate)  tabUptodate.addEventListener('click', () => setDriverFilter('uptodate'));

  // Busqueda con debounce 300ms (skill: vanilla-dom-batching, Patron 4)
  const searchInput = $('eq-driver-search');
  if (searchInput)  searchInput.addEventListener('input', onDriverSearchInput);
});

// ------------------------------------------------------------------
// Telemetria del Cliente (Logs del Agente Local)
// ------------------------------------------------------------------
async function loadClientTelemetry() {
  if (!currentDevice || !currentDevice.id) return;
  
  const consoleBody = document.getElementById('telemetry-console');
  if (!consoleBody) return;
  
  consoleBody.innerHTML = '<tr><td colspan="3" style="color:var(--text-muted);"><div class="spinner-small" style="display:inline-block; margin-right:8px; width:12px; height:12px; border:2px solid var(--accent); border-radius:50%; border-top-color:transparent; animation:spin 1s linear infinite;"></div>Cargando logs desde el servidor...</td></tr>';
  
  try {
    const res = await apiFetch(`/api/fleet/${encodeURIComponent(currentDevice.id)}/logs?limit=50`);
    if (!res.ok) throw new Error('Error de red');
    const logs = await res.json();
    
    if (!logs || logs.length === 0) {
      consoleBody.innerHTML = '<tr><td colspan="3" style="color:var(--text-muted);">No hay eventos registrados para este equipo.</td></tr>';
      return;
    }
    
    const fragment = document.createDocumentFragment();
    logs.forEach(log => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
      
      let levelColor = '#38bdf8'; // INFO
      if (log.level === 'ERROR') levelColor = '#f87171';
      if (log.level === 'SUCCESS' || log.level === 'OK') levelColor = '#34d399';
      if (log.level === 'WARN' || log.level === 'WARNING') levelColor = '#facc15';
      
      const dateStr = new Date(log.timestamp).toLocaleString('es-ES', { 
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' 
      });

      tr.innerHTML = `
        <td style="width: 140px; padding: 6px 4px; vertical-align: top; color: var(--text-muted); border-right: 1px solid rgba(255,255,255,0.1);">
          ${dateStr}
        </td>
        <td style="width: 80px; padding: 6px 8px; vertical-align: top; font-weight: 600; color: ${levelColor};">
          [${log.level}]
        </td>
        <td style="padding: 6px 4px; vertical-align: top; color: #f1f5f9;">
          ${escapeHtml(log.message)}
        </td>
      `;
      fragment.appendChild(tr);
    });
    
    consoleBody.innerHTML = '';
    consoleBody.appendChild(fragment);
    
  } catch (err) {
    console.error('Error cargando telemetria:', err);
    consoleBody.innerHTML = '<tr><td colspan="3" style="color:#f87171;">Error al recuperar telemetria del servidor.</td></tr>';
  }
}

// Cargar telemetría automáticamente tras renderizar el equipo
const originalLoadDeviceData = loadDeviceData;
loadDeviceData = async function() {
  await originalLoadDeviceData();
  if (currentDevice) {
    loadClientTelemetry();
  }
};
