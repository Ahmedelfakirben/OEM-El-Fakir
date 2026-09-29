/**
 * audit.js — Módulo ESM
 * Lógica de la vista de Logs de Auditoría
 */

import { apiFetch, escapeHtml } from './conectores.js';

const PAGE_SIZE = 50;
let currentOffset = 0;

// Elementos del DOM
const tbody = document.getElementById('audit-logs-tbody');
const template = document.getElementById('audit-row-template');
const loadingIndicator = document.getElementById('loading-indicator');
const emptyState = document.getElementById('empty-state');

const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnFilter = document.getElementById('btn-filter');
const btnReset = document.getElementById('btn-reset');

const inputAdmin = document.getElementById('filter-admin');
const inputDateStart = document.getElementById('filter-date-start');
const inputDateEnd = document.getElementById('filter-date-end');

let currentAbortController = null;

// Formateador de fechas nativo
const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false
});

/**
 * Carga los logs desde el backend aplicando los filtros actuales.
 */
async function loadLogs() {
  // Cancelar petición anterior si existe (Vanilla DOM Batching)
  if (currentAbortController) {
    currentAbortController.abort();
  }
  currentAbortController = new AbortController();

  tbody.innerHTML = '';
  loadingIndicator.style.display = 'block';
  emptyState.style.display = 'none';

  // Construir parámetros
  const params = new URLSearchParams();
  params.append('limit', PAGE_SIZE);
  params.append('offset', currentOffset);
  
  if (inputAdmin.value.trim()) params.append('adminUser', inputAdmin.value.trim());
  if (inputDateStart.value) {
    // Asegurarse de formato ISO al inicio del día
    params.append('startDate', new Date(inputDateStart.value + 'T00:00:00Z').toISOString());
  }
  if (inputDateEnd.value) {
    // Asegurarse de formato ISO al final del día
    params.append('endDate', new Date(inputDateEnd.value + 'T23:59:59.999Z').toISOString());
  }

  try {
    const res = await apiFetch(`/api/audit-logs?${params.toString()}`, { method: 'GET' }, currentAbortController.signal);
    if (!res) return; // Abortado

    const data = await res.json();
    loadingIndicator.style.display = 'none';

    if (!data.logs || data.logs.length === 0) {
      if (currentOffset === 0) {
        emptyState.style.display = 'block';
      }
      // Desactivar "Siguiente" si ya no hay más
      btnNext.disabled = true;
      return;
    }

    // Renderizar con DocumentFragment
    const fragment = document.createDocumentFragment();

    data.logs.forEach(log => {
      const clone = template.content.cloneNode(true);
      
      const colTime = clone.querySelector('.col-time');
      const colAdmin = clone.querySelector('.col-admin');
      const actionPill = clone.querySelector('.action-pill');
      const colTarget = clone.querySelector('.col-target');
      const colIp = clone.querySelector('.col-ip');

      try {
        colTime.textContent = dateFormatter.format(new Date(log.timestamp));
      } catch (e) {
        colTime.textContent = log.timestamp;
      }
      
      colAdmin.textContent = log.admin_user;
      actionPill.textContent = log.action;
      colTarget.textContent = log.target;
      colIp.textContent = log.ip;

      // Color de la acción
      if (log.action === 'DEPLOY') {
        actionPill.style.background = 'rgba(239, 68, 68, 0.1)'; // Rojo tenue
        actionPill.style.color = '#ef4444';
      } else if (log.action === 'GROUP_CHANGE') {
        actionPill.style.background = 'rgba(245, 158, 11, 0.1)'; // Naranja tenue
        actionPill.style.color = '#f59e0b';
      }

      fragment.appendChild(clone);
    });

    tbody.replaceChildren(fragment);
    
    // Control de botones de paginación
    btnPrev.disabled = currentOffset === 0;
    btnNext.disabled = data.logs.length < PAGE_SIZE;

  } catch (err) {
    if (err.name === 'AbortError') return;
    console.error('Error cargando logs:', err);
    loadingIndicator.style.display = 'none';
    emptyState.style.display = 'block';
    emptyState.textContent = 'Error al cargar los logs: ' + err.message;
  }
}

// Event Listeners
btnFilter.addEventListener('click', () => {
  currentOffset = 0;
  loadLogs();
});

btnReset.addEventListener('click', () => {
  inputAdmin.value = '';
  inputDateStart.value = '';
  inputDateEnd.value = '';
  currentOffset = 0;
  loadLogs();
});

btnNext.addEventListener('click', () => {
  currentOffset += PAGE_SIZE;
  loadLogs();
});

btnPrev.addEventListener('click', () => {
  currentOffset = Math.max(0, currentOffset - PAGE_SIZE);
  loadLogs();
});

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
  loadLogs();
});
