/**
 * flota.js
 * Lógica dedicada para el Panel de Flota Corporativa de Equipos.
 * Conexión directa a la API de flota, telemetría y navegación nativa a la ficha técnica.
 */

'use strict';

const $ = (id) => document.getElementById(id);

let allFleetDevices = [];

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
  toast._timer = setTimeout(() => {
    toast.className = 'toast';
  }, duration);
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 60) return 'Hace unos segundos';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Hace ${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    return `Hace ${diffDays} días`;
  } catch {
    return String(dateStr);
  }
}

// ================================================================
// Carga de Datos de la Flota y Métricas
// ================================================================

async function loadFleetData(isManualRefresh = false) {
  try {
    if (isManualRefresh) showToast('Actualizando datos de la flota...', 'info', 1500);

    const [statsRes, devicesRes, settingsRes] = await Promise.all([
      fetch('/api/fleet/stats'),
      fetch('/api/fleet/devices'),
      fetch('/api/fleet/settings')
    ]);

    if (!statsRes.ok || !devicesRes.ok) throw new Error('Error al consultar datos de la flota');

    const stats = await statsRes.json();
    const devices = await devicesRes.json();
    allFleetDevices = devices;

    // Actualizar KPIs superiores
    const totalEl = $('stat-total-devices');
    if (totalEl) totalEl.textContent = stats.totalDevices || 0;

    const breakdownEl = $('stat-devices-breakdown');
    if (breakdownEl) {
      const lenovoCount = devices.filter(d => d.oem === 'lenovo').length;
      const hpCount = devices.filter(d => d.oem === 'hp').length;
      breakdownEl.textContent = `Lenovo: ${lenovoCount} · HP: ${hpCount}`;
    }

    const navBadge = $('nav-fleet-count-badge');
    if (navBadge) navBadge.textContent = stats.totalDevices || 0;

    const uptodateEl = $('stat-uptodate-devices');
    if (uptodateEl) uptodateEl.textContent = stats.uptodateDevices || 0;

    const outdatedEl = $('stat-outdated-devices');
    if (outdatedEl) outdatedEl.textContent = stats.outdatedDevices || 0;

    const criticalEl = $('stat-critical-count');
    if (criticalEl) criticalEl.textContent = stats.criticalPendingCount || 0;

    // Actualizar badge de modo
    if (settingsRes.ok) {
      const settings = await settingsRes.json();
      const modeBadge = $('nav-mode-badge');
      if (modeBadge) {
        if (settings.fleet_mode === 'scheduled') {
          modeBadge.textContent = 'Actualización Auto';
          modeBadge.className = 'nav-mode-badge auto';
        } else {
          modeBadge.textContent = 'Solo Saber';
          modeBadge.className = 'nav-mode-badge audit';
        }
      }
    }

    // Renderizar tabla
    renderFleetTable(devices);

    if (isManualRefresh) showToast('Flota actualizada correctamente', 'success');
  } catch (err) {
    console.error('Error cargando flota:', err);
    showToast('Error al conectar con el servidor: ' + err.message, 'error');
  }
}

// ================================================================
// Renderizado de Tabla de Equipos
// ================================================================

