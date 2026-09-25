/**
 * app.js
 * OEM Driver Explorer — Lógica del frontend SPA
 * Sin emojis, autocompletado en vivo, selector de flota con búsqueda inmediata,
 * validación de admisión en Microsoft Windows Update (WHQL) y nombres de catálogo canónicos.
 */

'use strict';

// ================================================================
// Base de datos de modelos de flota corporativa para autocompletado
// ================================================================

const FLEET_DATABASE = [
  // ── HP ProBook 440 ─────────────────────────────────────────────
  { brand: 'HP', oem: 'hp', name: 'HP ProBook 440 G5', id: '837E', series: 'ProBook 440' },
  { brand: 'HP', oem: 'hp', name: 'HP ProBook 440 G6', id: '8532', series: 'ProBook 440' },
  { brand: 'HP', oem: 'hp', name: 'HP ProBook 440 G7', id: '8723', series: 'ProBook 440' },
  { brand: 'HP', oem: 'hp', name: 'HP ProBook 440 G8', id: '888A', series: 'ProBook 440' },
  { brand: 'HP', oem: 'hp', name: 'HP ProBook 440 G8 (Placa Alt.)', id: '888B', series: 'ProBook 440' },
  { brand: 'HP', oem: 'hp', name: 'HP ProBook 440 G9', id: '8A4E', series: 'ProBook 440' },
  { brand: 'HP', oem: 'hp', name: 'HP ProBook 440 G9 (Placa Alt.)', id: '8A4F', series: 'ProBook 440' },
  { brand: 'HP', oem: 'hp', name: 'HP ProBook 440 G10', id: '8B58', series: 'ProBook 440' },
  { brand: 'HP', oem: 'hp', name: 'HP ProBook 440 G10 (Placa Alt.)', id: '8B59', series: 'ProBook 440' },
  { brand: 'HP', oem: 'hp', name: 'HP ProBook 440 G11', id: '8C24', series: 'ProBook 440' },
  { brand: 'HP', oem: 'hp', name: 'HP ProBook 440 G11 (Placa Alt.)', id: '8C25', series: 'ProBook 440' },

  // ── HP EliteBook 840 ───────────────────────────────────────────
  { brand: 'HP', oem: 'hp', name: 'HP EliteBook 840 G5', id: '83B2', series: 'EliteBook 840' },
  { brand: 'HP', oem: 'hp', name: 'HP EliteBook 840 G6', id: '8549', series: 'EliteBook 840' },
  { brand: 'HP', oem: 'hp', name: 'HP EliteBook 840 G7', id: '880D', series: 'EliteBook 840' },
  { brand: 'HP', oem: 'hp', name: 'HP EliteBook 840 G7 (Placa Alt.)', id: '8724', series: 'EliteBook 840' },
  { brand: 'HP', oem: 'hp', name: 'HP EliteBook 840 G8', id: '8936', series: 'EliteBook 840' },
  { brand: 'HP', oem: 'hp', name: 'HP EliteBook 840 G8 (Placa Alt.)', id: '880E', series: 'EliteBook 840' },
  { brand: 'HP', oem: 'hp', name: 'HP EliteBook 840 G9', id: '8AB2', series: 'EliteBook 840' },
  { brand: 'HP', oem: 'hp', name: 'HP EliteBook 840 G9 (Placa Alt.)', id: '8A3B', series: 'EliteBook 840' },
  { brand: 'HP', oem: 'hp', name: 'HP EliteBook 840 G9 (Sub-board)', id: '8A3C', series: 'EliteBook 840' },
  { brand: 'HP', oem: 'hp', name: 'HP EliteBook 840 G10', id: '8B28', series: 'EliteBook 840' },
  { brand: 'HP', oem: 'hp', name: 'HP EliteBook 840 G10 (Placa Alt.)', id: '8B44', series: 'EliteBook 840' },
  { brand: 'HP', oem: 'hp', name: 'HP EliteBook 840 G10 (Sub-board)', id: '8B45', series: 'EliteBook 840' },
  { brand: 'HP', oem: 'hp', name: 'HP EliteBook 840 G11', id: '8C1E', series: 'EliteBook 840' },
  { brand: 'HP', oem: 'hp', name: 'HP EliteBook 840 G11 (Placa Alt.)', id: '8C1F', series: 'EliteBook 840' },

  // Otros HP
  { brand: 'HP', oem: 'hp', name: 'HP EliteBook 850 G7', id: '8800', series: 'EliteBook 850' },
  { brand: 'HP', oem: 'hp', name: 'HP EliteDesk 800 G6 Desktop Mini', id: '8717', series: 'EliteDesk' },

  // ── Lenovo ThinkPad T460 ───────────────────────────────────────
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad T460 (20FM)', id: '20FM', series: 'ThinkPad T' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad T460 (20FN)', id: '20FN', series: 'ThinkPad T' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad T460s (20F9)', id: '20F9', series: 'ThinkPad T' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad T460s (20FA)', id: '20FA', series: 'ThinkPad T' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad T460p (20FW)', id: '20FW', series: 'ThinkPad T' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad T460p (20FX)', id: '20FX', series: 'ThinkPad T' },

  // ── Lenovo ThinkPad T480 ───────────────────────────────────────
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad T480 (20L5)', id: '20L5', series: 'ThinkPad T' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad T480 (20L6)', id: '20L6', series: 'ThinkPad T' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad T480s (20L7)', id: '20L7', series: 'ThinkPad T' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad T480s (20L8)', id: '20L8', series: 'ThinkPad T' },

  // ── Lenovo ThinkPad T490 ───────────────────────────────────────
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad T490 (20N2)', id: '20N2', series: 'ThinkPad T' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad T490 (20N3)', id: '20N3', series: 'ThinkPad T' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad T490 (20RY)', id: '20RY', series: 'ThinkPad T' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad T490 (20RX)', id: '20RX', series: 'ThinkPad T' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad T490 Healthcare Edition (20Q9)', id: '20Q9', series: 'ThinkPad T' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad T490 Healthcare Edition (20QH)', id: '20QH', series: 'ThinkPad T' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad T490s (20NX)', id: '20NX', series: 'ThinkPad T' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad T490s (20NY)', id: '20NY', series: 'ThinkPad T' },

  // ── Lenovo ThinkPad P15 ────────────────────────────────────────
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad P15 Gen 1 (20ST)', id: '20ST', series: 'ThinkPad P15' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad P15 Gen 1 (20SU)', id: '20SU', series: 'ThinkPad P15' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad P15v Gen 1 Intel (20TQ)', id: '20TQ', series: 'ThinkPad P15' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad P15v Gen 1 Intel (20TR)', id: '20TR', series: 'ThinkPad P15' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad P15s Gen 1 (20T4)', id: '20T4', series: 'ThinkPad P15' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad P15s Gen 1 (20T5)', id: '20T5', series: 'ThinkPad P15' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad P15 Gen 2 (20YQ)', id: '20YQ', series: 'ThinkPad P15' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad P15 Gen 2 (20YR)', id: '20YR', series: 'ThinkPad P15' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad P15v Gen 2 (21A9)', id: '21A9', series: 'ThinkPad P15' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad P15v Gen 2 (21AA)', id: '21AA', series: 'ThinkPad P15' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad P15s Gen 2 (20W6)', id: '20W6', series: 'ThinkPad P15' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad P15s Gen 2 (20W7)', id: '20W7', series: 'ThinkPad P15' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad P15v Gen 3 Intel (21D8)', id: '21D8', series: 'ThinkPad P15' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad P15v Gen 3 Intel (21D9)', id: '21D9', series: 'ThinkPad P15' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad P15v Gen 3 AMD (21EM)', id: '21EM', series: 'ThinkPad P15' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad P15v Gen 3 AMD (21EN)', id: '21EN', series: 'ThinkPad P15' },

  // ── Lenovo ThinkPad L14 ────────────────────────────────────────
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad L14 Gen 1 Intel (20U1)', id: '20U1', series: 'ThinkPad L14' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad L14 Gen 1 Intel (20U2)', id: '20U2', series: 'ThinkPad L14' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad L14 Gen 1 AMD (20U5)', id: '20U5', series: 'ThinkPad L14' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad L14 Gen 1 AMD (20U6)', id: '20U6', series: 'ThinkPad L14' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad L14 Gen 2 Intel (20X1)', id: '20X1', series: 'ThinkPad L14' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad L14 Gen 2 Intel (20X2)', id: '20X2', series: 'ThinkPad L14' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad L14 Gen 2 AMD (20X5)', id: '20X5', series: 'ThinkPad L14' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad L14 Gen 2 AMD (20X6)', id: '20X6', series: 'ThinkPad L14' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad L14 Gen 3 Intel (21C1)', id: '21C1', series: 'ThinkPad L14' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad L14 Gen 3 Intel (21C2)', id: '21C2', series: 'ThinkPad L14' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad L14 Gen 3 AMD (21C5)', id: '21C5', series: 'ThinkPad L14' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad L14 Gen 3 AMD (21C6)', id: '21C6', series: 'ThinkPad L14' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad L14 Gen 4 Intel (21H1)', id: '21H1', series: 'ThinkPad L14' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad L14 Gen 4 Intel (21H2)', id: '21H2', series: 'ThinkPad L14' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad L14 Gen 4 AMD (21H5)', id: '21H5', series: 'ThinkPad L14' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad L14 Gen 4 AMD (21H6)', id: '21H6', series: 'ThinkPad L14' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad L14 Gen 5 Intel (21L1)', id: '21L1', series: 'ThinkPad L14' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad L14 Gen 5 Intel (21L2)', id: '21L2', series: 'ThinkPad L14' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad L14 Gen 5 AMD (21L5)', id: '21L5', series: 'ThinkPad L14' },
  { brand: 'Lenovo', oem: 'lenovo', name: 'ThinkPad L14 Gen 5 AMD (21L6)', id: '21L6', series: 'ThinkPad L14' },
];

const FLEET_MODELS_MAP = Object.fromEntries(FLEET_DATABASE.map(item => [item.id.toUpperCase(), item]));

// ================================================================
// Estado global de la aplicación
// ================================================================

const state = {
  currentOEM: 'lenovo',
  currentId: '',
  currentModelName: '',
  allDrivers: [],
  filteredDrivers: [],
  lastMeta: null,
  loading: false,
  highlightedIndex: -1,
};

// ================================================================
// Chips de acceso rápido y pistas
// ================================================================

const EXAMPLE_CHIPS = {
  lenovo: [
    { id: '20L5', label: 'ThinkPad T480' },
    { id: '20N2', label: 'ThinkPad T490' },
    { id: '20U1', label: 'ThinkPad L14 G1' },
    { id: '20X1', label: 'ThinkPad L14 G2' },
    { id: '20ST', label: 'ThinkPad P15 G1' },
    { id: '20FM', label: 'ThinkPad T460' },
  ],
  hp: [
    { id: '8723', label: 'ProBook 440 G7' },
    { id: '888A', label: 'ProBook 440 G8' },
    { id: '8A4E', label: 'ProBook 440 G9' },
    { id: '880D', label: 'EliteBook 840 G7' },
    { id: '8936', label: 'EliteBook 840 G8' },
    { id: '8C1E', label: 'EliteBook 840 G11' },
  ],
};

const PS_HINTS = {
  lenovo: {
    label: 'Obtener machineType cliente:',
    cmd:   '(Get-CimInstance Win32_ComputerSystem).Model.Substring(0,4)',
  },
  hp: {
    label: 'Obtener System Board ID cliente:',
    cmd:   '(Get-CimInstance Win32_BaseBoard).Product',
  },
};

// ================================================================
// Helpers de UI
// ================================================================

function $(id) { return document.getElementById(id); }

function showToast(message, type = 'info', durationMs = 3500) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.className = 'toast';
  }, durationMs);
}

