document.addEventListener('DOMContentLoaded', () => {
  // Tabs Navigation
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-target');
      document.getElementById(targetId).classList.add('active');

      if (targetId === 'tab-baselines') loadBaselines();
      if (targetId === 'tab-rings') loadRings();
    });
  });

  // Initial Load
  loadBaselines();
  
  // Forms submit
  document.getElementById('form-baseline').addEventListener('submit', saveBaseline);
  document.getElementById('form-ring').addEventListener('submit', saveRing);
  
  const ringFreq = document.getElementById('ring-frequency');
  if(ringFreq) ringFreq.addEventListener('change', toggleTimeInputs);
});

// --- BASELINES ---
let currentBaselines = [];
let currentBaselineUpdates = [];

async function loadBaselines() {
  try {
    const res = await fetch('/api/baselines', { headers: { 'Authorization': `Bearer ${localStorage.getItem('oem_admin_token')}` } });
    if (!res.ok) throw new Error('Error cargando baselines');
    const baselines = await res.json();
    currentBaselines = baselines;

    const tbody = document.getElementById('baselines-tbody');
    tbody.innerHTML = '';

    if (baselines.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay modelos de hardware detectados aún.</td></tr>';
      return;
    }

    baselines.forEach(b => {
      let badgeClass = 'badge-green';
      let badgeText = 'Activo';
      
      if (b.status === 'Quarantine') {
        badgeClass = 'badge-yellow';
        badgeText = 'Cuarentena';
      } else if (b.status === 'Revoked') {
        badgeClass = 'badge-red';
        badgeText = 'Revocado';
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${b.friendly_name || b.model_name}</strong></td>
        <td><span class="badge ${badgeClass}">${badgeText}</span></td>
        <td>${b.block_windows_update ? 'Sí' : 'No'}</td>
        <td>${b.require_critical_only ? 'Sí' : 'No'}</td>
        <td style="text-align:right;">
          <button class="fleet-btn-secondary" onclick="openBaselineModal('${b.id}')">Configurar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error(error);
  }
}

async function openBaselineModal(id) {
  const b = currentBaselines.find(x => x.id === id);
  if (!b) return;

  document.getElementById('baseline-id').value = b.id;
  document.getElementById('baseline-model-name').textContent = `Modelo: ${b.friendly_name || b.model_name}`;
  document.getElementById('baseline-status').value = b.status;
  document.getElementById('baseline-critical').checked = Boolean(b.require_critical_only);
  document.getElementById('baseline-winupdate').checked = Boolean(b.block_windows_update);

  document.getElementById('modal-baseline').classList.add('open');
  
  // Cargar drivers aprobados/disponibles
  const container = document.getElementById('baseline-drivers-container');
  if (container) {
    container.innerHTML = '<div style="padding:16px; text-align:center; color:var(--text-secondary); font-size:13px;">Cargando drivers del catálogo oficial...</div>';
    try {
      const res = await fetch(`/api/baselines/${id}/updates`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('oem_admin_token')}` } });
      if (!res.ok) throw new Error('Failed to load drivers');
      const data = await res.json();
      currentBaselineUpdates = data.updates || [];
      renderBaselineDrivers();
    } catch(e) {
      container.innerHTML = '<div style="padding:16px; text-align:center; color:red; font-size:13px;">Error cargando drivers</div>';
    }
  }
}

function renderBaselineDrivers(filterText = '') {
  const container = document.getElementById('baseline-drivers-container');
  if (!container) return;
  container.innerHTML = '';
  
  if (currentBaselineUpdates.length === 0) {
    container.innerHTML = '<div style="padding:16px; text-align:center; color:var(--text-secondary); font-size:13px;">No hay drivers disponibles para este modelo.</div>';
    return;
  }
  
  const text = filterText.toLowerCase();
  const filtered = currentBaselineUpdates.filter(d => d.name.toLowerCase().includes(text) || d.category.toLowerCase().includes(text));
  
    const isCriticalOnly = document.getElementById('baseline-critical').checked;
  const isBlockWU = document.getElementById('baseline-winupdate').checked;

  filtered.forEach(d => {
    let checked = d.is_approved;
    let disabled = false;
    
    const isCritical = d.severity.toLowerCase().includes('cr');
    const isWU = d.category.toLowerCase().includes('windows update') || d.name.toLowerCase().includes('windows update') || d.category.toLowerCase().includes('wu');

    if (isCriticalOnly && !isCritical) {
      checked = false;
      disabled = true;
    }
    
    if (isBlockWU && isWU) {
      checked = false;
      disabled = true;
    }

    const isChecked = checked ? 'checked' : '';
    const isDisabled = disabled ? 'disabled' : '';
    const severityColor = d.severity.toLowerCase().includes('cr') ? 'red' : (d.severity.toLowerCase().includes('recom') ? 'orange' : 'green');
    
    container.innerHTML += `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; border-bottom:1px solid #f0f0f0;">
        <div style="display:flex; flex-direction:column; max-width: 80%;">
          <span style="font-size:13px; font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${d.name}</span>
          <div style="display:flex; gap:8px; margin-top:4px;">
            <span style="font-size:11px; background:#f1f5f9; padding:2px 6px; border-radius:10px; color:var(--text-secondary);">${d.category}</span>
            <span style="font-size:11px; background:#f1f5f9; padding:2px 6px; border-radius:10px; color:${severityColor};">${d.severity}</span>
            <span style="font-size:11px; background:#f1f5f9; padding:2px 6px; border-radius:10px; color:var(--text-secondary);">${d.version || 'v?'}</span>
          </div>
        </div>
        <label class="toggle-row" style="margin:0;">
          <input type="checkbox" class="baseline-driver-checkbox" data-id="${d.id}" data-name="${d.name}" ${isChecked} ${isDisabled} />
        </label>
      </div>
    `;
  });
}

function filterBaselineDrivers() {
  const query = document.getElementById('baseline-driver-search').value;
  renderBaselineDrivers(query);
}

function closeBaselineModal() {
  document.getElementById('modal-baseline').classList.remove('open');
}

async function saveBaseline(e) {
  e.preventDefault();
  const id = document.getElementById('baseline-id').value;
  const payload = {
    status: document.getElementById('baseline-status').value,
    require_critical_only: document.getElementById('baseline-critical').checked ? 1 : 0,
    block_windows_update: document.getElementById('baseline-winupdate').checked ? 1 : 0
  };

  // Recoger drivers aprobados en la UI
  document.querySelectorAll('.baseline-driver-checkbox').forEach(cb => {
    const updateId = cb.getAttribute('data-id');
    const u = currentBaselineUpdates.find(x => x.id === updateId);
    if (u) u.is_approved = cb.checked;
  });
  
  const approved_updates = currentBaselineUpdates.filter(u => u.is_approved).map(u => ({ id: u.id, name: u.name }));

  try {
    const res = await fetch(`/api/baselines/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('oem_admin_token')}`
      },
      body: JSON.stringify(payload)
    });
    
    if (res.ok) {
      // Guardar aprobaciones
      await fetch(`/api/baselines/${id}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('oem_admin_token')}` },
        body: JSON.stringify({ approved_updates })
      });
      
      closeBaselineModal();
      loadBaselines();
    }
  } catch (error) {
    console.error('Error al guardar baseline', error);
  }
}

// --- RINGS ---
let currentRings = [];

async function loadRings() {
  try {
    const res = await fetch('/api/rings', { headers: { 'Authorization': `Bearer ${localStorage.getItem('oem_admin_token')}` } });
    if (!res.ok) throw new Error('Error cargando anillos');
    const rings = await res.json();
    currentRings = rings;

    const container = document.getElementById('rings-container');
    container.innerHTML = '';

    if (rings.length === 0) {
      container.innerHTML = '<p>No hay anillos configurados.</p>';
      return;
    }

    rings.forEach(r => {
      const card = document.createElement('div');
      card.className = 'ring-card';
      
      const canaryBadge = r.is_canary ? `<span class="badge badge-yellow" style="margin-left:8px;">Canary / Piloto</span>` : '';
      
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
          <h3 style="margin:0; font-size:16px; font-weight:600;">${r.name} ${canaryBadge}</h3>
          <button class="fleet-btn-secondary" onclick="openRingModal('${r.id}')" style="padding:4px 8px; font-size:12px;">Editar</button>
        </div>
        <div style="font-size:13px; color:var(--text-secondary); line-height:1.5;">
          <p><strong>Frecuencia:</strong> ${r.frequency === 'monthly' ? 'Mensual' : (r.frequency === 'disabled' ? 'Desactivado' : 'Semanal')}</p>
          <p><strong>Día:</strong> ${r.install_day}</p>
          <p><strong>Ventana:</strong> ${r.time_window_start} - ${r.time_window_end}</p>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (error) {
    console.error(error);
  }
}

async function openRingModal(id = null) {
  if (id) {
    const r = currentRings.find(x => x.id === id);
    if (!r) return;
    document.getElementById('ring-id').value = r.id;
    document.getElementById('ring-name').value = r.name;
    document.getElementById('ring-day').value = r.install_day;
    document.getElementById('ring-start').value = r.time_window_start;
    document.getElementById('ring-end').value = r.time_window_end;
    document.getElementById('ring-canary').checked = Boolean(r.is_canary);
    
    const freqEl = document.getElementById('ring-frequency');
    if (freqEl) freqEl.value = r.frequency || 'weekly';
    const manualEl = document.getElementById('ring-manual');
    if (manualEl) manualEl.checked = Boolean(r.allow_manual_update);
  } else {
    document.getElementById('form-ring').reset();
    document.getElementById('ring-id').value = '';
    const freqEl = document.getElementById('ring-frequency');
    if (freqEl) freqEl.value = 'weekly';
  }
  
  toggleTimeInputs();
  await loadMachinesIntoModal(id);

  document.getElementById('modal-ring').classList.add('open');
}

async function loadMachinesIntoModal(ringId) {
  const container = document.getElementById('ring-machines-container');
  if (!container) return;
  container.innerHTML = 'Cargando equipos...';
  try {
    const res = await fetch('/api/fleet/devices', { headers: { 'Authorization': `Bearer ${localStorage.getItem('oem_admin_token')}` } });
    if (!res.ok) throw new Error('Error al cargar equipos');
    const devices = await res.json();
    
    if (devices.length === 0) {
      container.innerHTML = '<span style="color:var(--text-secondary); font-size:13px;">No hay equipos en la flota.</span>';
      return;
    }

    container.innerHTML = '';
    devices.forEach(d => {
      const isChecked = ringId && d.ring_id === ringId;
      const label = document.createElement('label');
      label.style.display = 'flex';
      label.style.alignItems = 'center';
      label.style.gap = '8px';
      label.style.fontSize = '13px';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = d.id;
      checkbox.className = 'ring-machine-checkbox';
      if (isChecked) checkbox.checked = true;
      
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(`${d.hostname} (${d.model_name})`));
      container.appendChild(label);
    });
  } catch (error) {
    container.innerHTML = '<span style="color:red; font-size:13px;">Error al cargar equipos</span>';
  }
}

function toggleTimeInputs() {
  const freqEl = document.getElementById('ring-frequency');
  if (!freqEl) return;
  const freq = freqEl.value;
  const timeContainer = document.getElementById('time-window-container');
  const daySelect = document.getElementById('ring-day');
  if (freq === 'disabled') {
    if (timeContainer) timeContainer.style.display = 'none';
    if (daySelect) daySelect.disabled = true;
  } else {
    if (timeContainer) timeContainer.style.display = 'flex';
    if (daySelect) daySelect.disabled = false;
  }
}

function closeRingModal() {
  document.getElementById('modal-ring').classList.remove('open');
}

async function saveRing(e) {
  e.preventDefault();
  const id = document.getElementById('ring-id').value;
  
  const assignedMachines = Array.from(document.querySelectorAll('.ring-machine-checkbox:checked')).map(cb => cb.value);

  const payload = {
    name: document.getElementById('ring-name').value,
    install_day: document.getElementById('ring-day').value,
    time_window_start: document.getElementById('ring-start').value,
    time_window_end: document.getElementById('ring-end').value,
    is_canary: document.getElementById('ring-canary').checked ? 1 : 0,
    frequency: document.getElementById('ring-frequency') ? document.getElementById('ring-frequency').value : 'weekly',
    allowManualUpdate: document.getElementById('ring-manual') ? document.getElementById('ring-manual').checked : false,
    assignedMachines
  };

  const method = id ? 'PUT' : 'POST';
  const url = id ? `/api/rings/${id}` : '/api/rings';

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('oem_admin_token')}`
      },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      closeRingModal();
      loadRings();
    }
  } catch (error) {
    console.error('Error al guardar anillo', error);
  }
}


document.getElementById('baseline-critical').addEventListener('change', () => {
  renderBaselineDrivers(document.getElementById('baseline-driver-search').value);
});
document.getElementById('baseline-winupdate').addEventListener('change', () => {
  renderBaselineDrivers(document.getElementById('baseline-driver-search').value);
});


// Añadido: Función para filtrar los equipos en el modal de anillos
window.filterRingMachines = function() {
  const input = document.getElementById('ring-machine-search');
  if (!input) return;
  const filter = input.value.toLowerCase();
  const container = document.getElementById('ring-machines-container');
  if (!container) return;
  const labels = container.getElementsByTagName('label');
  for (let i = 0; i < labels.length; i++) {
    const text = labels[i].textContent || labels[i].innerText;
    if (text.toLowerCase().indexOf(filter) > -1) {
      labels[i].style.display = 'flex';
    } else {
      labels[i].style.display = 'none';
    }
  }
};
