/**
 * flota.js
 * Panel de Flota Corporativa - Vanilla JS optimizado.
 *
 * Patrones aplicados:
 *  - apiFetch: wrapper JWT + AbortSignal
 *  - mostrarCargando/ocultarCargando: feedback visual (Skeleton Loader hook)
 *  - renderFleetTable: DocumentFragment, un unico reflow (vanilla-dom-batching P1)
 *  - setupTableEventDelegation: un listener en tbody (vanilla-dom-batching P2)
 *  - onSearchInput: debounce 300ms + AbortController (vanilla-dom-batching P4)
 */

'use strict';

const $ = (id) => document.getElementById(id);

let allFleetDevices = [];

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
  toast.className = `toast show ${type}`;
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
// Feedback Visual -- Skeleton Loader (hook para CSS futuro)
// ================================================================

function mostrarCargando() {
  const tbody = $('fleet-table-tbody');
  if (!tbody) return;
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 5; i++) {
    const tr = document.createElement('tr');
    tr.className = 'skeleton-row';
    tr.setAttribute('aria-hidden', 'true');
    for (let j = 0; j < 10; j++) {
      const td  = document.createElement('td');
      const div = document.createElement('div');
      div.className = 'skeleton-pulse';
      td.appendChild(div);
      tr.appendChild(td);
    }
    fragment.appendChild(tr);
  }
  tbody.replaceChildren(fragment);
  const btn = $('btn-fleet-refresh');
  if (btn) { btn.disabled = true; btn.textContent = 'Cargando...'; }
}

function ocultarCargando() {
  const btn = $('btn-fleet-refresh');
  if (btn) { btn.disabled = false; btn.textContent = 'Actualizar Flota'; }
}

// ================================================================
// Carga de Datos de la Flota y Metricas
// ================================================================

let _fleetFetchController = null;
let FLEET_RINGS = [];

async function loadFleetData(isManualRefresh = false) {
  if (_fleetFetchController) _fleetFetchController.abort();
  _fleetFetchController = new AbortController();
  const { signal } = _fleetFetchController;

  mostrarCargando();
  if (isManualRefresh) showToast('Actualizando datos de la flota...', 'info', 1500);

  try {
    const [statsRes, devicesRes, settingsRes, ringsRes] = await Promise.all([
      apiFetch('/api/fleet/stats',    { method: 'GET' }, signal),
      apiFetch('/api/fleet/devices',  { method: 'GET' }, signal),
      apiFetch('/api/fleet/settings', { method: 'GET' }, signal),
      apiFetch('/api/rings', { method: 'GET' }, signal)
    ]);

    const stats   = await statsRes.json();
    const devices = await devicesRes.json();
    if (ringsRes.ok) FLEET_RINGS = await ringsRes.json();
    allFleetDevices = devices;

    const totalEl = $('stat-total-devices');
    if (totalEl) totalEl.textContent = stats.totalDevices || 0;

    const breakdownEl = $('stat-devices-breakdown');
    if (breakdownEl) {
      breakdownEl.textContent = `Lenovo: ${devices.filter(d => d.oem === 'lenovo').length} - HP: ${devices.filter(d => d.oem === 'hp').length}`;
    }

    const navBadge = $('nav-fleet-count-badge');
    if (navBadge) navBadge.textContent = stats.totalDevices || 0;

    const uptodateEl = $('stat-uptodate-devices');
    if (uptodateEl) uptodateEl.textContent = stats.uptodateDevices || 0;

    const outdatedEl = $('stat-outdated-devices');
    if (outdatedEl) outdatedEl.textContent = stats.outdatedDevices || 0;

    const criticalEl = $('stat-critical-count');
    if (criticalEl) criticalEl.textContent = stats.criticalPendingCount || 0;

    const settings  = await settingsRes.json();
    const modeBadge = $('nav-mode-badge');
    if (modeBadge) {
      modeBadge.textContent = settings.fleet_mode === 'scheduled' ? 'Actualizacion Auto' : 'Solo Saber';
      modeBadge.className   = `nav-mode-badge ${settings.fleet_mode === 'scheduled' ? 'auto' : 'audit'}`;
    }

    renderFleetTable(devices);
    if (isManualRefresh) showToast('Flota actualizada correctamente', 'success');

  } catch (err) {
    if (err.name === 'AbortError') return;
    console.error('[flota] Error:', err);
    showToast('Error al conectar con el servidor: ' + err.message, 'error');
  } finally {
    ocultarCargando();
    _fleetFetchController = null;
  }
}