function showState(s) {
  const states = ['idle', 'loading', 'error', 'empty'];
  states.forEach(id => {
    const el = $(`state-${id}`);
    if (el) el.style.display = (id === s) ? '' : 'none';
  });
  const table = $('drivers-table');
  if (table) table.style.display = (s === 'results') ? '' : 'none';
}

function showFiltersAndHeader(visible) {
  const fb = $('filters-bar');
  const rh = $('results-header');
  const ss = $('stats-strip');
  if (fb) fb.style.display = ''; // Siempre visible para pre-filtrar o post-filtrar
  if (rh) rh.style.display = visible ? '' : 'none';
  if (ss) ss.style.display = visible ? '' : 'none';
}

// ================================================================
// Selección de OEM (Tabs)
// ================================================================

function selectOEM(oem) {
  state.currentOEM = oem;
  const oemTitle = oem === 'hp' ? 'HP' : 'Lenovo';

  // Actualiza botones de pestaña
  const tabLenovo = $('tab-lenovo');
  const tabHp = $('tab-hp');
  if (tabLenovo) {
    tabLenovo.classList.toggle('active', oem === 'lenovo');
    tabLenovo.setAttribute('aria-selected', oem === 'lenovo' ? 'true' : 'false');
  }
  if (tabHp) {
    tabHp.classList.toggle('active', oem === 'hp');
    tabHp.setAttribute('aria-selected', oem === 'hp' ? 'true' : 'false');
  }

  // Actualiza dinámicamente el texto de la opción de filtro para el fabricante activo
  const optOemOnly = $('opt-filter-oem-only');
  if (optOemOnly) {
    optOemOnly.textContent = `Solo Soporte ${oemTitle} (No en Windows Update)`;
  }

  // Actualiza dinámicamente la etiqueta de la tarjeta de métricas
  const statOemLabel = $('stat-oem-label');
  if (statOemLabel) {
    statOemLabel.textContent = `Solo Soporte ${oemTitle}`;
  }

  // Placeholder
  const searchInput = $('search-id-input');
  if (searchInput) {
    searchInput.placeholder = oem === 'lenovo'
      ? 'Escribe modelo o código (ej. T480, 20L5, L14, P15)...'
      : 'Escribe modelo o código (ej. 440 G8, 888A, 840 G7, 880D)...';
  }

  // Pistas de comando PowerShell
  const hint = PS_HINTS[oem];
  if (hint) {
    if ($('ps-hint-label')) $('ps-hint-label').textContent = hint.label;
    if ($('ps-hint-cmd'))   $('ps-hint-cmd').textContent   = hint.cmd;
    if ($('idle-ps-hint'))  $('idle-ps-hint').textContent  = hint.cmd;
  }

  renderChips(oem);

  const searchBtn = $('search-btn');
  if (searchBtn) searchBtn.disabled = false;
}

window.selectOEM = selectOEM;

// ================================================================
// Manejo del selector de flota (Búsqueda instantánea)
// ================================================================

function handleFleetSelection(val) {
  if (!val) return;
  const parts = val.split(':');
  if (parts.length < 2) return;

  const oem = parts[0].toLowerCase();
  const id  = parts[1].trim().toUpperCase();

  // 1. Conmuta pestaña del fabricante
  selectOEM(oem);

  // 2. Inserta el ID en la barra de texto
  const input = $('search-id-input');
  if (input) input.value = id;

  // 3. Resuelve nombre de flota
  const meta = FLEET_MODELS_MAP[id];
  state.currentModelName = meta ? meta.name : id;
  state.currentId = id;

  closeAutocomplete();

  const btn = $('search-btn');
  if (btn) btn.disabled = false;

  // 4. Lanza la consulta inmediatamente
  fetchDrivers(oem, id);
}

function clearFleetSelection() {
  const sel = $('fleet-model-select');
  if (sel) sel.value = '';
  const input = $('search-id-input');
  if (input) {
    input.value = '';
    input.focus();
  }
  const btn = $('search-btn');
  if (btn) btn.disabled = false;
  closeAutocomplete();
}

window.handleFleetSelection = handleFleetSelection;
window.clearFleetSelection  = clearFleetSelection;

// ================================================================
// Chips rápidos
// ================================================================

function renderChips(oem) {
  const container = $('chips-container');
  if (!container) return;
  const chips = EXAMPLE_CHIPS[oem] || [];

  container.innerHTML = '<span class="chips-title">Accesos rápidos:</span>';

  chips.forEach(({ id, label }) => {
    const btn = document.createElement('button');
    btn.className = 'chip-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', `Buscar ${label} (${id})`);
    btn.innerHTML = `<span class="chip-btn-code">${id}</span><span>${label}</span>`;
    btn.addEventListener('click', () => {
      const input = $('search-id-input');
      if (input) input.value = id;

      const sel = $('fleet-model-select');
      if (sel) sel.value = `${oem}:${id}`;

      const meta = FLEET_MODELS_MAP[id];
      state.currentModelName = meta ? meta.name : label;
      state.currentId = id;

      closeAutocomplete();
      fetchDrivers(oem, id);
    });
    container.appendChild(btn);
  });
}

// ================================================================
// Autocompletado interactivo en vivo mientras se escribe
// ================================================================

function handleSearchInput(event) {
  const query = (event.target.value || '').trim().toLowerCase();

  const btn = $('search-btn');
  if (btn) btn.disabled = false;

  if (!query) {
    closeAutocomplete();
    return;
  }

  // Filtrar sugerencias de flota
  const matched = FLEET_DATABASE.filter(item => {
    const idMatch = item.id.toLowerCase().includes(query);
    const nameMatch = item.name.toLowerCase().includes(query);
    const seriesMatch = item.series.toLowerCase().includes(query);
    return idMatch || nameMatch || seriesMatch;
  }).slice(0, 8);

  if (matched.length === 0) {
    closeAutocomplete();
    return;
  }

  renderAutocomplete(matched, query);
}

function handleSearchFocus() {
  const input = $('search-id-input');
  if (input && input.value.trim().length > 0) {
    handleSearchInput({ target: input });
  }
}

function renderAutocomplete(items, query) {
  const dropdown = $('autocomplete-dropdown');
  if (!dropdown) return;

  state.highlightedIndex = -1;
  dropdown.innerHTML = '';

  items.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'autocomplete-item';
    div.dataset.index = idx;
    div.setAttribute('role', 'option');

    div.innerHTML = `
      <span class="ac-badge ${item.oem}">${item.brand.toUpperCase()}</span>
      <span class="ac-name">${highlightMatch(item.name, query)}</span>
      <span class="ac-id">${highlightMatch(item.id, query)}</span>
    `;

    div.addEventListener('click', () => {
      selectSuggestion(item);
    });

    dropdown.appendChild(div);
  });

  dropdown.style.display = 'block';
}

function highlightMatch(text, query) {
  if (!query) return escapeHtml(text);
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return escapeHtml(text).replace(regex, '<strong class="ac-highlight">$1</strong>');
}

function selectSuggestion(item) {
  selectOEM(item.oem);

  const input = $('search-id-input');
  if (input) input.value = item.id;
  state.currentModelName = item.name;
  state.currentId = item.id;

  const sel = $('fleet-model-select');
  if (sel) sel.value = `${item.oem}:${item.id}`;

  closeAutocomplete();
  fetchDrivers(item.oem, item.id);
}

function closeAutocomplete() {
  const dropdown = $('autocomplete-dropdown');
  if (dropdown) dropdown.style.display = 'none';
  state.highlightedIndex = -1;
}

document.addEventListener('click', (e) => {
  const wrap = e.target.closest('.search-field-box');
  if (!wrap) {
    closeAutocomplete();
  }
});

// ================================================================
// Navegación por teclado en el buscador
// ================================================================

function handleSearchKeydown(event) {
  const dropdown = $('autocomplete-dropdown');
  const isOpen = dropdown && dropdown.style.display !== 'none';
  const items = isOpen ? dropdown.querySelectorAll('.autocomplete-item') : [];

  if (event.key === 'ArrowDown' && isOpen && items.length > 0) {
    event.preventDefault();
    state.highlightedIndex = Math.min(state.highlightedIndex + 1, items.length - 1);
    updateHighlight(items);
    return;
  }

  if (event.key === 'ArrowUp' && isOpen && items.length > 0) {
    event.preventDefault();
    state.highlightedIndex = Math.max(state.highlightedIndex - 1, 0);
    updateHighlight(items);
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    if (isOpen && state.highlightedIndex >= 0 && items[state.highlightedIndex]) {
      items[state.highlightedIndex].click();
      return;
    }
    closeAutocomplete();
    triggerSearch();
    return;
  }

  if (event.key === 'Escape') {
    closeAutocomplete();
  }
}

function updateHighlight(items) {
  items.forEach((el, i) => {
    el.classList.toggle('active', i === state.highlightedIndex);
    if (i === state.highlightedIndex) {
      el.scrollIntoView({ block: 'nearest' });
    }
  });
}

window.handleSearchKeydown = handleSearchKeydown;
window.handleSearchInput   = handleSearchInput;
window.handleSearchFocus   = handleSearchFocus;

// ================================================================
// Búsqueda inteligente y ejecución
// ================================================================

async function triggerSearch() {
  const input = $('search-id-input');
  if (!input) return;

  const raw = input.value.trim();
  if (!raw) {
    showToast('Por favor, escribe un modelo o código a buscar (ej. T480, 888A, 20L5)', 'info');
    input.focus();
    return;
  }

  if (state.loading) return;

  closeAutocomplete();
  const cleanRaw = raw.toUpperCase();

  // 1. Coincidencia exacta con ID conocido
  if (FLEET_MODELS_MAP[cleanRaw]) {
    const meta = FLEET_MODELS_MAP[cleanRaw];
    state.currentModelName = meta.name;
    state.currentId = meta.id;
    if (state.currentOEM !== meta.oem) {
      selectOEM(meta.oem);
    }
    const sel = $('fleet-model-select');
    if (sel) sel.value = `${meta.oem}:${meta.id}`;
    await fetchDrivers(meta.oem, meta.id);
    return;
  }

  // 2. Coincidencia por nombre o serie
  const matched = FLEET_DATABASE.find(item => {
    const query = raw.toLowerCase();
    const name = item.name.toLowerCase();
    const series = item.series.toLowerCase();
    return name === query || name.includes(query) || series === query || series.includes(query);
  });

  if (matched) {
    state.currentModelName = matched.name;
    state.currentId = matched.id;
    input.value = matched.id;
    if (state.currentOEM !== matched.oem) {
      selectOEM(matched.oem);
    }
    const sel = $('fleet-model-select');
    if (sel) sel.value = `${matched.oem}:${matched.id}`;
    await fetchDrivers(matched.oem, matched.id);
    return;
  }

  // 3. Código personalizado ingresado a mano
  let targetId = raw.trim();
  let targetOem = state.currentOEM;

  if (/^hp\s+/i.test(targetId)) {
    targetOem = 'hp';
    targetId = targetId.replace(/^hp\s+/i, '').trim();
    selectOEM('hp');
  } else if (/^lenovo\s+/i.test(targetId)) {
    targetOem = 'lenovo';
    targetId = targetId.replace(/^lenovo\s+/i, '').trim();
    selectOEM('lenovo');
  }

  state.currentModelName = '';
  state.currentId = targetId.toUpperCase();
  input.value = targetId.toUpperCase();

  await fetchDrivers(targetOem, targetId);
}

window.triggerSearch = triggerSearch;

// ================================================================
// Consulta HTTP al Backend
// ================================================================

