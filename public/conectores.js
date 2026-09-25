/**
 * conectores.js
 * Lógica dedicada para la vista de Estado y Monitoreo de APIs/Conectores oficiales.
 */

'use strict';

const $ = (id) => document.getElementById(id);

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

function formatLatency(ms) {
  if (ms === null || ms === undefined || ms < 0) return '—';
  return `${ms} ms`;
}

function getLatencyClass(ms) {
  if (ms < 400) return 'text-green';
  if (ms < 1000) return 'text-yellow';
  return 'text-red';
}

async function loadConnectorsStatus(isManual = false) {
  const refreshBtn = $('btn-refresh-all-connectors');
  if (refreshBtn && isManual) {
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Comprobando...';
  }

  try {
    const res = await fetch('/api/connectors/status');
    if (!res.ok) throw new Error('No se pudo obtener el estado de los conectores');

    const data = await res.json();
    const { summary, connectors } = data;

    // Actualizar KPIs
    const totalEl = $('stat-total-connectors');
    if (totalEl) totalEl.textContent = summary.total;

    const globalStatusEl = $('stat-global-status');
    const onlineRatioEl = $('stat-online-ratio');
    if (globalStatusEl) {
      if (summary.allOperational) {
        globalStatusEl.textContent = '100% OPERATIVO';
        globalStatusEl.className = 'fleet-stat-value font-mono text-green';
      } else if (summary.online > 0) {
        globalStatusEl.textContent = 'DEGRADADO';
        globalStatusEl.className = 'fleet-stat-value font-mono text-yellow';
      } else {
        globalStatusEl.textContent = 'OFFLINE';
        globalStatusEl.className = 'fleet-stat-value font-mono text-red';
      }
    }
    if (onlineRatioEl) {
      onlineRatioEl.textContent = `${summary.online} de ${summary.total} servicios activos`;
    }

    // Calcular latencia promedio
    const onlineConnectors = connectors.filter(c => c.status === 'online' && c.latencyMs > 0);
    const avgLatency = onlineConnectors.length > 0
      ? Math.round(onlineConnectors.reduce((acc, c) => acc + c.latencyMs, 0) / onlineConnectors.length)
      : 0;

    const avgLatencyEl = $('stat-avg-latency');
    if (avgLatencyEl) {
      avgLatencyEl.textContent = `${avgLatency} ms`;
      avgLatencyEl.className = `fleet-stat-value font-mono ${getLatencyClass(avgLatency)}`;
    }

    const lastCheckEl = $('stat-last-check');
    if (lastCheckEl) {
      const d = new Date(summary.timestamp);
      lastCheckEl.textContent = d.toLocaleTimeString();
    }

    const tsHeader = $('header-timestamp-label');
    if (tsHeader) {
      tsHeader.textContent = `Actualizado ${new Date().toLocaleTimeString()}`;
    }

    // Renderizar tarjetas de conectores
    renderConnectorsGrid(connectors);

    if (isManual) {
      showToast('Conectividad con APIs verificada correctamente', 'success');
    }
  } catch (err) {
    console.error('Error al cargar estado de conectores:', err);
    showToast('Error al conectar con el servidor: ' + err.message, 'error');
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.textContent = 'Comprobar Todos los Conectores';
    }
  }
}

function renderConnectorsGrid(connectors) {
  const container = $('connectors-cards-grid');
  if (!container) return;

  container.innerHTML = connectors.map(c => {
    const isOnline = c.status === 'online';
    const statusClass = isOnline ? 'compliant' : (c.status === 'degraded' ? 'outdated' : 'critical');
    const statusText = isOnline ? 'ONLINE' : (c.status === 'degraded' ? 'DEGRADADO' : 'OFFLINE');
    const borderStyle = isOnline ? 'border-color: rgba(52, 211, 153, 0.3);' : 'border-color: rgba(239, 68, 68, 0.4);';

    let oemBadgeClass = 'ms';
    if (c.id === 'lenovo') oemBadgeClass = 'lenovo';
    else if (c.id === 'hp') oemBadgeClass = 'hp';
    else if (c.id === 'fleet_core') oemBadgeClass = 'audit';

    return `
      <div style="background:var(--bg-card); border:1px solid var(--border-subtle); ${borderStyle} border-radius:var(--radius-lg); padding:24px; box-shadow:var(--shadow-card); display:flex; flex-direction:column; justify-content:space-between;">
        
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; gap:12px; flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="tab-btn-pill ${oemBadgeClass}" style="font-size:10px; padding:2px 8px;">
                ${c.id.toUpperCase()}
              </span>
              <span style="font-size:12px; color:var(--text-muted); font-weight:500;">
                ${escapeHtml(c.provider)}
              </span>
            </div>

            <div style="display:flex; align-items:center; gap:8px;">
              <span class="status-pill ${statusClass}" style="font-size:11px; padding:3px 10px;">
                <span style="width:6px; height:6px; border-radius:50%; background:currentColor; display:inline-block;"></span>
                ${statusText} ${c.statusCode ? `(${c.statusCode})` : ''}
              </span>
            </div>
          </div>

          <h2 style="font-size:18px; font-weight:700; color:var(--text-primary); margin-bottom:6px;">
            ${escapeHtml(c.name)}
          </h2>

          <p style="font-size:13px; color:var(--text-secondary); line-height:1.55; margin-bottom:16px;">
            ${escapeHtml(c.description)}
          </p>

          <!-- Detalles Técnicos y Endpoint Oficial -->
          <div style="background:var(--bg-input); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:12px 14px; margin-bottom:18px; font-family:var(--font-mono); font-size:12px;">
            <div style="color:var(--text-muted); font-size:10px; text-transform:uppercase; margin-bottom:4px; letter-spacing:0.05em;">
              Dirección / Endpoint Oficial:
            </div>
            <div style="word-break:break-all;">
              <a href="${escapeHtml(c.endpoint)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-cyan); text-decoration:none;" title="Abrir endpoint en navegador">
                ${escapeHtml(c.endpoint)} &nearr;
              </a>
            </div>
          </div>
        </div>

        <div>
          <!-- Métricas del Conector -->
          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.06); padding-top:14px; margin-top:8px; font-size:12px; flex-wrap:wrap; gap:8px;">
            <div>
              <span style="color:var(--text-muted);">Protocolo:</span>
              <span style="color:var(--text-primary); font-weight:600; margin-left:4px;">${escapeHtml(c.protocol)}</span>
            </div>

            <div style="display:flex; align-items:center; gap:6px;">
              <span style="color:var(--text-muted);">Latencia:</span>
              <span class="font-mono font-bold ${getLatencyClass(c.latencyMs)}">
                ${formatLatency(c.latencyMs)}
              </span>
            </div>
          </div>
        </div>

      </div>
    `;
  }).join('');
}

window.loadConnectorsStatus = loadConnectorsStatus;

document.addEventListener('DOMContentLoaded', () => {
  loadConnectorsStatus(false);

  const refreshBtn = $('btn-refresh-all-connectors');
  if (refreshBtn) refreshBtn.addEventListener('click', () => loadConnectorsStatus(true));
});