// ================================================================
// renderFleetTable -- DocumentFragment, un unico reflow
// (skill: vanilla-dom-batching, Patron 1)
// ================================================================

function renderFleetTable(devices) {
  const tbody      = $('fleet-table-tbody');
  const emptyState = $('fleet-empty-state');
  if (!tbody) return;

  if (devices.length === 0) {
    tbody.replaceChildren();
    if (emptyState) emptyState.style.display = 'block';
    return;
  }
  if (emptyState) emptyState.style.display = 'none';

  const fragment = document.createDocumentFragment();

  for (const d of devices) {
    const pendingTotal = (d.outdated_drivers || 0) + (d.pending_drivers || 0);
    const rate         = Math.min(100, Math.max(0, d.compliance_rate || 0));
    const isDemo       = d.is_demo === 1 ||
      ['LNV-PF12A9B1','LNV-PF23B8C2','HP-5CD142980','HP-5CD932014'].includes(d.id);
    const detailUrl    = `/equipo?id=${encodeURIComponent(d.id)}`;

    const tr = document.createElement('tr');
    tr.className  = 'clickable-row';
    tr.dataset.id = d.id;
    tr.addEventListener('click', () => { window.location.href = detailUrl; });

    // Col 1: Estado
    const tdStatus  = document.createElement('td');
    const statusPill = document.createElement('span');
    if (d.critical_pending && d.critical_pending > 0) {
      statusPill.className = 'status-pill critical';
      statusPill.textContent = `Critico (${d.critical_pending})`;
    } else if (d.compliance_rate === 100) {
      statusPill.className = 'status-pill compliant';
      statusPill.textContent = 'Al Dia';
    } else {
      statusPill.className = 'status-pill outdated';
      statusPill.textContent = 'Desactualizado';
    }
    tdStatus.appendChild(statusPill);

    // Col 2: Hostname
    const tdHost  = document.createElement('td');
    const hostRow = document.createElement('div');
    hostRow.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';

    const hostLink = document.createElement('a');
    hostLink.href  = detailUrl;
    hostLink.style.cssText = 'font-weight:700;color:var(--accent-cyan);font-family:var(--font-mono);font-size:13px;text-decoration:none;';
    hostLink.textContent = d.hostname;
    hostLink.addEventListener('click', e => e.stopPropagation());
    hostRow.appendChild(hostLink);

    if (isDemo) {
      const demoBadge = document.createElement('span');
      demoBadge.className = 'status-pill critical';
      demoBadge.style.cssText = 'font-size:9px;padding:1px 5px;';
      demoBadge.textContent = 'DEMO';
      hostRow.appendChild(demoBadge);
    }

    const detailLink = document.createElement('a');
    detailLink.href  = detailUrl;
    detailLink.className = 'btn-inline-monitor';
    detailLink.title = 'Ver telemetria y controladores';
    detailLink.textContent = 'Ver Detalles';
    detailLink.addEventListener('click', e => e.stopPropagation());
    hostRow.appendChild(detailLink);

    const ipDiv = document.createElement('div');
    ipDiv.style.cssText = 'font-size:11px;color:var(--text-muted);font-family:var(--font-mono);margin-top:2px;';
    ipDiv.textContent = `IP: ${d.ip_address || '127.0.0.1'}`;
    tdHost.append(hostRow, ipDiv);

    // Col 3: Modelo
    const tdModel   = document.createElement('td');
    const modelRow  = document.createElement('div');
    modelRow.style.cssText = 'display:flex;align-items:center;gap:6px;';
    const oemBadge  = document.createElement('span');
    oemBadge.className = `tab-btn-pill ${d.oem}`;
    oemBadge.style.cssText = 'font-size:10px;padding:1px 6px;';
    oemBadge.textContent = (d.oem || 'OEM').toUpperCase();
    const modelName = document.createElement('span');
    modelName.style.cssText = 'font-weight:600;color:var(--text-primary);';
    modelName.textContent = d.model_name;
    modelRow.append(oemBadge, modelName);
    const modelIdDiv = document.createElement('div');
    modelIdDiv.style.cssText = 'font-size:11px;color:var(--text-secondary);margin-top:2px;font-family:var(--font-mono);';
    modelIdDiv.textContent = `ID: ${d.model_id}`;
    tdModel.append(modelRow, modelIdDiv);

    // Col 4: CPU/RAM
    const tdCpu  = document.createElement('td');
    const cpuDiv = document.createElement('div');
    cpuDiv.style.cssText = 'font-weight:600;color:var(--text-primary);font-size:12px;';
    cpuDiv.title = d.cpu || 'No reportado';
    cpuDiv.textContent = d.cpu ? (d.cpu.length > 28 ? d.cpu.substring(0,28)+'...' : d.cpu) : 'Pendiente check-in';
    const ramDiv = document.createElement('div');
    ramDiv.style.cssText = 'font-size:11px;color:var(--accent-cyan);font-family:var(--font-mono);';
    ramDiv.textContent = `RAM: ${d.ram || '--'}`;
    tdCpu.append(cpuDiv, ramDiv);

    // Col 5: SO/BIOS
    const tdOs   = document.createElement('td');
    const osDiv  = document.createElement('div');
    osDiv.style.cssText = 'color:var(--text-secondary);font-size:12px;';
    osDiv.textContent = d.os_build || 'Windows 11';
    const biosDiv = document.createElement('div');
    biosDiv.style.cssText = 'font-size:11px;color:var(--text-muted);font-family:var(--font-mono);';
    biosDiv.textContent = `BIOS: ${d.bios_version || '--'}`;
    tdOs.append(osDiv, biosDiv);

    // Col 6: Grupo (select) -- data-action para delegacion
    const tdGroup = document.createElement('td');
    const select  = document.createElement('select');
    select.className = 'fleet-inline-select';
    select.title  = 'Asignar Anillo de Despliegue';
    select.dataset.action   = 'change-group';
    select.dataset.deviceId = d.id;
    select.addEventListener('click', e => e.stopPropagation());
    
    FLEET_RINGS.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = r.name;
      if (d.ring_id === r.id) opt.selected = true;
      select.appendChild(opt);
    });
    
    tdGroup.appendChild(select);

    // Col 7: Barra de cumplimiento
    const tdBar     = document.createElement('td');
    const barWrapper = document.createElement('div');
    barWrapper.className = 'compliance-bar-wrapper';
    const barTrack  = document.createElement('div');
    barTrack.className = 'compliance-bar-track';
    const barFill   = document.createElement('div');
    barFill.className = `compliance-bar-fill ${rate < 60 ? 'low' : rate < 90 ? 'mid' : 'high'}`;
    barFill.style.width = `${rate}%`;
    barTrack.appendChild(barFill);
    const barPct = document.createElement('span');
    barPct.className = 'compliance-percent';
    barPct.textContent = `${rate}%`;
    barWrapper.append(barTrack, barPct);
    tdBar.appendChild(barWrapper);

    // Col 8: Drivers
    const tdDrvs    = document.createElement('td');
    const drvsDiv   = document.createElement('div');
    drvsDiv.style.fontSize = '12px';
    const upSp = document.createElement('span');
    upSp.className = 'text-green font-bold';
    upSp.textContent = d.uptodate_drivers || 0;
    const pendSp = document.createElement('span');
    pendSp.className = pendingTotal > 0 ? 'text-yellow font-bold' : 'text-muted';
    pendSp.textContent = pendingTotal;
    drvsDiv.append(upSp, document.createTextNode(' al dia - '), pendSp, document.createTextNode(' pendientes'));
    tdDrvs.appendChild(drvsDiv);
    if (d.critical_pending > 0) {
      const critDiv = document.createElement('div');
      critDiv.style.cssText = 'font-size:11px;color:var(--severity-critical);font-weight:600;';
      critDiv.textContent = `${d.critical_pending} parches criticos`;
      tdDrvs.appendChild(critDiv);
    }

    // Col 9: Last seen
    const tdSeen = document.createElement('td');
    tdSeen.style.cssText = 'color:var(--text-muted);font-size:12px;';
    tdSeen.textContent = formatTimeAgo(d.last_seen);

    // Col 10: Acciones -- data-action para delegacion
    const tdActions  = document.createElement('td');
    tdActions.style.textAlign = 'right';
    const actionsDiv = document.createElement('div');
    actionsDiv.style.cssText = 'display:flex;gap:6px;justify-content:flex-end;';

    // El botón 'Monitorizar' ha sido eliminado por petición.

    const updateBtn = document.createElement('button');
    updateBtn.type  = 'button';
    updateBtn.className = 'fleet-btn-primary';
    updateBtn.style.cssText = 'font-size:11px;padding:4px 10px;font-weight:600;';
    updateBtn.dataset.action   = 'deploy';
    updateBtn.dataset.deviceId = d.id;
    updateBtn.disabled = pendingTotal === 0;
    updateBtn.title = pendingTotal === 0 ? 'Equipo totalmente actualizado' : 'Enviar orden de actualizacion';
    updateBtn.textContent = 'Actualizar';

    actionsDiv.append(updateBtn);
    tdActions.appendChild(actionsDiv);

    tr.append(tdStatus, tdHost, tdModel, tdCpu, tdOs, tdGroup, tdBar, tdDrvs, tdSeen, tdActions);
    fragment.appendChild(tr);
  }

  // Un unico reflow para toda la tabla (skill: vanilla-dom-batching, Patron 1)
  tbody.replaceChildren(fragment);
}