async function fetchDrivers(oem, modelId) {
  if (state.loading) return;
  state.loading = true;

  const btn = $('search-btn');
  if (btn) btn.disabled = true;

  showState('loading');
  showFiltersAndHeader(false);
  renderSkeletons(6);

  if ($('loading-text')) {
    $('loading-text').textContent = `Consultando catálogo oficial de ${oem === 'lenovo' ? 'Lenovo PC Support' : 'HP Image Assistant'}…`;
  }

  const endpoint = oem === 'lenovo'
    ? `/api/drivers/lenovo/${encodeURIComponent(modelId)}`
    : `/api/drivers/hp/${encodeURIComponent(modelId)}`;

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data?.message || `Error HTTP ${response.status}`;
      showError(errMsg, response.status);
      return;
    }

    state.allDrivers      = data.drivers || [];
    state.lastMeta        = data;

    updateStats(data);
    populateCategoryFilter(state.allDrivers);
    showFiltersAndHeader(true);
    // Aplica los filtros existentes (conservando lo seleccionado antes de la búsqueda)
    applyFilters();

    try {
      sessionStorage.setItem('current_drivers_' + modelId.toUpperCase(), JSON.stringify(state.allDrivers));
    } catch(e) {}

    showToast(`${state.allDrivers.length} controladores auditados para ${modelId}`, 'success');

  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      showError('Tiempo de espera agotado. Verifica tu conexión e inténtalo de nuevo.');
    } else {
      showError(`Error de red al consultar el catálogo: ${err.message}`);
    }
  } finally {
    state.loading = false;
    const searchBtn = $('search-btn');
    if (searchBtn) searchBtn.disabled = false;
  }
}

// ================================================================
// Skeleton loader
// ================================================================

function renderSkeletons(count) {
  const wrap = $('skeleton-rows');
  if (!wrap) return;
  wrap.innerHTML = '';

  for (let i = 0; i < count; i++) {
    const tr = document.createElement('div');
    tr.className = 'skeleton-row';
    tr.innerHTML = `
      <div class="skeleton-cell" style="width:120px;"></div>
      <div class="skeleton-cell" style="width:240px;"></div>
      <div class="skeleton-cell" style="width:260px;"></div>
      <div class="skeleton-cell" style="flex:1;"></div>
      <div class="skeleton-cell" style="width:90px;"></div>
      <div class="skeleton-cell" style="width:80px;"></div>
    `;
    wrap.appendChild(tr);
  }
}

// ================================================================
// Render de la Tabla Estructurada (6 Columnas Limpias)
// ================================================================

