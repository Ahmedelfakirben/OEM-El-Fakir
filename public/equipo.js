/**
 * equipo.js
 * Lógica dedicada para la Ficha Técnica y Telemetría de un Equipo individual.
 */

'use strict';

const $ = (id) => document.getElementById(id);

let currentDevice = null;
let currentDriverFilter = 'all';

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
// Carga del Dispositivo
// ================================================================

async function loadDeviceData() {
  const params = new URLSearchParams(window.location.search);
  const deviceId = params.get('id');

  if (!deviceId) {
    window.location.href = '/flota';
    return;
  }

  try {
    const res = await fetch(`/api/fleet/devices/${encodeURIComponent(deviceId)}`);
    if (!res.ok) throw new Error('Equipo no encontrado en la base de datos');

    const dev = await res.json();
    currentDevice = dev;

    // Actualizar título y breadcrumb
    document.title = `${dev.hostname} — OEM Driver Explorer`;
    const breadcrumb = $('eq-breadcrumb-name');
    if (breadcrumb) breadcrumb.textContent = dev.hostname;

    const titleEl = $('eq-hostname-title');
    if (titleEl) titleEl.textContent = dev.hostname;

    const subEl = $('eq-model-subtitle');
    if (subEl) subEl.textContent = `${dev.model_name} (ID: ${dev.model_id}) · IP: ${dev.ip_address || '—'} · BIOS: ${dev.bios_version || '—'}`;

    // Badges superiores
    const oemBadge = $('eq-badge-oem');
    if (oemBadge) {
      oemBadge.className = `tab-btn-pill ${dev.oem}`;
      oemBadge.textContent = (dev.oem || 'OEM').toUpperCase();
    }

    const groupBadge = $('eq-badge-group');
    if (groupBadge) groupBadge.textContent = `Grupo: ${(dev.group_name || 'General').toUpperCase()}`;

    const compBadge = $('eq-badge-compliance');
    if (compBadge) {
      compBadge.textContent = `${dev.compliance_rate}% CUMPLIMIENTO`;
      compBadge.className = dev.compliance_rate >= 90 ? 'admit-badge-lg admit' : (dev.compliance_rate >= 60 ? 'admit-badge-lg' : 'admit-badge-lg rejected');
    }

    const isDemo = dev.is_demo === 1 || ['LNV-PF12A9B1', 'LNV-PF23B8C2', 'HP-5CD142980', 'HP-5CD932014'].includes(dev.id);
    const demoBadge = $('eq-badge-demo');
    if (demoBadge) demoBadge.style.display = isDemo ? 'inline-block' : 'none';

    // ── Telemetría de Hardware ──
    const cpuEl = $('eq-cpu');
    if (cpuEl) cpuEl.textContent = dev.cpu || 'No reportado';

    const ramEl = $('eq-ram');
    if (ramEl) ramEl.textContent = dev.ram || 'No reportado';

    const serialEl = $('eq-serial');
    if (serialEl) serialEl.textContent = dev.serial_number || dev.id || 'N/A';

    const mbEl = $('eq-motherboard');
    if (mbEl) mbEl.textContent = dev.motherboard || `${dev.oem ? dev.oem.toUpperCase() : ''} ${dev.model_id || ''}`;

    const osEl = $('eq-os');
    if (osEl) osEl.textContent = `${dev.os_edition || 'Windows'} — ${dev.os_build || ''}`;

    const biosEl = $('eq-bios');
    if (biosEl) biosEl.textContent = dev.bios_version || 'N/A';

    const macEl = $('eq-mac');
    if (macEl) macEl.textContent = dev.mac_address || 'No detectada';

    const ipEl = $('eq-ip');
    if (ipEl) ipEl.textContent = dev.ip_address || '127.0.0.1';

    const uuidEl = $('eq-uuid');
    if (uuidEl) uuidEl.textContent = dev.id || '—';

    const lastSeenEl = $('eq-last-seen');
    if (lastSeenEl) lastSeenEl.textContent = formatTimeAgo(dev.last_seen);

    // Botón de despliegue
    const pendingTotal = (dev.outdated_drivers || 0) + (dev.pending_drivers || 0);
    const deployBtn = $('eq-btn-deploy');
    if (deployBtn) {
      deployBtn.disabled = pendingTotal === 0;
      deployBtn.textContent = pendingTotal === 0 ? 'Equipo Totalmente al Día' : `Actualizar ${pendingTotal} Controladores Pendientes`;
    }

    // Actualizar pestañas y resumen de controladores
    const drivers = dev.drivers || [];
    const uptodate = drivers.filter(d => d.status === 'ACTUALIZADO').length;
    const pending = drivers.filter(d => d.status !== 'ACTUALIZADO').length;

    const tabAll = $('tab-drv-all');
    if (tabAll) tabAll.textContent = `Todos (${drivers.length})`;

    const tabPending = $('tab-drv-pending');
    if (tabPending) tabPending.textContent = `Pendientes (${pending})`;

    const tabUptodate = $('tab-drv-uptodate');
    if (tabUptodate) tabUptodate.textContent = `Al Día (${uptodate})`;

    const summaryEl = $('eq-drivers-summary');
    if (summaryEl) {
      summaryEl.textContent = `${drivers.length} controladores cotejados con el catálogo de ${dev.oem.toUpperCase()} (${uptodate} al día, ${pending} desactualizados o pendientes).`;
    }

    renderDriversList();
  } catch (err) {
    console.error('Error cargando equipo:', err);
    showToast('Error al cargar datos del equipo: ' + err.message, 'error');
  }
}