function renderFleetTable(devices) {
  const tbody = $('fleet-table-tbody');
  const emptyState = $('fleet-empty-state');
  if (!tbody) return;

  if (devices.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  tbody.innerHTML = devices.map(d => {
    let statusPill = '';
    if (d.critical_pending && d.critical_pending > 0) {
      statusPill = `<span class="status-pill critical">Crítico (${d.critical_pending})</span>`;
    } else if (d.compliance_rate === 100) {
      statusPill = `<span class="status-pill compliant">Al Día</span>`;
    } else {
      statusPill = `<span class="status-pill outdated">Desactualizado</span>`;
    }

    const rate = Math.min(100, Math.max(0, d.compliance_rate || 0));
    let barClass = 'high';
    if (rate < 60) barClass = 'low';
    else if (rate < 90) barClass = 'mid';

    const pendingTotal = (d.outdated_drivers || 0) + (d.pending_drivers || 0);
    const isDemo = d.is_demo === 1 || ['LNV-PF12A9B1', 'LNV-PF23B8C2', 'HP-5CD142980', 'HP-5CD932014'].includes(d.id);
    const demoBadge = isDemo ? `<span class="status-pill critical" style="font-size:9px; padding:1px 5px; margin-left:4px;">DEMO</span>` : '';
    const detailUrl = `/equipo?id=${encodeURIComponent(d.id)}`;

    return `
      <tr class="clickable-row" onclick="window.location.href='${detailUrl}'">
        <td>${statusPill}</td>
        <td>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <a href="${detailUrl}" style="font-weight:700; color:var(--accent-cyan); font-family:var(--font-mono); font-size:13px; text-decoration:none;" onclick="event.stopPropagation()">
              ${escapeHtml(d.hostname)}
            </a>
            ${demoBadge}
            <a href="${detailUrl}" class="btn-inline-monitor" onclick="event.stopPropagation()" title="Ver telemetría y controladores de este equipo">
              Ver Detalles
            </a>
          </div>
          <div style="font-size:11px; color:var(--text-muted); font-family:var(--font-mono); margin-top:2px;">
            IP: ${escapeHtml(d.ip_address || '127.0.0.1')}
          </div>
        </td>
        <td>
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="tab-btn-pill ${d.oem}" style="font-size:10px; padding:1px 6px;">${(d.oem || 'OEM').toUpperCase()}</span>
            <span style="font-weight:600; color:var(--text-primary);">${escapeHtml(d.model_name)}</span>
          </div>
          <div style="font-size:11px; color:var(--text-secondary); margin-top:2px; font-family:var(--font-mono);">
            ID: ${escapeHtml(d.model_id)}
          </div>
        </td>
        <td>
          <div style="font-weight:600; color:var(--text-primary); font-size:12px;" title="${escapeHtml(d.cpu || 'No reportado')}">
            ${escapeHtml(d.cpu ? (d.cpu.length > 28 ? d.cpu.substring(0,28)+'…' : d.cpu) : 'Pendiente check-in')}
          </div>
          <div style="font-size:11px; color:var(--accent-cyan); font-family:var(--font-mono);">
            RAM: ${escapeHtml(d.ram || '—')}
          </div>
        </td>
        <td>
          <div style="color:var(--text-secondary); font-size:12px;">${escapeHtml(d.os_build || 'Windows 11')}</div>
          <div style="font-size:11px; color:var(--text-muted); font-family:var(--font-mono);">BIOS: ${escapeHtml(d.bios_version || '—')}</div>
        </td>
        <td>
          <select class="fleet-inline-select" onclick="event.stopPropagation()" onchange="changeDeviceGroup('${escapeHtml(d.id)}', this.value)" title="Asignar directiva de grupo">
            <option value="pilot" ${d.group_name === 'pilot' ? 'selected' : ''}>Piloto / IT</option>
            <option value="general" ${d.group_name === 'general' ? 'selected' : ''}>General / Prod</option>
            <option value="vip" ${d.group_name === 'vip' ? 'selected' : ''}>VIP / Dirección</option>
          </select>
        </td>
        <td>
          <div class="compliance-bar-wrapper">
            <div class="compliance-bar-track">
              <div class="compliance-bar-fill ${barClass}" style="width: ${rate}%;"></div>
            </div>
            <span class="compliance-percent">${rate}%</span>
          </div>
        </td>
        <td>
          <div style="font-size:12px;">
            <span class="text-green font-bold">${d.uptodate_drivers || 0}</span> al día · 
            <span class="${pendingTotal > 0 ? 'text-yellow font-bold' : 'text-muted'}">${pendingTotal}</span> pendientes
          </div>
          ${d.critical_pending > 0 ? `<div style="font-size:11px; color:var(--severity-critical); font-weight:600;">${d.critical_pending} parches críticos</div>` : ''}
        </td>
        <td style="color:var(--text-muted); font-size:12px;">
          ${formatTimeAgo(d.last_seen)}
        </td>
        <td style="text-align:right;">
          <div style="display:flex; gap:6px; justify-content:flex-end;">
            <a href="${detailUrl}" class="fleet-btn-secondary" onclick="event.stopPropagation()" style="text-decoration:none; font-size:11px; padding:4px 10px; font-weight:600; color:var(--accent-cyan); border-color:rgba(6,182,212,0.4);" title="Abrir centro de telemetría y controladores">
              Monitorizar
            </a>
            <button type="button" class="fleet-btn-primary" onclick="event.stopPropagation(); triggerDeviceDeployment('${escapeHtml(d.id)}')" ${pendingTotal === 0 ? 'disabled' : ''} style="font-size:11px; padding:4px 10px; font-weight:600;" title="${pendingTotal === 0 ? 'Equipo totalmente actualizado' : 'Enviar orden de actualización'}">
              Actualizar
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ================================================================
// Filtros y Búsqueda
// ================================================================

function filterFleetTable() {
  const query = ($('fleet-search-input')?.value || '').toLowerCase().trim();
  const filterGroup = $('fleet-filter-group')?.value || '';
  const filterOem = $('fleet-filter-oem')?.value || '';
  const filterStatus = $('fleet-filter-status')?.value || '';

  const filtered = allFleetDevices.filter(d => {
    if (query) {
      const matchHost = (d.hostname || '').toLowerCase().includes(query);
      const matchIp = (d.ip_address || '').toLowerCase().includes(query);
      const matchModel = (d.model_name || '').toLowerCase().includes(query);
      const matchModelId = (d.model_id || '').toLowerCase().includes(query);
      const matchCpu = (d.cpu || '').toLowerCase().includes(query);
      const matchSerial = (d.serial_number || '').toLowerCase().includes(query);
      if (!matchHost && !matchIp && !matchModel && !matchModelId && !matchCpu && !matchSerial) return false;
    }

    if (filterGroup && d.group_name !== filterGroup) return false;
    if (filterOem && d.oem !== filterOem) return false;

    if (filterStatus) {
      if (filterStatus === 'compliant' && d.compliance_rate < 100) return false;
      if (filterStatus === 'outdated' && d.compliance_rate === 100) return false;
      if (filterStatus === 'critical' && (!d.critical_pending || d.critical_pending === 0)) return false;
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
    const res = await fetch(`/api/fleet/devices/${encodeURIComponent(deviceId)}/group`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group: newGroup })
    });

    if (!res.ok) throw new Error('Error al actualizar el grupo');
    const found = allFleetDevices.find(d => d.id === deviceId);
    if (found) found.group_name = newGroup;
    showToast(`Grupo de '${found ? found.hostname : deviceId}' actualizado a '${newGroup}'`, 'info');
  } catch (err) {
    showToast('Error al cambiar grupo: ' + err.message, 'error');
  }
}

async function triggerDeviceDeployment(deviceId) {
  try {
    const res = await fetch(`/api/fleet/devices/${encodeURIComponent(deviceId)}/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al lanzar despliegue');
    showToast(`Orden de actualización enviada (${data.driversCount} paquetes). Se aplicará en el próximo check-in del equipo.`, 'success', 5000);
  } catch (err) {
    showToast('Error al programar actualización: ' + err.message, 'error');
  }
}

async function confirmClearDemoDevices() {
  const ok = confirm('¿Deseas eliminar todos los equipos de prueba/demostración para ver únicamente tus equipos reales conectados?');
  if (!ok) return;

  try {
    const res = await fetch('/api/fleet/clear-demo', { method: 'POST' });
    const data = await res.json();
    showToast(`Se han eliminado ${data.count || 0} equipos de demostración.`, 'success');
    loadFleetData(true);
  } catch (err) {
    showToast('Error al limpiar datos demo: ' + err.message, 'error');
  }
}

// ================================================================
// Modal de Enrolamiento Intune y MSI
// ================================================================

function getAgentServerHost() {
  const customHost = ($('agent-server-host-input')?.value || '').trim();
  if (customHost) {
    if (customHost.startsWith('http://') || customHost.startsWith('https://')) return customHost;
    return `https://${customHost}`;
  }
  return window.location.origin;
}

function updateAgentEnrollCommandString() {
  const serverUrl = getAgentServerHost();
  const cmd = `powershell -ExecutionPolicy Bypass -Command "irm ${serverUrl}/api/agent/install | iex"`;
  const display = $('agent-enroll-cmd-display');
  if (display) display.textContent = cmd;

  const msiDisplay = $('msi-install-cmd-display');
  if (msiDisplay) {
    msiDisplay.textContent = `msiexec /i OEM-Client-Agent-1.0.0.msi /qn SERVER_URL="${serverUrl}"`;
  }
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
  const btn = $('copy-agent-cmd-btn');
  if (!display) return;
  const cmd = display.textContent.trim();
  navigator.clipboard.writeText(cmd).then(() => {
    showToast('Comando PowerShell copiado al portapapeles', 'success');
  });
}

function copyMsiInstallCommand() {
  const el = $('msi-install-cmd-display');
  if (!el) return;
  navigator.clipboard.writeText(el.textContent.trim()).then(() => {
    showToast('Comando msiexec copiado al portapapeles', 'success');
  });
}

function downloadAgentInstallScript() {
  const serverUrl = getAgentServerHost();
  const a = document.createElement('a');
  a.href = `${serverUrl}/api/agent/install`;
  a.download = 'Instalar-OEM-Agent.ps1';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Descargando script de enrolamiento de agente...', 'info');
}

// Exponer funciones globales
window.loadFleetData = loadFleetData;
window.filterFleetTable = filterFleetTable;
window.changeDeviceGroup = changeDeviceGroup;
window.triggerDeviceDeployment = triggerDeviceDeployment;
window.confirmClearDemoDevices = confirmClearDemoDevices;
window.openAgentEnrollModal = openAgentEnrollModal;
window.closeAgentEnrollModal = closeAgentEnrollModal;
window.resetAgentServerHost = resetAgentServerHost;
window.updateAgentEnrollCommandString = updateAgentEnrollCommandString;
window.copyAgentEnrollCommand = copyAgentEnrollCommand;
window.copyMsiInstallCommand = copyMsiInstallCommand;
window.downloadAgentInstallScript = downloadAgentInstallScript;

document.addEventListener('DOMContentLoaded', () => {
  loadFleetData(false);

  // Enlazar listeners programáticos para máxima compatibilidad con cualquier política CSP
  const btnIntune = $('btn-fleet-intune');
  if (btnIntune) btnIntune.addEventListener('click', openAgentEnrollModal);

  const btnClearDemo = $('btn-fleet-clear-demo');
  if (btnClearDemo) btnClearDemo.addEventListener('click', confirmClearDemoDevices);

  const btnRefresh = $('btn-fleet-refresh');
  if (btnRefresh) btnRefresh.addEventListener('click', () => loadFleetData(true));

  const searchInput = $('fleet-search-input');
  if (searchInput) searchInput.addEventListener('input', filterFleetTable);

  const filterGroup = $('fleet-filter-group');
  if (filterGroup) filterGroup.addEventListener('change', filterFleetTable);

  const filterOem = $('fleet-filter-oem');
  if (filterOem) filterOem.addEventListener('change', filterFleetTable);

  const filterStatus = $('fleet-filter-status');
  if (filterStatus) filterStatus.addEventListener('change', filterFleetTable);
});