function renderTable(drivers) {
  const tbody = $('drivers-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (drivers.length === 0) {
    showState('empty');
    return;
  }

  const oemTitle = (state.currentOEM === 'hp') ? 'HP' : 'Lenovo';
  const fragment = document.createDocumentFragment();

  drivers.forEach((driver, idx) => {
    const tr = document.createElement('tr');
    const isBios = /bios|uefi/i.test(driver.category);
    if (isBios) tr.classList.add('is-bios');

    const severityCls = (driver.severity || 'Opcional').toLowerCase();
    const isAdmitted = driver.windowsAdmitted !== false && driver.deliverySource !== 'oem_only';
    const winCatalogName = driver.windowsAdmittedName || driver.name;
    const channelLabel = driver.windowsChannel || driver.intuneLabel || (driver.intuneStatus === 'priority_firmware' ? 'Prioritario (Firmware / BIOS)' : (isAdmitted ? 'Automático (Windows Update)' : `Portal Oficial ${oemTitle}`));

    tr.innerHTML = `
      <!-- Columna 1: Prioridad & Categoría -->
      <td class="col-priority">
        <div class="cell-priority-wrap">
          <span class="severity-badge ${severityCls}">
            <span class="severity-dot ${severityCls}"></span>
            ${escapeHtml(driver.severity)}
          </span>
          <span class="category-pill ${isBios ? 'bios' : ''}">
            ${escapeHtml(driver.category)}
          </span>
        </div>
      </td>

      <!-- Columna 2: Controlador Oficial OEM -->
      <td class="col-driver">
        <div class="cell-driver-wrap">
          <a
            class="driver-title-link"
            href="detail.html?oem=${encodeURIComponent(state.currentOEM)}&model=${encodeURIComponent(state.currentId)}&id=${encodeURIComponent(driver.id)}"
            target="_blank"
            rel="noopener"
            title="Abrir informe técnico completo en nueva pestaña o ventana"
          >
            ${escapeHtml(driver.name)}
          </a>
          <div class="driver-meta-sub">
            <span class="driver-id-badge font-mono">${escapeHtml(driver.id)}</span>
            <span>v${escapeHtml(driver.version)}</span>
            <span>&middot;</span>
            <span>${formatDate(driver.releaseDate)}</span>
          </div>
        </div>
      </td>

      <!-- Columna 3: Origen de la Oferta & Nombre Oficial Microsoft / Intune -->
      <td class="col-windows">
        <div class="cell-windows-wrap">
          ${isAdmitted
            ? `
              <span class="origin-badge badge-wu">Ofertada en Windows Update</span>
              <div class="wu-name-wrap">
                <span class="wu-label">Nombre oficial en Catálogo Microsoft / Intune:</span>
                <code class="wu-canonical-name" title="Copiar nombre canónico para localizar en Microsoft Intune">${escapeHtml(winCatalogName)}</code>
              </div>
              <div class="channel-pill-row">
                <span class="wu-ver-pill" title="Versión oficial para localizar en Intune">v${escapeHtml(driver.version)}</span>
                <span class="channel-badge">${escapeHtml(channelLabel)}</span>
              </div>
            `
            : `
              <span class="origin-badge badge-oem">Solo Soporte ${oemTitle}</span>
              <div class="oem-only-box">
                <span class="oem-only-text">Exclusivo portal oficial ${oemTitle}</span>
                <span class="oem-only-sub">No disponible en Catálogo Microsoft Update</span>
              </div>
              <div class="channel-pill-row">
                <span class="wu-ver-pill oem" title="Versión oficial del fabricante">v${escapeHtml(driver.version)}</span>
                <span class="channel-badge oem">${escapeHtml(channelLabel)}</span>
              </div>
            `
          }
        </div>
      </td>

      <!-- Columna 4: Qué Soluciona Este Parche (100% Español) -->
      <td class="col-solution">
        <div class="cell-solution-wrap">
          <div class="solution-preview-text">
            ${driver.description ? escapeHtml(driver.description) : '<span style="color:var(--text-muted)">Actualización oficial para estabilidad y compatibilidad con Windows 11.</span>'}
          </div>
          <a
            class="solution-more-btn"
            href="detail.html?oem=${encodeURIComponent(state.currentOEM)}&model=${encodeURIComponent(state.currentId)}&id=${encodeURIComponent(driver.id)}"
            target="_blank"
            rel="noopener"
            title="Abrir informe técnico completo en nueva pestaña o ventana"
          >
            + Ver todo el detalle ↗
          </a>
        </div>
      </td>

      <!-- Columna 5: Windows 11 -->
      <td class="col-os">
        <div class="cell-os-wrap">
          ${renderOsPills(driver.osCompatibility)}
        </div>
      </td>

      <!-- Columna 6: Acción Descarga -->
      <td class="col-action">
        ${renderDownloadAction(driver, idx)}
      </td>
    `;

    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);
  showState('results');
}

function renderOsPills(osList) {
  const list = Array.isArray(osList) && osList.length > 0
    ? osList
    : ['win11-24h2', 'win11-25h2', 'win11-26h2'];

  const labels = {
    'win11-24h2': '24H2',
    'win11-25h2': '25H2',
    'win11-26h2': '26H2',
  };

  return list.map(item => {
    const key = String(item).toLowerCase();
    const label = labels[key] || key.replace(/^win11-?/i, '').toUpperCase();
    return `<span class="os-pill" title="Certificado para Windows 11 ${label}">Win 11 ${label}</span>`;
  }).join('');
}

function renderDownloadAction(driver, idx) {
  if (driver.downloadUrl) {
    return `<a
      class="dl-action-btn"
      href="${escapeHtml(driver.downloadUrl)}"
      target="_blank"
      rel="noopener noreferrer"
      id="dl-btn-${idx}"
      title="Descarga oficial directa: ${escapeHtml(driver.name)}"
    >Descargar</a>`;
  }
  return `<span class="dl-action-btn disabled" title="Descarga no disponible directamente">N/A</span>`;
}

// ================================================================
// Modal de Detalle de Parche & Diagnóstico Windows Update
// ================================================================

// ================================================================
// Informe Técnico de Parche (Nueva Ventana y Modal)
// ================================================================

function generatePatchReportHtml(driver, oemTitle) {
  const isAdmitted = driver.windowsAdmitted !== false && driver.deliverySource !== 'oem_only';
  const winName = driver.windowsAdmittedName || driver.name;
  const channel = driver.windowsChannel || driver.intuneLabel || (isAdmitted ? 'Automático (Windows Update / WHQL)' : `Portal Oficial ${oemTitle}`);
  const fixes = driver.detailsSpanish?.queCorrige || driver.description || 'Actualización oficial para estabilidad, compatibilidad y corrección de incidencias.';
  const security = driver.detailsSpanish?.seguridad || 'Mantenimiento de estabilidad y corrección de errores en conformidad con los estándares de controladores WHQL de Microsoft.';
  const win11 = driver.detailsSpanish?.compatibilidadWin11 || 'Certificado para las ramas empresariales de Windows 11 (24H2, 25H2 y 26H2) con soporte para suspensión moderna S0ix.';
  const deploy = driver.detailsSpanish?.guiaDespliegue || (isAdmitted ? 'Se distribuye mediante el catálogo de Microsoft Windows Update o mediante directivas de actualización de controladores de Microsoft Intune.' : `Descarga e instalación exclusiva desde el portal oficial de soporte de ${oemTitle}. Para despliegue centralizado, empaquetar como Intune Win32 App (.intunewin).`);
  const isBios = /bios|uefi/i.test(driver.category || '');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Detalle Técnico — ${escapeHtml(driver.name)}</title>
  <style>
    :root {
      --bg: #0a0e1a;
      --card: #131a31;
      --card-sub: #0c1222;
      --border: rgba(99, 102, 241, 0.25);
      --border-strong: rgba(99, 102, 241, 0.45);
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #4f6ef7;
      --green: #34d399;
      --orange: #f97316;
      --cyan: #38bdf8;
      --red: #f87171;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      padding: 32px 20px;
      line-height: 1.6;
    }
    .container { max-width: 920px; margin: 0 auto; }
    .top-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge-oem { background: rgba(249, 115, 22, 0.15); color: var(--orange); border: 1px solid rgba(249, 115, 22, 0.3); }
    .badge-wu { background: rgba(52, 211, 153, 0.15); color: var(--green); border: 1px solid rgba(52, 211, 153, 0.3); }
    .badge-cat { background: rgba(79, 110, 247, 0.15); color: var(--accent); border: 1px solid var(--border); }
    .badge-sev { background: rgba(248, 113, 113, 0.15); color: var(--red); border: 1px solid rgba(248, 113, 113, 0.3); }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 14px; color: #fff; line-height: 1.35; }
    h2 { font-size: 14px; font-weight: 700; color: var(--cyan); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
    .grid-item { background: var(--card-sub); padding: 12px 14px; border-radius: 8px; border: 1px solid var(--border); }
    .label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px; }
    .val { font-size: 13px; font-weight: 600; color: #fff; }
    .font-mono { font-family: 'Consolas', 'Courier New', monospace; }
    .code-box {
      background: var(--card-sub);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px 16px;
      font-family: 'Consolas', monospace;
      font-size: 13px;
      color: var(--cyan);
      word-break: break-all;
      margin-top: 6px;
    }
    .desc-block {
      background: var(--card-sub);
      border-left: 4px solid var(--accent);
      padding: 14px 18px;
      border-radius: 0 8px 8px 0;
      margin-bottom: 16px;
      font-size: 14px;
      color: #e2e8f0;
      line-height: 1.6;
    }
    .os-tags-row { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
    .os-pill { background: rgba(56, 189, 248, 0.12); color: var(--cyan); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 4px; padding: 2px 8px; font-size: 11px; font-weight: 600; }
    .btn-row { display: flex; gap: 12px; margin-top: 24px; flex-wrap: wrap; }
    .btn {
      padding: 12px 22px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: none;
      transition: opacity 0.2s ease;
    }
    .btn:hover { opacity: 0.9; }
    .btn-primary { background: var(--accent); color: #fff; }
    .btn-secondary { background: var(--card-sub); color: var(--text); border: 1px solid var(--border-strong); }
    @media print {
      body { background: #fff; color: #000; padding: 10px; }
      .card { border: 1px solid #ccc; box-shadow: none; background: #fff; color: #000; }
      .grid-item, .code-box, .desc-block { background: #f8fafc; color: #000; border-color: #cbd5e1; }
      .val, h1, h2 { color: #000; }
      .top-actions, .btn-row { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="top-actions">
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        <span class="badge badge-oem">Soporte ${escapeHtml(oemTitle)}</span>
        <span class="badge badge-cat">${escapeHtml(driver.category)}</span>
        <span class="badge badge-sev">${escapeHtml(driver.severity)}</span>
        ${isAdmitted ? '<span class="badge badge-wu">Admitida en Windows Update</span>' : '<span class="badge badge-oem">Solo Soporte Fabricante</span>'}
      </div>
      <div>
        <button class="btn btn-secondary" onclick="window.print()">Imprimir / Guardar PDF</button>
      </div>
    </div>

    <!-- Tarjeta Principal del Controlador -->
    <div class="card">
      <h1>${escapeHtml(driver.name)}</h1>
      <div class="grid">
        <div class="grid-item">
          <span class="label">ID / SoftPaq</span>
          <span class="val font-mono">${escapeHtml(driver.id)}</span>
        </div>
        <div class="grid-item">
          <span class="label">Versión Oficial</span>
          <span class="val font-mono">v${escapeHtml(driver.version)}</span>
        </div>
        <div class="grid-item">
          <span class="label">Fecha Oficial</span>
          <span class="val">${formatDate(driver.releaseDate)}</span>
        </div>
        <div class="grid-item">
          <span class="label">Tamaño del Paquete</span>
          <span class="val">${escapeHtml(driver.fileSize || 'Estándar')}</span>
        </div>
      </div>
    </div>

    <!-- Estado en Microsoft Windows Update & Intune -->
    <div class="card">
      <h2>Admisión en Catálogo de Microsoft Windows Update &amp; Microsoft Intune</h2>
      
      <div style="margin-bottom:14px;">
        ${isAdmitted
          ? '<span class="badge badge-wu">Certificado WHQL — Ofertada en Microsoft Windows Update</span>'
          : `<span class="badge badge-oem">Exclusivo portal oficial ${escapeHtml(oemTitle)} — No publicado en Catálogo Microsoft</span>`
        }
      </div>

      <div style="margin-bottom:14px;">
        <span class="label">Nombre Oficial en Catálogo Microsoft / Intune / Administrador de Dispositivos:</span>
        <div class="code-box">${escapeHtml(winName)}</div>
      </div>

      <div class="grid">
        <div class="grid-item">
          <span class="label">Canal de Distribución</span>
          <span class="val">${escapeHtml(channel)}</span>
        </div>
        <div class="grid-item">
          <span class="label">ID de Certificación WHQL / Hardware ID</span>
          <span class="val font-mono">${escapeHtml(driver.whqlId || (isAdmitted ? 'WHQL-CERTIFIED-MSFT' : `EXCLUSIVO-${oemTitle.toUpperCase()}`))}</span>
        </div>
      </div>

      <div style="margin-top:14px;">
        <span class="label">Notas Operativas para SysAdmin / Microsoft Intune:</span>
        <p style="font-size:13px; color:var(--text-muted); margin-top:4px;">${escapeHtml(driver.intuneNotes || '')}</p>
      </div>
    </div>

    <!-- Desglose Técnico Completo (Qué Soluciona Este Parche) -->
    <div class="card">
      <h2>Qué Soluciona Este Parche (Detalle Técnico Completo)</h2>
      
      <span class="label">Problemas Corregidos y Mejoras de Rendimiento:</span>
      <div class="desc-block">
        ${escapeHtml(fixes)}
      </div>

      <span class="label">Boletines de Seguridad y Vulnerabilidades (CVE):</span>
      <div class="desc-block" style="border-left-color: var(--orange);">
        ${escapeHtml(security)}
      </div>

      <span class="label">Compatibilidad Certificada con Windows 11:</span>
      <div class="desc-block" style="border-left-color: var(--green);">
        ${escapeHtml(win11)}
        <div class="os-tags-row">
          <span class="os-pill">Windows 11 24H2</span>
          <span class="os-pill">Windows 11 25H2</span>
          <span class="os-pill">Windows 11 26H2</span>
        </div>
      </div>

      <span class="label">Guía de Despliegue e Instalación para TI:</span>
      <div class="desc-block" style="border-left-color: var(--cyan);">
        ${escapeHtml(deploy)}
      </div>
    </div>

    <!-- Botones de Acción -->
    <div class="btn-row">
      ${driver.downloadUrl ? `<a href="${escapeHtml(driver.downloadUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">Descargar Actualización Oficial</a>` : ''}
      <button class="btn btn-secondary" onclick="window.close()">Cerrar Ventana</button>
    </div>
  </div>
</body>
</html>`;
}

function openPatchDetail(index) {
  const driver = (state.filteredDrivers && state.filteredDrivers[index]) || (state.allDrivers && state.allDrivers[index]);
  if (!driver) {
    showToast('No se encontró el controlador seleccionado', 'error');
    return;
  }

  state.currentModalIndex = index;
  const oemTitle = (state.currentOEM === 'hp') ? 'HP' : 'Lenovo';
  const htmlContent = generatePatchReportHtml(driver, oemTitle);

  // Intenta abrir en una nueva ventana / pestaña
  let openedInWindow = false;
  try {
    const reportWindow = window.open('', '_blank');
    if (reportWindow && !reportWindow.closed) {
      reportWindow.document.open();
      reportWindow.document.write(htmlContent);
      reportWindow.document.close();
      if (reportWindow.focus) reportWindow.focus();
      openedInWindow = true;
      showToast('Detalle técnico abierto en nueva ventana', 'success', 2500);
    }
  } catch (err) {
    console.warn('Bloqueo de ventana emergente, recurriendo a modal:', err);
  }

  // Si el navegador bloqueó la ventana emergente, abre el modal en pantalla
  if (!openedInWindow) {
    openPatchModal(index);
    showToast('Detalle cargado en el visor de pantalla (permite ventanas emergentes para abrir en pestaña)', 'info', 4000);
  }
}

function openPatchInNewWindow(index) {
  const targetIndex = (index != null) ? index : state.currentModalIndex;
  const driver = (state.filteredDrivers && state.filteredDrivers[targetIndex]) || (state.allDrivers && state.allDrivers[targetIndex]);
  if (!driver) return;

  const oemTitle = (state.currentOEM === 'hp') ? 'HP' : 'Lenovo';
  const htmlContent = generatePatchReportHtml(driver, oemTitle);

  try {
    const reportWindow = window.open('', '_blank');
    if (reportWindow) {
      reportWindow.document.open();
      reportWindow.document.write(htmlContent);
      reportWindow.document.close();
      if (reportWindow.focus) reportWindow.focus();
      showToast('Detalle abierto en nueva ventana', 'success', 2000);
    } else {
      showToast('El navegador bloqueó la ventana emergente. Habilita los popups para este sitio.', 'error', 4000);
    }
  } catch (e) {
    console.error('Error al abrir ventana:', e);
  }
}

function openPatchModal(index) {
  const driver = (state.filteredDrivers && state.filteredDrivers[index]) || (state.allDrivers && state.allDrivers[index]);
  if (!driver) return;

  state.currentModalIndex = index;
  const oemTitle = (state.currentOEM === 'hp') ? 'HP' : 'Lenovo';
  const isBios = /bios|uefi/i.test(driver.category || '');
  const severityCls = (driver.severity || 'Opcional').toLowerCase();
  const isAdmitted = driver.windowsAdmitted !== false && driver.deliverySource !== 'oem_only';

  if ($('modal-title'))   $('modal-title').textContent   = driver.name;
  if ($('modal-id'))      $('modal-id').textContent      = driver.id;
  if ($('modal-version')) $('modal-version').textContent = driver.version;
  if ($('modal-date'))    $('modal-date').textContent    = formatDate(driver.releaseDate);
  if ($('modal-size'))    $('modal-size').textContent    = driver.fileSize || 'Estándar';

  const catWrap = $('modal-category-badge');
  if (catWrap) catWrap.innerHTML = `<span class="category-pill ${isBios ? 'bios' : ''}">${escapeHtml(driver.category)}</span>`;

  const sevWrap = $('modal-severity-badge');
  if (sevWrap) sevWrap.innerHTML = `<span class="severity-badge ${severityCls}">${escapeHtml(driver.severity)}</span>`;

  // Origen de la Oferta y Estado de Admisión
  const admitBadge = $('modal-admitted-badge');
  if (admitBadge) {
    if (isAdmitted) {
      admitBadge.className = 'admit-badge-lg admitted';
      admitBadge.textContent = 'Ofertada en Microsoft Windows Update (WHQL)';
    } else {
      admitBadge.className = 'admit-badge-lg oem-only';
      admitBadge.textContent = `Solo Soporte Oficial ${oemTitle} (No en Windows Update)`;
    }
  }

  // Nombre canónico oficial en Windows Update o indicación de exclusividad OEM
  const canonicalName = $('modal-canonical-name');
  if (canonicalName) {
    canonicalName.textContent = isAdmitted
      ? (driver.windowsAdmittedName || driver.name)
      : `Exclusivo portal de soporte de ${oemTitle} (No publicado en Catálogo de Microsoft Update)`;
  }

  // Canal de distribución
  const chanWrap = $('modal-intune-channel');
  if (chanWrap) {
    chanWrap.textContent = driver.windowsChannel || (isAdmitted ? 'Automático (Windows Update)' : `Portal Oficial ${oemTitle}`);
  }

  // WHQL ID
  const whqlWrap = $('modal-whql-id');
  if (whqlWrap) {
    whqlWrap.textContent = driver.whqlId || (isAdmitted ? 'WHQL-VALIDATED-MSFT' : `EXCLUSIVO-${oemTitle.toUpperCase()}`);
  }

  // Notas operativas para SysAdmin e Intune
  const notesWrap = $('modal-intune-notes');
  if (notesWrap) {
    notesWrap.textContent = driver.intuneNotes ||
      (isAdmitted
        ? 'Controlador firmado digitalmente por Microsoft. Windows Update lo despliega de forma transparente o configurable mediante perfiles de controladores en Intune.'
        : `Herramienta o paquete exclusivo de ${oemTitle}. Para despliegue centralizado, debe empaquetarse como Intune Win32 App (.intunewin) o ejecutarse con permisos elevados.`);
  }

  // Desglose técnico completo 100% en español
  const fixesText = driver.detailsSpanish?.queCorrige || driver.description || 'Actualización oficial para estabilidad y corrección de incidencias.';
  if ($('modal-que-corrige')) $('modal-que-corrige').textContent = fixesText;

  const secText = driver.detailsSpanish?.seguridad || 'Mantenimiento de estabilidad y corrección de errores en conformidad con los estándares de seguridad.';
  if ($('modal-seguridad')) $('modal-seguridad').textContent = secText;

  const win11Text = driver.detailsSpanish?.compatibilidadWin11 || 'Certificado para las ramas empresariales de Windows 11.';
  if ($('modal-win11-compat')) $('modal-win11-compat').textContent = win11Text;

  const deployText = driver.detailsSpanish?.guiaDespliegue || (isAdmitted ? 'Despliegue estándar por Windows Update.' : `Descarga e instalación exclusiva desde el portal ${oemTitle}.`);
  if ($('modal-guia-despliegue')) $('modal-guia-despliegue').textContent = deployText;

  // Tags OS
  const osTagsWrap = $('modal-os-tags');
  if (osTagsWrap) osTagsWrap.innerHTML = renderOsPills(driver.osCompatibility);

  // Botón Descarga
  const dlBtn = $('modal-dl-btn');
  if (dlBtn) {
    if (driver.downloadUrl) {
      dlBtn.href = driver.downloadUrl;
      dlBtn.classList.remove('disabled');
      dlBtn.style.display = 'inline-flex';
    } else {
      dlBtn.removeAttribute('href');
      dlBtn.classList.add('disabled');
      dlBtn.style.display = 'none';
    }
  }

  const modal = $('patch-modal');
  if (modal) {
    modal.style.display = 'flex';
    modal.style.opacity = '1';
    modal.style.visibility = 'visible';
  }
  document.body.style.overflow = 'hidden';
}

function closePatchModal() {
  const modal = $('patch-modal');
  if (modal) {
    modal.style.display = 'none';
    modal.style.visibility = 'hidden';
  }
  document.body.style.overflow = '';
}

function closeModalOnBackdrop(event) {
  if (event.target === $('patch-modal')) {
    closePatchModal();
  }
}

window.openPatchDetail      = openPatchDetail;
window.openPatchInNewWindow = openPatchInNewWindow;
window.openPatchModal       = openPatchModal;
window.closePatchModal      = closePatchModal;
window.closeModalOnBackdrop = closeModalOnBackdrop;

// ================================================================
// Modal y Generador de Comandos PowerShell para Equipo Cliente
// ================================================================

function getTerminalCommandUrl() {
  const oem = state.currentOEM || 'lenovo';
  const modelId = state.currentId || '20L5';
  let host = window.location.host;
  const customHostInput = $('server-host-input');
  if (customHostInput && customHostInput.value.trim()) {
    host = customHostInput.value.trim();
  }
  const protocol = window.location.protocol;
  return `${protocol}//${host}/api/script/${encodeURIComponent(oem)}/${encodeURIComponent(modelId)}`;
}

function updateTerminalCommandString() {
  const url = getTerminalCommandUrl();
  const cmdDisplay = $('terminal-cmd-display');
  if (cmdDisplay) {
    cmdDisplay.textContent = `powershell -ExecutionPolicy Bypass -Command "irm ${url} | iex"`;
  }
}

function openTerminalCommandModal() {
  const modal = $('terminal-modal');
  if (!modal) {
    console.error('No se encontro el elemento #terminal-modal');
    return;
  }
  const oem = (state.currentOEM || 'lenovo').toLowerCase() === 'hp' ? 'hp' : 'lenovo';
  const oemTitle = oem === 'hp' ? 'HP' : 'Lenovo';
  const modelId = state.currentId || (oem === 'hp' ? '888A' : '20L5');
  const friendlyName = state.currentModelName || FLEET_MODELS_MAP[modelId]?.name || modelId;

  if ($('terminal-modal-title')) {
    $('terminal-modal-title').textContent = `Comando para Terminal — ${friendlyName} (${modelId})`;
  }

  const customHostInput = $('server-host-input');
  if (customHostInput && !customHostInput.value) {
    customHostInput.value = window.location.host;
  }

  updateTerminalCommandString();

  modal.style.display = 'flex';
  modal.style.opacity = '1';
  modal.style.visibility = 'visible';
  document.body.style.overflow = 'hidden';
}

function closeTerminalCommandModal() {
  const modal = $('terminal-modal');
  if (modal) {
    modal.style.setProperty('display', 'none', 'important');
    modal.style.setProperty('visibility', 'hidden', 'important');
    modal.style.setProperty('opacity', '0', 'important');
    modal.classList.add('is-hidden');
  }
  document.body.style.overflow = '';
}

function closeTerminalModalOnBackdrop(event) {
  if (event.target === $('terminal-modal')) {
    closeTerminalCommandModal();
  }
}

function copyTerminalCommand() {
  const cmdDisplay = $('terminal-cmd-display');
  if (!cmdDisplay) return;
  const text = cmdDisplay.textContent;

  function markAsCopied() {
    const btn = $('copy-cmd-btn');
    if (btn) {
      btn.textContent = 'Copiado!';
      btn.style.setProperty('background', '#34d399', 'important');
      btn.style.setProperty('color', '#0a0e1a', 'important');
      setTimeout(() => {
        btn.textContent = 'Copiar Comando';
        btn.style.removeProperty('background');
        btn.style.removeProperty('color');
      }, 2500);
    }
    showToast('Comando copiado al portapapeles. Pegalo en PowerShell como Administrador.', 'success');
  }

  function fallbackCopyText(str) {
    const ta = document.createElement('textarea');
    ta.value = str;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy');
      markAsCopied();
    } catch (e) {
      showToast('Selecciona y copia el texto del comando manualmente', 'info');
    }
    document.body.removeChild(ta);
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(markAsCopied).catch(() => {
      fallbackCopyText(text);
    });
  } else {
    fallbackCopyText(text);
  }
}

function downloadPowerShellScript() {
  const oem = state.currentOEM || 'lenovo';
  const modelId = state.currentId || '20L5';
  const downloadUrl = `/api/script/${encodeURIComponent(oem)}/${encodeURIComponent(modelId)}?download=1`;
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `auditar-${oem}-${modelId}.ps1`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Descargando script PowerShell para ' + modelId, 'info');
}

function resetServerHost() {
  const customHostInput = $('server-host-input');
  if (customHostInput) {
    customHostInput.value = window.location.host;
    updateTerminalCommandString();
  }
}

window.openTerminalCommandModal    = openTerminalCommandModal;
window.closeTerminalCommandModal   = closeTerminalCommandModal;
window.closeTerminalModalOnBackdrop = closeTerminalModalOnBackdrop;
window.copyTerminalCommand         = copyTerminalCommand;
window.downloadPowerShellScript    = downloadPowerShellScript;
window.updateTerminalCommandString = updateTerminalCommandString;
window.resetServerHost             = resetServerHost;

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closePatchModal();
    closeTerminalCommandModal();
  }
});

// ================================================================
// Filtros combinados
// ================================================================

function populateCategoryFilter(drivers) {
  const sel = $('filter-category');
  if (!sel) return;
  const currentVal = sel.value; // Conserva la categoría seleccionada por el usuario antes de la búsqueda

  const driverCats = [...new Set((drivers || []).map(d => d.category))].filter(Boolean);
  const baseCats = [
    'BIOS/UEFI',
    'Red',
    'Bluetooth',
    'Gráficos/Display',
    'Audio',
    'Chipset',
    'Almacenamiento',
    'USB/Thunderbolt',
    'Cámara',
    'Periféricos',
    'Energía/Batería',
    'Seguridad',
    state.currentOEM === 'hp' ? 'Software HP' : 'Software Lenovo',
  ];

  const merged = [...new Set([...baseCats, ...driverCats])].sort();

  sel.innerHTML = '<option value="">Todas las categorías</option>';
  merged.forEach(cat => {
    const opt = document.createElement('option');
    opt.value       = cat;
    opt.textContent = cat;
    sel.appendChild(opt);
  });

  // Si el usuario tenía seleccionada una categoría válida, restaurarla con coincidencia insensible a mayúsculas
  if (currentVal) {
    const found = merged.find(c => c.toLowerCase() === currentVal.toLowerCase());
    if (found) {
      sel.value = found;
    }
  }
}

function applyFilters() {
  const categoryEl = $('filter-category');
  const admittedEl = $('filter-windows-admitted');
  const intuneEl   = $('filter-intune');
  const osBuildEl  = $('filter-os-build');
  const textEl     = $('filter-text');
  const critEl     = $('filter-critical');

  const categoryVal  = categoryEl ? categoryEl.value.trim() : '';
  const admittedVal  = admittedEl ? admittedEl.value.trim() : '';
  const intuneVal    = intuneEl   ? intuneEl.value.trim() : '';
  const osBuildVal   = osBuildEl  ? osBuildEl.value.trim().toLowerCase() : '';
  const textVal      = textEl     ? textEl.value.toLowerCase().trim() : '';
  const criticalOnly = critEl     ? critEl.checked : false;

  if (!state.allDrivers || state.allDrivers.length === 0) {
    return;
  }

  state.filteredDrivers = state.allDrivers.filter(driver => {
    // 1. Categoría (comparación insensible a mayúsculas y espacios)
    if (categoryVal) {
      const dCat = String(driver.category || '').trim().toLowerCase();
      const fCat = categoryVal.toLowerCase();
      if (dCat !== fCat) return false;
    }

    // 2. Origen de la Oferta (Windows Update vs Solo Soporte Fabricante)
    if (admittedVal === 'admitted') {
      const isWu = (driver.windowsAdmitted === true || driver.deliverySource === 'windows_update') && driver.deliverySource !== 'oem_only';
      if (!isWu) return false;
    } else if (admittedVal === 'oem_only') {
      const isOemOnly = driver.windowsAdmitted === false || driver.deliverySource === 'oem_only';
      if (!isOemOnly) return false;
    }

    // 3. Canal Intune / WU
    if (intuneVal) {
      const dStatus = String(driver.intuneStatus || '').trim().toLowerCase();
      if (dStatus !== intuneVal.toLowerCase()) return false;
    }

    // 4. Build de Windows 11 (24H2, 25H2, 26H2)
    if (osBuildVal) {
      const compat = Array.isArray(driver.osCompatibility) ? driver.osCompatibility : [];
      const hasMatch = compat.some(c => String(c).toLowerCase().includes(osBuildVal));
      if (!hasMatch) return false;
    }

    // 5. Búsqueda de texto en nombre, ID, versión, qué soluciona o nombre canónico de Windows
    if (textVal) {
      const searchable = [
        driver.name || '',
        driver.version || '',
        driver.id || '',
        driver.category || '',
        driver.description || '',
        driver.detailsSpanish?.queCorrige || '',
        driver.windowsAdmittedName || '',
        driver.windowsChannel || '',
        driver.whqlId || '',
      ].join(' ').toLowerCase();
      if (!searchable.includes(textVal)) return false;
    }

    // 6. Solo críticos
    if (criticalOnly) {
      const sev = String(driver.severity || '').toLowerCase();
      if (!sev.includes('crítico') && !sev.includes('critico') && !sev.includes('critical')) return false;
    }

    return true;
  });

  if (state.filteredDrivers.length === 0) {
    showState('empty');
  } else {
    renderTable(state.filteredDrivers);
    showState('results');
  }

  updateFilteredStats();
  updateResultsHeader(state.filteredDrivers.length, state.currentOEM, state.currentId);
}

function resetFilters() {
  if ($('filter-category'))         $('filter-category').value = '';
  if ($('filter-windows-admitted')) $('filter-windows-admitted').value = '';
  if ($('filter-intune'))           $('filter-intune').value = '';
  if ($('filter-os-build'))         $('filter-os-build').value = '';
  if ($('filter-text'))             $('filter-text').value = '';
  if ($('filter-critical'))         $('filter-critical').checked = false;
}

function resetFiltersAndApply() {
  resetFilters();
  applyFilters();
}

window.applyFilters         = applyFilters;
window.resetFilters         = resetFilters;
window.resetFiltersAndApply = resetFiltersAndApply;

// ================================================================
// Header de Resultados y Métricas
// ================================================================

function updateResultsHeader(count, oem, modelId) {
  const total = state.allDrivers ? state.allDrivers.length : count;
  const countEl = $('results-count');
  if (countEl) {
    if (total > 0 && count < total) {
      countEl.innerHTML = `Mostrando <strong id="results-count-num">${count}</strong> de ${total} controladores (filtrados)`;
    } else {
      countEl.innerHTML = `<strong id="results-count-num">${count}</strong> controladores auditados`;
    }
  }

  const badge = $('oem-badge');
  if (badge) {
    badge.textContent = oem.toUpperCase();
    badge.className   = `oem-badge ${oem}`;
  }

  if ($('model-id-display')) $('model-id-display').textContent = modelId;

  const friendlyName = state.currentModelName || FLEET_MODELS_MAP[modelId]?.name || '';
  const nameDisplay = $('model-name-display');
  if (nameDisplay) {
    if (friendlyName) {
      nameDisplay.textContent = `· ${friendlyName}`;
      nameDisplay.style.display = '';
    } else {
      nameDisplay.textContent = '';
      nameDisplay.style.display = 'none';
    }
  }

  const hasResults = count > 0;
  if ($('terminal-cmd-btn')) $('terminal-cmd-btn').disabled = !hasResults;
  if ($('export-csv-btn'))  $('export-csv-btn').disabled  = !hasResults;
  if ($('export-json-btn')) $('export-json-btn').disabled = !hasResults;
}

function updateStats(data) {
  const drivers     = data.drivers || [];
  const critical    = drivers.filter(d => d.severity === 'Crítico').length;
  const admitted    = drivers.filter(d => d.windowsAdmitted !== false && d.deliverySource !== 'oem_only').length;
  const oemOnly     = drivers.filter(d => d.windowsAdmitted === false || d.deliverySource === 'oem_only').length;

  if ($('stat-total'))     $('stat-total').textContent     = drivers.length;
  if ($('stat-admitted'))  $('stat-admitted').textContent  = admitted;
  if ($('stat-oem-only'))  $('stat-oem-only').textContent  = oemOnly;
  if ($('stat-critical'))  $('stat-critical').textContent  = critical;
  if ($('stat-elapsed'))   $('stat-elapsed').textContent   = data.elapsed_ms != null ? `${data.elapsed_ms}ms` : '—';

  const oemTitle = (state.currentOEM === 'hp') ? 'HP' : 'Lenovo';
  if ($('stat-oem-label')) $('stat-oem-label').textContent = `Solo Soporte ${oemTitle}`;
}

function updateFilteredStats() {
  const filtered = state.filteredDrivers || [];
  const total    = state.allDrivers || [];
  const critical = filtered.filter(d => d.severity === 'Crítico').length;
  const admitted = filtered.filter(d => d.windowsAdmitted !== false && d.deliverySource !== 'oem_only').length;
  const oemOnly  = filtered.filter(d => d.windowsAdmitted === false || d.deliverySource === 'oem_only').length;

  if ($('stat-total')) {
    $('stat-total').textContent = filtered.length === total.length
      ? `${total.length}`
      : `${filtered.length} / ${total.length}`;
  }
  if ($('stat-admitted')) $('stat-admitted').textContent = admitted;
  if ($('stat-oem-only')) $('stat-oem-only').textContent = oemOnly;
  if ($('stat-critical')) $('stat-critical').textContent = critical;
}

// ================================================================
// Exportación CSV / JSON
// ================================================================

function exportData(format) {
  const drivers = state.filteredDrivers;
  if (drivers.length === 0) {
    showToast('No hay datos para exportar con los filtros actuales', 'error');
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename  = `auditoria-${state.currentOEM}-${state.currentId}-${timestamp}`;

  if (format === 'json') {
    const payload = {
      exportedAt:    new Date().toISOString(),
      oem:           state.currentOEM,
      modelId:       state.currentId,
      modelName:     state.currentModelName || FLEET_MODELS_MAP[state.currentId]?.name || '',
      totalCount:    state.allDrivers.length,
      filteredCount: drivers.length,
      drivers,
    };
    downloadBlob(
      JSON.stringify(payload, null, 2),
      `${filename}.json`,
      'application/json'
    );
    showToast(`${drivers.length} drivers exportados a JSON`, 'success');

  } else if (format === 'csv') {
    const headers = [
      'ID_Controlador',
      'Categoría',
      'Nombre_Oficial_OEM',
      'Admitida_Por_Windows',
      'Nombre_Catálogo_Windows_Update',
      'Canal_Intune_WU',
      'Firma_WHQL_HardwareID',
      'Qué_Soluciona_Este_Parche',
      'Compatibilidad_Win11',
      'Versión',
      'Fecha',
      'Criticidad',
      'URL_Descarga',
      'Tamaño',
      'Directiva_Intune_Recomendada'
    ];
    const rows = drivers.map(d => [
      csvEscape(d.id),
      csvEscape(d.category),
      csvEscape(d.name),
      csvEscape(d.windowsAdmitted !== false ? 'SÍ (WHQL)' : 'NO (Solo OEM)'),
      csvEscape(d.windowsAdmittedName || d.name),
      csvEscape(d.windowsChannel || d.intuneLabel || ''),
      csvEscape(d.whqlId || ''),
      csvEscape(d.description || ''),
      csvEscape((d.osCompatibility || []).join('; ')),
      csvEscape(d.version),
      csvEscape(d.releaseDate || ''),
      csvEscape(d.severity),
      csvEscape(d.downloadUrl || ''),
      csvEscape(d.fileSize || ''),
      csvEscape(d.intuneNotes || ''),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    downloadBlob(
      '\uFEFF' + csv,
      `${filename}.csv`,
      'text/csv;charset=utf-8;'
    );
    showToast(`${drivers.length} drivers exportados a CSV con datos de Windows Update`, 'success');
  }
}

window.exportData = exportData;

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function csvEscape(value) {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ================================================================
// Manejo de errores
// ================================================================

function showError(message, statusCode = null) {
  showState('error');
  showFiltersAndHeader(false);
  state.allDrivers      = [];
  state.filteredDrivers = [];

  const titleMap = {
    400: 'Parámetro inválido',
    404: 'Modelo no encontrado',
    502: 'Error de CDN del fabricante',
    504: 'Tiempo de espera agotado',
  };

  if ($('error-title'))   $('error-title').textContent   = titleMap[statusCode] || 'Error al consultar drivers';
  if ($('error-message')) $('error-message').textContent = message;

  const detail = $('error-detail');
  if (detail) {
    if (statusCode && statusCode >= 400) {
      detail.textContent = `HTTP ${statusCode} | OEM: ${state.currentOEM.toUpperCase()} | ID: ${state.currentId}`;
      detail.style.display = '';
    } else {
      detail.style.display = 'none';
    }
  }

  showToast(message, 'error', 5000);
}

// ================================================================
// Formato de fechas y seguridad
// ================================================================

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: '2-digit' });
  } catch {
    return String(dateStr);
  }
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ================================================================
// Gestión de Vistas Principales (Navegación SPA)
// ================================================================

let currentMainView = 'catalog';

function switchMainView(viewName) {
  currentMainView = viewName;

  // Actualizar botones de navegación
  const navBtns = {
    catalog: $('nav-btn-catalog'),
    fleet: $('nav-btn-fleet'),
    settings: $('nav-btn-settings'),
  };

  Object.entries(navBtns).forEach(([name, btn]) => {
    if (btn) {
      if (name === viewName) {
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
      }
    }
  });

  // Mostrar / Ocultar contenedores
  const viewContainers = {
    catalog: $('view-catalog'),
    fleet: $('view-fleet'),
    settings: $('view-settings'),
  };

  Object.entries(viewContainers).forEach(([name, el]) => {
    if (el) {
      el.style.display = (name === viewName) ? 'block' : 'none';
    }
  });

  // Carga de datos según la vista
  if (viewName === 'fleet') {
    loadFleetData(false);
  } else if (viewName === 'settings') {
    loadFleetSettings();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ================================================================
// Dashboard de Flota Corporativa (Endpoints & Cumplimiento)
// ================================================================

let allFleetDevices = [];
let currentDeviceUnderAudit = null;

async function loadFleetData(showToastFeedback = false) {
  try {
    const [statsRes, devicesRes] = await Promise.all([
      fetch('/api/fleet/stats'),
      fetch('/api/fleet/devices')
    ]);

    if (!statsRes.ok || !devicesRes.ok) {
      throw new Error('No se pudieron obtener los datos de la flota');
    }

    const stats = await statsRes.json();
    const devices = await devicesRes.json();

    allFleetDevices = devices;
    renderFleetStats(stats, devices);
    filterFleetTable();

    // Actualizar badge de contador en nav
    const countBadge = $('nav-fleet-count-badge');
    if (countBadge) countBadge.textContent = String(stats.totalDevices || devices.length);

    if (showToastFeedback) {
      showToast('Datos de flota actualizados en tiempo real', 'success');
    }
  } catch (err) {
    console.error('Error al cargar datos de flota:', err);
    if (showToastFeedback) {
      showToast('Error al conectar con el servicio de flota', 'error');
    }
  }
}

function renderFleetStats(stats, devices) {
  const elTotal = $('stat-total-devices');
  const elUptodate = $('stat-uptodate-devices');
  const elOutdated = $('stat-outdated-devices');
  const elCritical = $('stat-critical-count');
  const elBreakdown = $('stat-devices-breakdown');

  if (elTotal) elTotal.textContent = String(stats.totalDevices ?? devices.length);
  if (elUptodate) elUptodate.textContent = String(stats.uptodateDevices ?? 0);
  if (elOutdated) elOutdated.textContent = String(stats.outdatedDevices ?? 0);
  if (elCritical) elCritical.textContent = String(stats.criticalPendingCount ?? 0);

  if (elBreakdown) {
    const lenovoCount = devices.filter(d => d.oem === 'lenovo').length;
    const hpCount = devices.filter(d => d.oem === 'hp').length;
    elBreakdown.textContent = `Lenovo: ${lenovoCount} · HP: ${hpCount}`;
  }
}

function filterFleetTable() {
  const query = ($('fleet-search-input')?.value || '').toLowerCase().trim();
  const filterGroup = $('fleet-filter-group')?.value || '';
  const filterOem = $('fleet-filter-oem')?.value || '';
  const filterStatus = $('fleet-filter-status')?.value || '';

  const filtered = allFleetDevices.filter(d => {
    // Filtro por texto
    if (query) {
      const matchHost = (d.hostname || '').toLowerCase().includes(query);
      const matchIp = (d.ip_address || '').toLowerCase().includes(query);
      const matchModel = (d.model_name || '').toLowerCase().includes(query);
      const matchModelId = (d.model_id || '').toLowerCase().includes(query);
      const matchBios = (d.bios_version || '').toLowerCase().includes(query);
      if (!matchHost && !matchIp && !matchModel && !matchModelId && !matchBios) return false;
    }

    // Filtro por grupo
    if (filterGroup && d.group_name !== filterGroup) return false;

    // Filtro por OEM
    if (filterOem && d.oem !== filterOem) return false;

    // Filtro por estado
    if (filterStatus) {
      if (filterStatus === 'compliant' && d.compliance_rate < 100) return false;
      if (filterStatus === 'outdated' && d.compliance_rate === 100) return false;
      if (filterStatus === 'critical' && (!d.critical_pending || d.critical_pending === 0)) return false;
    }

    return true;
  });

  renderFleetTable(filtered);
}

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
    // Determinar estado y color
    let statusPill = '';
    if (d.critical_pending && d.critical_pending > 0) {
      statusPill = `<span class="status-pill critical">Crítico (${d.critical_pending})</span>`;
    } else if (d.compliance_rate === 100) {
      statusPill = `<span class="status-pill compliant">Al Día</span>`;
    } else {
      statusPill = `<span class="status-pill outdated">Desactualizado</span>`;
    }

    // Barra de progreso
    const rate = Math.min(100, Math.max(0, d.compliance_rate || 0));
    let barClass = 'high';
    if (rate < 60) barClass = 'low';
    else if (rate < 90) barClass = 'mid';

    const pendingTotal = (d.outdated_drivers || 0) + (d.pending_drivers || 0);

    return `
      <tr>
        <td>${statusPill}</td>
        <td>
          <div style="font-weight:700; color:var(--text-primary); font-family:var(--font-mono); font-size:13px;">
            ${escapeHtml(d.hostname)}
          </div>
          <div style="font-size:11px; color:var(--text-muted); font-family:var(--font-mono);">
            IP: ${escapeHtml(d.ip_address || '127.0.0.1')}
          </div>
        </td>
        <td>
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="tab-btn-pill ${d.oem}" style="font-size:10px; padding:1px 6px;">${d.oem.toUpperCase()}</span>
            <span style="font-weight:600; color:var(--text-primary);">${escapeHtml(d.model_name)}</span>
          </div>
          <div style="font-size:11px; color:var(--text-secondary); margin-top:2px; font-family:var(--font-mono);">
            ID: ${escapeHtml(d.model_id)}
          </div>
        </td>
        <td>
          <div style="color:var(--text-secondary); font-size:12px;">${escapeHtml(d.os_build || 'Windows 11')}</div>
          <div style="font-size:11px; color:var(--text-muted); font-family:var(--font-mono);">BIOS: ${escapeHtml(d.bios_version || '—')}</div>
        </td>
        <td>
          <select class="fleet-inline-select" onchange="changeDeviceGroup('${escapeHtml(d.id)}', this.value)" title="Asignar directiva de grupo">
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
            <button type="button" class="export-btn" onclick="openDeviceAuditModal('${escapeHtml(d.id)}')" style="font-size:11px; padding:4px 10px;" title="Ver auditoría técnica de controladores">
              Auditoría
            </button>
            <button type="button" class="fleet-btn-primary" onclick="triggerDeviceDeployment('${escapeHtml(d.id)}')" ${pendingTotal === 0 ? 'disabled' : ''} style="font-size:11px; padding:4px 10px; font-weight:600;" title="${pendingTotal === 0 ? 'Equipo totalmente actualizado' : 'Enviar orden de actualización'}">
              Actualizar
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function changeDeviceGroup(deviceId, newGroup) {
  try {
    const res = await fetch(`/api/fleet/devices/${encodeURIComponent(deviceId)}/group`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group: newGroup })
    });

    if (!res.ok) throw new Error('Error al actualizar el grupo');
    const updated = await res.json();

    // Actualizar modelo local en memoria
    const found = allFleetDevices.find(d => d.id === deviceId);
    if (found) found.group_name = newGroup;

    showToast(`Grupo de '${found ? found.hostname : deviceId}' actualizado a '${newGroup}'`, 'info');
  } catch (err) {
    showToast('Error al cambiar grupo del equipo: ' + err.message, 'error');
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

// ================================================================
// Modal Detalle de Auditoría de Equipo
// ================================================================

async function openDeviceAuditModal(deviceId) {
  try {
    const res = await fetch(`/api/fleet/devices/${encodeURIComponent(deviceId)}`);
    if (!res.ok) throw new Error('Dispositivo no encontrado');
    const dev = await res.json();
    currentDeviceUnderAudit = dev;

    const modal = $('device-audit-modal');
    if (!modal) return;

    // Badges superiores
    const oemBadge = $('devmodal-oem-badge');
    if (oemBadge) {
      oemBadge.className = `tab-btn-pill ${dev.oem}`;
      oemBadge.textContent = dev.oem.toUpperCase();
    }

    const groupBadge = $('devmodal-group-badge');
    if (groupBadge) groupBadge.textContent = `Grupo: ${dev.group_name.toUpperCase()}`;

    const compBadge = $('devmodal-compliance-badge');
    if (compBadge) {
      compBadge.textContent = `${dev.compliance_rate}% CUMPLIMIENTO`;
      compBadge.className = dev.compliance_rate >= 90 ? 'admit-badge-lg admit' : (dev.compliance_rate >= 60 ? 'admit-badge-lg' : 'admit-badge-lg rejected');
    }

    // Título y subtítulo
    const titleEl = $('device-modal-title');
    if (titleEl) titleEl.textContent = dev.hostname;

    const subEl = $('devmodal-subtitle');
    if (subEl) subEl.textContent = `${dev.model_name} (${dev.model_id}) · IP: ${dev.ip_address || '—'} · BIOS: ${dev.bios_version || '—'}`;

    // Metadatos
    const osEl = $('devmodal-os');
    if (osEl) osEl.textContent = dev.os_build || 'Windows 11';

    const biosEl = $('devmodal-bios');
    if (biosEl) biosEl.textContent = dev.bios_version || '—';

    const statsEl = $('devmodal-stats-summary');
    if (statsEl) {
      const pendingCount = (dev.outdated_drivers || 0) + (dev.pending_drivers || 0);
      statsEl.textContent = `${dev.total_drivers || 0} analizados (${dev.uptodate_drivers || 0} al día, ${pendingCount} pendientes)`;
    }

    const lastSeenEl = $('devmodal-last-seen');
    if (lastSeenEl) lastSeenEl.textContent = formatTimeAgo(dev.last_seen);

    // Botón de despliegue
    const deployBtn = $('devmodal-deploy-btn');
    const pendingTotal = (dev.outdated_drivers || 0) + (dev.pending_drivers || 0);
    if (deployBtn) {
      deployBtn.disabled = pendingTotal === 0;
      deployBtn.textContent = pendingTotal === 0 ? 'Equipo Totalmente al Día' : `Actualizar ${pendingTotal} Controladores Pendientes`;
    }

    // Tabla de controladores
    const tbody = $('devmodal-drivers-tbody');
    if (tbody) {
      const drivers = dev.drivers || [];
      if (drivers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-muted);">No hay inventario de controladores registrado aún.</td></tr>`;
      } else {
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
                <div style="font-weight:600; color:var(--text-primary);">${escapeHtml(d.driver_name)}</div>
                ${d.download_url ? `<a href="${escapeHtml(d.download_url)}" target="_blank" rel="noopener noreferrer" style="font-size:11px; color:var(--accent-cyan); text-decoration:none;">Descarga Oficial (${escapeHtml(d.file_size || '—')}) ↗</a>` : ''}
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
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  } catch (err) {
    showToast('Error al abrir detalle del equipo: ' + err.message, 'error');
  }
}

function closeDeviceAuditModal() {
  const modal = $('device-audit-modal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}

function triggerDeviceAuditDeploy() {
  if (!currentDeviceUnderAudit) return;
  triggerDeviceDeployment(currentDeviceUnderAudit.id);
  closeDeviceAuditModal();
}

// ================================================================
// Gestión de Políticas y Configuración (Administración de Flota)
// ================================================================

let currentFleetSettings = {};

async function loadFleetSettings() {
  try {
    const res = await fetch('/api/fleet/settings');
    if (!res.ok) throw new Error('No se pudo cargar la configuración de políticas');
    const settings = await res.json();
    currentFleetSettings = settings;

    // 1. Modo maestro
    selectFleetModeCard(settings.fleet_mode || 'audit_only');

    // 2. Frecuencia y día del mes
    const scheduleMonthly = $('schedule-monthly');
    const scheduleManual = $('schedule-manual');
    if (settings.schedule_type === 'manual') {
      if (scheduleManual) scheduleManual.checked = true;
    } else {
      if (scheduleMonthly) scheduleMonthly.checked = true;
    }
    handleScheduleTypeChange(settings.schedule_type || 'monthly');

    const dayInput = $('settings-monthly-day');
    if (dayInput) dayInput.value = settings.monthly_day || 15;

    // 3. Checkboxes de seguridad
    const critCheckbox = $('settings-critical-only');
    if (critCheckbox) critCheckbox.checked = settings.critical_only !== false;

    const pilotCheckbox = $('settings-pilot-immediate');
    if (pilotCheckbox) pilotCheckbox.checked = settings.pilot_group_enabled !== false;

    // 4. Tablas por modelo y grupo
    renderModelPoliciesTable(settings.model_rules || {});
    renderGroupPoliciesTable(settings.group_rules || {});

    // Actualizar badge en barra superior
    updateNavModeBadge(settings.fleet_mode || 'audit_only');
  } catch (err) {
    console.error('Error cargando políticas de flota:', err);
    showToast('Error al conectar con el servidor de políticas', 'error');
  }
}

function updateNavModeBadge(mode) {
  const badge = $('nav-mode-badge');
  if (!badge) return;
  if (mode === 'audit_only') {
    badge.textContent = 'Solo Saber';
    badge.className = 'nav-mode-badge audit';
    badge.title = 'Flota en modo auditoría: sin instalaciones automáticas';
  } else {
    badge.textContent = 'Actualización Auto';
    badge.className = 'nav-mode-badge auto';
    badge.title = 'Flota en modo programado: actualizaciones automáticas activas';
  }
}

function selectFleetModeCard(mode) {
  const cardAudit = $('mode-card-audit');
  const cardScheduled = $('mode-card-scheduled');
  const radioAudit = $('fleet-mode-audit');
  const radioScheduled = $('fleet-mode-scheduled');

  if (mode === 'audit_only') {
    if (cardAudit) cardAudit.classList.add('selected');
    if (cardScheduled) cardScheduled.classList.remove('selected');
    if (radioAudit) radioAudit.checked = true;
  } else {
    if (cardAudit) cardAudit.classList.remove('selected');
    if (cardScheduled) cardScheduled.classList.add('selected');
    if (radioScheduled) radioScheduled.checked = true;
  }
}

function handleModeChange(mode) {
  selectFleetModeCard(mode);
}

function handleScheduleTypeChange(type) {
  const dayPicker = $('monthly-day-picker');
  if (dayPicker) {
    dayPicker.style.display = (type === 'monthly') ? 'block' : 'none';
  }
}

// Modelos por defecto para la matriz de políticas
const KNOWN_FLEET_MODELS = [
  { id: '20L5', name: 'ThinkPad T480', oem: 'lenovo' },
  { id: '20N2', name: 'ThinkPad T490', oem: 'lenovo' },
  { id: '20U1', name: 'ThinkPad L14 Gen 1', oem: 'lenovo' },
  { id: '20X1', name: 'ThinkPad L14 Gen 2', oem: 'lenovo' },
  { id: '888A', name: 'HP ProBook 440 G8', oem: 'hp' },
  { id: '8A4E', name: 'HP ProBook 440 G9', oem: 'hp' },
  { id: '880D', name: 'HP EliteBook 840 G7', oem: 'hp' },
  { id: '8936', name: 'HP EliteBook 840 G8', oem: 'hp' },
];

function renderModelPoliciesTable(modelRules) {
  const tbody = $('models-policies-tbody');
  if (!tbody) return;

  tbody.innerHTML = KNOWN_FLEET_MODELS.map(m => {
    const rule = modelRules[m.id] || { enabled: true, criticalOnly: true };
    const isEnabled = rule.enabled !== false;
    const isCritical = rule.criticalOnly !== false;

    return `
      <tr>
        <td>
          <span style="font-weight:600; color:var(--text-primary);">${escapeHtml(m.name)}</span>
        </td>
        <td>
          <code class="font-mono text-cyan" style="font-size:12px;">${escapeHtml(m.id)}</code>
        </td>
        <td>
          <span class="tab-btn-pill ${m.oem}" style="font-size:10px; padding:2px 6px;">${m.oem.toUpperCase()}</span>
        </td>
        <td>
          <label class="toggle-switch">
            <input type="checkbox" id="model-toggle-${m.id}" ${isEnabled ? 'checked' : ''} onchange="updateModelRowStatus('${m.id}')" />
            <span class="toggle-slider"></span>
          </label>
        </td>
        <td>
          <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer;">
            <input type="checkbox" id="model-crit-${m.id}" ${isCritical ? 'checked' : ''} />
            <span style="font-size:12px; color:var(--text-secondary);">Solo Críticos</span>
          </label>
        </td>
        <td id="model-status-cell-${m.id}">
          ${isEnabled 
            ? '<span class="status-pill compliant" style="font-size:11px;">Actualizaciones Habilitadas</span>' 
            : '<span class="status-pill outdated" style="font-size:11px;">Pausado / Solo Saber</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

function updateModelRowStatus(modelId) {
  const toggle = $(`model-toggle-${modelId}`);
  const statusCell = $(`model-status-cell-${modelId}`);
  if (!toggle || !statusCell) return;

  if (toggle.checked) {
    statusCell.innerHTML = '<span class="status-pill compliant" style="font-size:11px;">Actualizaciones Habilitadas</span>';
  } else {
    statusCell.innerHTML = '<span class="status-pill outdated" style="font-size:11px;">Pausado / Solo Saber</span>';
  }
}

const KNOWN_GROUPS = [
  { id: 'pilot', name: 'Grupo Piloto / IT', desc: 'Validación previa de parches e instalación inmediata sin esperar ventana.' },
  { id: 'general', name: 'Grupo General / Producción', desc: 'Despliegue ordenado en la ventana mensual programada (día seleccionado).' },
  { id: 'vip', name: 'Grupo VIP / Dirección', desc: 'Siempre en modo auditoría (sin reinicios ni modificaciones en segundo plano).' },
];

function renderGroupPoliciesTable(groupRules) {
  const tbody = $('groups-policies-tbody');
  if (!tbody) return;

  tbody.innerHTML = KNOWN_GROUPS.map(g => {
    const rule = groupRules[g.id] || { enabled: g.id !== 'vip', immediate: g.id === 'pilot' };
    const isEnabled = rule.enabled !== false;

    let windowText = 'Ventana Mensual (Día 15)';
    if (g.id === 'pilot') windowText = 'Inmediata (Sin Espera)';
    else if (!isEnabled || g.id === 'vip') windowText = 'Pausado / Solo Auditoría';

    return `
      <tr>
        <td><strong style="color:var(--text-primary);">${escapeHtml(g.name)}</strong></td>
        <td><code class="font-mono text-muted">${escapeHtml(g.id)}</code></td>
        <td>
          <label class="toggle-switch">
            <input type="checkbox" id="group-toggle-${g.id}" ${isEnabled ? 'checked' : ''} />
            <span class="toggle-slider"></span>
          </label>
        </td>
        <td style="font-size:12px; color:var(--accent-cyan); font-weight:500;">
          ${windowText}
        </td>
        <td style="font-size:12px; color:var(--text-secondary); max-width:320px;">
          ${escapeHtml(g.desc)}
        </td>
      </tr>
    `;
  }).join('');
}

async function saveFleetSettings() {
  const saveBtn = $('save-settings-btn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';
  }

  try {
    // 1. Recopilar modo maestro
    const modeAuditRadio = $('fleet-mode-audit');
    const fleet_mode = (modeAuditRadio && modeAuditRadio.checked) ? 'audit_only' : 'scheduled';

    // 2. Frecuencia y día
    const scheduleManualRadio = $('schedule-manual');
    const schedule_type = (scheduleManualRadio && scheduleManualRadio.checked) ? 'manual' : 'monthly';
    const monthly_day = parseInt($('settings-monthly-day')?.value, 10) || 15;

    // 3. Filtros
    const critical_only = $('settings-critical-only')?.checked !== false;
    const pilot_group_enabled = $('settings-pilot-immediate')?.checked !== false;

    // 4. Modelos
    const model_rules = {};
    KNOWN_FLEET_MODELS.forEach(m => {
      const toggle = $(`model-toggle-${m.id}`);
      const crit = $(`model-crit-${m.id}`);
      model_rules[m.id] = {
        name: m.name,
        enabled: toggle ? toggle.checked : true,
        criticalOnly: crit ? crit.checked : true,
      };
    });

    // 5. Grupos
    const group_rules = {};
    KNOWN_GROUPS.forEach(g => {
      const toggle = $(`group-toggle-${g.id}`);
      group_rules[g.id] = {
        name: g.name,
        enabled: toggle ? toggle.checked : (g.id !== 'vip'),
        immediate: g.id === 'pilot',
      };
    });

    const payload = {
      fleet_mode,
      schedule_type,
      monthly_day,
      critical_only,
      pilot_group_enabled,
      model_rules,
      group_rules,
    };

    const res = await fetch('/api/fleet/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error('Error al guardar en el servidor');
    const data = await res.json();
    currentFleetSettings = data.settings;

    updateNavModeBadge(fleet_mode);
    showToast('Políticas de flota guardadas y aplicadas exitosamente', 'success', 4000);
  } catch (err) {
    console.error('Error al guardar políticas:', err);
    showToast('Error al guardar políticas: ' + err.message, 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Guardar Todas las Políticas';
    }
  }
}

function resetSettingsToDefaults() {
  if (!confirm('¿Deseas restablecer las políticas a los valores predeterminados seguros (Modo Solo Saber, ventana mensual día 15, solo parches críticos)?')) return;

  selectFleetModeCard('audit_only');
  const scheduleMonthly = $('schedule-monthly');
  if (scheduleMonthly) scheduleMonthly.checked = true;
  handleScheduleTypeChange('monthly');

  const dayInput = $('settings-monthly-day');
  if (dayInput) dayInput.value = 15;

  const critCheckbox = $('settings-critical-only');
  if (critCheckbox) critCheckbox.checked = true;

  const pilotCheckbox = $('settings-pilot-immediate');
  if (pilotCheckbox) pilotCheckbox.checked = true;

  KNOWN_FLEET_MODELS.forEach(m => {
    const toggle = $(`model-toggle-${m.id}`);
    const crit = $(`model-crit-${m.id}`);
    if (toggle) toggle.checked = m.id !== '880D';
    if (crit) crit.checked = true;
    updateModelRowStatus(m.id);
  });

  KNOWN_GROUPS.forEach(g => {
    const toggle = $(`group-toggle-${g.id}`);
    if (toggle) toggle.checked = g.id !== 'vip';
  });

  showToast('Valores predeterminados cargados en el formulario. Pulsa Guardar para confirmar.', 'info');
}

// ================================================================
// Modal de Enrolamiento y Despliegue de Agente (Intune)
// ================================================================

function getAgentServerHost() {
  const customHost = ($('agent-server-host-input')?.value || '').trim();
  if (customHost) {
    if (customHost.startsWith('http://') || customHost.startsWith('https://')) {
      return customHost;
    }
    return `https://${customHost}`;
  }
  return window.location.origin;
}

function updateAgentEnrollCommandString() {
  const serverUrl = getAgentServerHost();
  const cmd = `powershell -ExecutionPolicy Bypass -Command "irm ${serverUrl}/api/agent/install | iex"`;
  const display = $('agent-enroll-cmd-display');
  if (display) display.textContent = cmd;
}

function openAgentEnrollModal() {
  const hostInput = $('agent-server-host-input');
  if (hostInput && !hostInput.value) {
    hostInput.placeholder = window.location.origin;
  }
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
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(cmd).then(() => {
      onAgentCommandCopied(btn);
    }).catch(() => fallbackAgentCopy(cmd, btn));
  } else {
    fallbackAgentCopy(cmd, btn);
  }
}

function fallbackAgentCopy(text, btn) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    onAgentCommandCopied(btn);
  } catch {
    showToast('Selecciona el comando manualmente para copiar', 'error');
  }
}

function onAgentCommandCopied(btn) {
  showToast('Comando de registro del agente copiado al portapapeles', 'success');
  if (btn) {
    const oldText = btn.textContent;
    btn.textContent = '¡Copiado!';
    setTimeout(() => { btn.textContent = oldText; }, 2500);
  }
}

function downloadAgentInstallScript() {
  const serverUrl = getAgentServerHost();
  const url = `${serverUrl}/api/agent/install`;
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Instalar-OEM-Agent.ps1';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Descargando script de enrolamiento de agente...', 'info');
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
// Inicialización
// ================================================================

function init() {
  const tabLenovo = $('tab-lenovo');
  const tabHp = $('tab-hp');
  if (tabLenovo) tabLenovo.addEventListener('click', () => selectOEM('lenovo'));
  if (tabHp)     tabHp.addEventListener('click', () => selectOEM('hp'));

  const fleetSelect = $('fleet-model-select');
  if (fleetSelect) {
    fleetSelect.addEventListener('change', (e) => {
      handleFleetSelection(e.target.value);
    });
  }

  const searchBtn = $('search-btn');
  if (searchBtn) {
    searchBtn.disabled = false;
    searchBtn.addEventListener('click', () => {
      triggerSearch();
    });
  }

  const searchInput = $('search-id-input');
  if (searchInput) {
    searchInput.addEventListener('input', handleSearchInput);
    searchInput.addEventListener('keydown', handleSearchKeydown);
    searchInput.addEventListener('focus', handleSearchFocus);
  }

  // Listeners directos para los filtros de la barra
  const filterCat = $('filter-category');
  if (filterCat) filterCat.addEventListener('change', () => applyFilters());

  const filterAdmitted = $('filter-windows-admitted');
  if (filterAdmitted) filterAdmitted.addEventListener('change', () => applyFilters());

  const filterIntune = $('filter-intune');
  if (filterIntune) filterIntune.addEventListener('change', () => applyFilters());

  const filterOsBuild = $('filter-os-build');
  if (filterOsBuild) filterOsBuild.addEventListener('change', () => applyFilters());

  const filterText = $('filter-text');
  if (filterText) {
    filterText.addEventListener('input', () => applyFilters());
    filterText.addEventListener('search', () => applyFilters());
  }

  const filterCritical = $('filter-critical');
  if (filterCritical) filterCritical.addEventListener('change', () => applyFilters());

  const termBtn = $('terminal-cmd-btn');
  if (termBtn) {
    termBtn.disabled = false;
    termBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openTerminalCommandModal();
    });
  }

  const termCloseBtn = $('terminal-modal-close-btn');
  if (termCloseBtn) {
    termCloseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeTerminalCommandModal();
    });
  }

  const termXBtn = $('terminal-modal-x-btn');
  if (termXBtn) {
    termXBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeTerminalCommandModal();
    });
  }

  // Listeners directos para pestañas de navegación principal (SPA)
  const navBtnCatalog = $('nav-btn-catalog');
  if (navBtnCatalog) {
    navBtnCatalog.addEventListener('click', (e) => {
      e.preventDefault();
      switchMainView('catalog');
    });
  }

  const navBtnFleet = $('nav-btn-fleet');
  if (navBtnFleet) {
    navBtnFleet.addEventListener('click', (e) => {
      e.preventDefault();
      switchMainView('fleet');
    });
  }

  const navBtnSettings = $('nav-btn-settings');
  if (navBtnSettings) {
    navBtnSettings.addEventListener('click', (e) => {
      e.preventDefault();
      switchMainView('settings');
    });
  }

  // Inicializa en Lenovo
  selectOEM('lenovo');

  // Inicializar datos de flota y políticas en segundo plano
  loadFleetData(false);
  loadFleetSettings();

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePatchModal();
      closeTerminalCommandModal();
      closeDeviceAuditModal();
      closeAgentEnrollModal();
    }
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
      e.preventDefault();
      if ($('search-id-input')) $('search-id-input').focus();
    }
  });
}