// ================================================================
// Renderizado y Filtro del Inventario de Controladores
// ================================================================

function setDriverFilter(type) {
  currentDriverFilter = type;
  const tabAll = $('tab-drv-all');
  const tabPending = $('tab-drv-pending');
  const tabUptodate = $('tab-drv-uptodate');

  if (tabAll) tabAll.className = type === 'all' ? 'export-btn selected' : 'export-btn';
  if (tabPending) tabPending.className = type === 'pending' ? 'export-btn selected' : 'export-btn';
  if (tabUptodate) tabUptodate.className = type === 'uptodate' ? 'export-btn selected' : 'export-btn';

  renderDriversList();
}

function filterDriversList() {
  renderDriversList();
}

function renderDriversList() {
  if (!currentDevice) return;
  const tbody = $('eq-drivers-tbody');
  if (!tbody) return;

  const query = ($('eq-driver-search')?.value || '').toLowerCase().trim();
  let drivers = currentDevice.drivers || [];

  if (currentDriverFilter === 'pending') {
    drivers = drivers.filter(d => d.status !== 'ACTUALIZADO');
  } else if (currentDriverFilter === 'uptodate') {
    drivers = drivers.filter(d => d.status === 'ACTUALIZADO');
  }

  if (query) {
    drivers = drivers.filter(d => {
      const matchName = (d.driver_name || '').toLowerCase().includes(query);
      const matchCat = (d.category || '').toLowerCase().includes(query);
      return matchName || matchCat;
    });
  }

  if (drivers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--text-muted);">No se encontraron controladores con los criterios de búsqueda aplicados.</td></tr>`;
    return;
  }

  tbody.innerHTML = drivers.map(d => {
    let statusBadge = '';
    if (d.status === 'ACTUALIZADO') {
      statusBadge = `<span class="status-pill compliant">Actualizado</span>`;
    } else if (d.status === 'DESACTUALIZADO') {
      statusBadge = `<span class="status-pill outdated">Desactualizado</span>`;
    } else {
      statusBadge = `<span class="status-pill critical">Pendiente</span>`;
    }

    const sevClass = String(d.severity || '').toLowerCase().includes('cr') ? 'critical' : (String(d.severity || '').toLowerCase().includes('op') ? 'optional' : 'recommended');
    const isAdmitted = d.is_admitted ? '<span class="status-pill compliant" style="font-size:10px;">Admitido WU</span>' : '<span class="status-pill outdated" style="font-size:10px;">Catálogo OEM</span>';

    return `
      <tr>
        <td>
          <div style="font-weight:600; color:var(--text-primary); font-size:13px;">${escapeHtml(d.driver_name)}</div>
          ${d.download_url ? `<a href="${escapeHtml(d.download_url)}" target="_blank" rel="noopener noreferrer" style="font-size:11px; color:var(--accent-cyan); text-decoration:none; margin-top:2px; display:inline-block;">Descarga Oficial (${escapeHtml(d.file_size || '—')}) &nearr;</a>` : ''}
        </td>
        <td><span class="category-badge" style="font-size:10px; padding:2px 6px;">${escapeHtml(d.category || 'General')}</span></td>
        <td class="font-mono" style="font-size:12px; color:var(--text-secondary);">${escapeHtml(d.installed_version || 'No detectada')}</td>
        <td class="font-mono" style="font-size:12px; color:var(--accent-cyan); font-weight:600;">${escapeHtml(d.target_version || '—')}</td>
        <td>${statusBadge}</td>
        <td><span class="severity-badge ${sevClass}" style="font-size:10px; padding:2px 6px;">${escapeHtml(d.severity || 'Recomendado')}</span></td>
        <td>${isAdmitted}</td>
      </tr>
    `;
  }).join('');
}