// ================================================================
// Delegacion de Eventos en tbody -- un solo listener para toda la tabla
// (skill: vanilla-dom-batching, Patron 2)
// ================================================================

function setupTableEventDelegation() {
  const tbody = $('fleet-table-tbody');
  if (!tbody) return;

  // Delegado: cambio de grupo en <select>
  tbody.addEventListener('change', async (e) => {
    const select = e.target.closest('select[data-action="change-group"]');
    if (!select) return;
    await changeDeviceGroup(select.dataset.deviceId, select.value);
  });

  // Delegado: boton "Actualizar" (deploy)
  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action="deploy"]');
    if (!btn) return;
    e.stopPropagation();
    await triggerDeviceDeployment(btn.dataset.deviceId);
  });
}

// ================================================================
// Filtros y Busqueda -- debounce 300ms + AbortController
// (skill: vanilla-dom-batching, Patron 4)
// ================================================================

let _searchDebounceTimer = null;
let _searchController    = null;

function onSearchInput() {
  clearTimeout(_searchDebounceTimer);
  _searchDebounceTimer = setTimeout(() => {
    if (_searchController) _searchController.abort();
    _searchController = new AbortController();
    filterFleetTable();
  }, 300);
}

function filterFleetTable() {
  const query        = ($('fleet-search-input')?.value   || '').toLowerCase().trim();
  const filterGroup  = $('fleet-filter-group')?.value    || '';
  const filterOem    = $('fleet-filter-oem')?.value      || '';
  const filterStatus = $('fleet-filter-status')?.value   || '';

  const filtered = allFleetDevices.filter(d => {
    if (query) {
      const fields = [d.hostname, d.ip_address, d.model_name, d.model_id, d.cpu, d.serial_number];
      if (!fields.some(f => (f || '').toLowerCase().includes(query))) return false;
    }
    if (filterGroup  && d.group_name !== filterGroup) return false;
    if (filterOem    && d.oem        !== filterOem)   return false;
    if (filterStatus) {
      if (filterStatus === 'compliant' && d.compliance_rate < 100)                   return false;
      if (filterStatus === 'outdated'  && d.compliance_rate === 100)                 return false;
      if (filterStatus === 'critical'  && !(d.critical_pending > 0))                 return false;
    }
    return true;
  });

  renderFleetTable(filtered);
}