// Exponer todas las funciones al objeto global window para invocaciones inline desde HTML
window.switchMainView = switchMainView;
window.loadFleetData = loadFleetData;
window.filterFleetTable = filterFleetTable;
window.changeDeviceGroup = changeDeviceGroup;
window.triggerDeviceDeployment = triggerDeviceDeployment;
window.openDeviceAuditModal = openDeviceAuditModal;
window.closeDeviceAuditModal = closeDeviceAuditModal;
window.triggerDeviceAuditDeploy = triggerDeviceAuditDeploy;
window.loadFleetSettings = loadFleetSettings;
window.saveFleetSettings = saveFleetSettings;
window.resetSettingsToDefaults = resetSettingsToDefaults;
window.selectFleetModeCard = selectFleetModeCard;
window.handleModeChange = handleModeChange;
window.handleScheduleTypeChange = handleScheduleTypeChange;
window.updateModelRowStatus = updateModelRowStatus;
window.openAgentEnrollModal = openAgentEnrollModal;
window.closeAgentEnrollModal = closeAgentEnrollModal;
window.updateAgentEnrollCommandString = updateAgentEnrollCommandString;
window.copyAgentEnrollCommand = copyAgentEnrollCommand;
window.resetAgentServerHost = resetAgentServerHost;
window.downloadAgentInstallScript = downloadAgentInstallScript;
window.selectOEM = selectOEM;
window.handleFleetSelection = handleFleetSelection;
window.triggerSearch = triggerSearch;
window.openPatchModal = openPatchModal;
window.closePatchModal = closePatchModal;
window.openTerminalCommandModal = openTerminalCommandModal;
window.closeTerminalCommandModal = closeTerminalCommandModal;
window.copyTerminalCommand = copyTerminalCommand;
window.downloadPowerShellScript = downloadPowerShellScript;

document.addEventListener('DOMContentLoaded', init);