// ================================================================
// Acciones del Equipo
// ================================================================

async function triggerCurrentDeviceDeploy() {
  if (!currentDevice) return;
  try {
    const res = await fetch(`/api/fleet/devices/${encodeURIComponent(currentDevice.id)}/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al lanzar despliegue');
    showToast(`Orden de actualización enviada (${data.driversCount} parches). Se aplicará en el próximo check-in.`, 'success', 5000);
  } catch (err) {
    showToast('Error al enviar actualización: ' + err.message, 'error');
  }
}

async function confirmDeleteCurrentDevice() {
  if (!currentDevice) return;
  const ok = confirm(`¿Estás seguro de eliminar el equipo "${currentDevice.hostname}" de la flota? Esta acción es permanente.`);
  if (!ok) return;

  try {
    const res = await fetch(`/api/fleet/devices/${encodeURIComponent(currentDevice.id)}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al eliminar');
    showToast('Equipo eliminado exitosamente', 'success');
    setTimeout(() => { window.location.href = '/flota'; }, 1000);
  } catch (err) {
    showToast('Error al eliminar equipo: ' + err.message, 'error');
  }
}

window.setDriverFilter = setDriverFilter;
window.filterDriversList = filterDriversList;
window.triggerCurrentDeviceDeploy = triggerCurrentDeviceDeploy;
window.confirmDeleteCurrentDevice = confirmDeleteCurrentDevice;

document.addEventListener('DOMContentLoaded', () => {
  loadDeviceData();

  // Enlazar listeners programáticos para máxima compatibilidad con cualquier política de seguridad CSP
  const btnDeploy = $('eq-btn-deploy');
  if (btnDeploy) btnDeploy.addEventListener('click', triggerCurrentDeviceDeploy);

  const btnDelete = $('eq-btn-delete');
  if (btnDelete) btnDelete.addEventListener('click', confirmDeleteCurrentDevice);

  const tabAll = $('tab-drv-all');
  if (tabAll) tabAll.addEventListener('click', () => setDriverFilter('all'));

  const tabPending = $('tab-drv-pending');
  if (tabPending) tabPending.addEventListener('click', () => setDriverFilter('pending'));

  const tabUptodate = $('tab-drv-uptodate');
  if (tabUptodate) tabUptodate.addEventListener('click', () => setDriverFilter('uptodate'));

  const searchInput = $('eq-driver-search');
  if (searchInput) searchInput.addEventListener('input', filterDriversList);
});