// ================================================================
// Acciones de Dispositivo y Flota
// ================================================================

async function changeDeviceGroup(deviceId, newGroup) {
  try {
    await apiFetch(`/api/fleet/devices/${encodeURIComponent(deviceId)}/group`, {
      method: 'PUT',
      body: JSON.stringify({ group: newGroup }),
    });
    const found = allFleetDevices.find(d => d.id === deviceId);
    if (found) found.ring_id = newGroup;
    const ringName = FLEET_RINGS.find(r => r.id === newGroup)?.name || newGroup;
    showToast(`Anillo de despliegue actualizado a '${ringName}'`, 'info');
  } catch (err) {
    if (err.name === 'AbortError') return;
    showToast('Error al cambiar grupo: ' + err.message, 'error');
  }
}

async function triggerDeviceDeployment(deviceId) {
  const btn = document.querySelector(`button[data-action="deploy"][data-device-id="${deviceId}"]`);
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
  try {
    const res  = await apiFetch(`/api/fleet/devices/${encodeURIComponent(deviceId)}/deploy`, {
      method: 'POST', body: JSON.stringify({}),
    });
    const data = await res.json();
    showToast(`Orden enviada (${data.driversCount} paquetes). Se aplicara en el proximo check-in.`, 'success', 5000);
  } catch (err) {
    if (err.name === 'AbortError') return;
    showToast('Error al programar actualizacion: ' + err.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Actualizar'; }
  }
}

async function confirmClearDemoDevices() {
  if (!confirm('Eliminar todos los equipos de prueba/demostracion?')) return;
  mostrarCargando();
  try {
    const res  = await apiFetch('/api/fleet/clear-demo', { method: 'POST' });
    const data = await res.json();
    showToast(`Se eliminaron ${data.count || 0} equipos de demostracion.`, 'success');
    loadFleetData(true);
  } catch (err) {
    showToast('Error al limpiar datos demo: ' + err.message, 'error');
    ocultarCargando();
  }
}

// ================================================================
// Modal de Enrolamiento Intune y MSI
// ================================================================

function getAgentServerHost() {
  const customHost = ($('agent-server-host-input')?.value || '').trim();
  if (customHost) return customHost.startsWith('http') ? customHost : `https://${customHost}`;
  return window.location.origin;
}

function updateAgentEnrollCommandString() {
  const serverUrl = getAgentServerHost();
  const display   = $('agent-enroll-cmd-display');
  if (display) display.textContent = `powershell -ExecutionPolicy Bypass -Command "irm ${serverUrl}/api/agent/install | iex"`;
  const msiDisplay = $('msi-install-cmd-display');
  if (msiDisplay) msiDisplay.textContent = `msiexec /i OEM-Client-Agent-1.0.0.msi /qn SERVER_URL="${serverUrl}"`;
}

function openAgentEnrollModal() {
  const hostInput = $('agent-server-host-input');
  if (hostInput && !hostInput.value) hostInput.placeholder = window.location.origin;
  updateAgentEnrollCommandString();
  const modal = $('agent-enroll-modal');
  if (modal) modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeAgentEnrollModal() {
  const modal = $('agent-enroll-modal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}

function resetAgentServerHost() {
  const hostInput = $('agent-server-host-input');
  if (hostInput) hostInput.value = '';
  updateAgentEnrollCommandString();
}

function copyAgentEnrollCommand() {
  const display = $('agent-enroll-cmd-display');
  if (!display) return;
  navigator.clipboard.writeText(display.textContent.trim())
    .then(() => showToast('Comando PowerShell copiado al portapapeles', 'success'));
}

function copyMsiInstallCommand() {
  const el = $('msi-install-cmd-display');
  if (!el) return;
  navigator.clipboard.writeText(el.textContent.trim())
    .then(() => showToast('Comando msiexec copiado al portapapeles', 'success'));
}

function downloadAgentInstallScript() {
  const a = document.createElement('a');
  a.href = `${getAgentServerHost()}/api/agent/install`;
  a.download = 'Instalar-OEM-Agent.ps1';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Descargando script de enrolamiento...', 'info');
}

// ================================================================
// Exposicion global (compatibilidad con onclicks inline del HTML)
// ================================================================
window.loadFleetData               = loadFleetData;
window.filterFleetTable            = filterFleetTable;
window.changeDeviceGroup           = changeDeviceGroup;
window.triggerDeviceDeployment     = triggerDeviceDeployment;
window.confirmClearDemoDevices     = confirmClearDemoDevices;
window.openAgentEnrollModal        = openAgentEnrollModal;
window.closeAgentEnrollModal       = closeAgentEnrollModal;
window.resetAgentServerHost        = resetAgentServerHost;
window.updateAgentEnrollCommandString = updateAgentEnrollCommandString;
window.copyAgentEnrollCommand      = copyAgentEnrollCommand;
window.copyMsiInstallCommand       = copyMsiInstallCommand;
window.downloadAgentInstallScript  = downloadAgentInstallScript;

document.addEventListener('DOMContentLoaded', () => {
  // Sincronización de estado: Esperar a que el token exista (auth-guard)
  const token = localStorage.getItem('oem_admin_token');
  if (token) {
    loadFleetData(false);
  }

  setupTableEventDelegation();

  const btnIntune    = $('btn-fleet-intune');
  if (btnIntune)     btnIntune.addEventListener('click', openAgentEnrollModal);

  const btnClearDemo = $('btn-fleet-clear-demo');
  if (btnClearDemo)  btnClearDemo.addEventListener('click', confirmClearDemoDevices);

  const btnRefresh   = $('btn-fleet-refresh');
  if (btnRefresh)    btnRefresh.addEventListener('click', () => {
    if (localStorage.getItem('oem_admin_token')) {
      loadFleetData(true);
    }
  });

  // Busqueda con debounce 300ms (skill: vanilla-dom-batching, Patron 4)
  const searchInput = $('fleet-search-input');
  if (searchInput)  searchInput.addEventListener('input', onSearchInput);

  const filterGroup  = $('fleet-filter-group');
  if (filterGroup)   filterGroup.addEventListener('change', filterFleetTable);

  const filterOem    = $('fleet-filter-oem');
  if (filterOem)     filterOem.addEventListener('change', filterFleetTable);

  const filterStatus = $('fleet-filter-status');
  if (filterStatus)  filterStatus.addEventListener('change', filterFleetTable);
});