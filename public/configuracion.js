/**
 * configuracion.js
 * Lógica dedicada para la administración de políticas de flota.
 */

'use strict';

const $ = (id) => document.getElementById(id);

const KNOWN_MODELS = [
  { id: '20W7', oem: 'Lenovo', name: 'ThinkPad L14 Gen 2 Intel' },
  { id: '20L5', oem: 'Lenovo', name: 'ThinkPad T480' },
  { id: '20N2', oem: 'Lenovo', name: 'ThinkPad T490' },
  { id: '20U1', oem: 'Lenovo', name: 'ThinkPad L14 Gen 1' },
  { id: '888A', oem: 'HP', name: 'HP ProBook 440 G8' },
  { id: '8A4E', oem: 'HP', name: 'HP ProBook 440 G9' },
  { id: '880D', oem: 'HP', name: 'HP EliteBook 840 G7' }
];

let currentSettings = {};

function showToast(message, type = 'info', duration = 3500) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.className = 'toast'; }, duration);
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

async function loadSettings() {
  try {
    const res = await fetch('/api/fleet/settings');
    if (!res.ok) throw new Error('Error al consultar configuración');
    const settings = await res.json();
    currentSettings = settings;

    // 1. Modo
    selectFleetModeCard(settings.fleet_mode || 'audit_only');

    // 2. Calendario
    if (settings.schedule_type === 'manual') {
      const el = $('schedule-manual');
      if (el) el.checked = true;
    } else {
      const el = $('schedule-monthly');
      if (el) el.checked = true;
    }

    const dayEl = $('settings-monthly-day');
    if (dayEl) dayEl.value = settings.monthly_day || 15;

    const critEl = $('settings-critical-only');
    if (critEl) critEl.checked = settings.critical_only !== false;

    const pilotEl = $('settings-pilot-immediate');
    if (pilotEl) pilotEl.checked = settings.pilot_group_enabled !== false;

    // 3. Tabla de modelos
    renderModelsTable(settings.model_rules || {});
  } catch (err) {
    showToast('Error cargando configuración: ' + err.message, 'error');
  }
}

function renderModelsTable(rules) {
  const tbody = $('models-policies-tbody');
  if (!tbody) return;

  tbody.innerHTML = KNOWN_MODELS.map(m => {
    const r = rules[m.id] || { enabled: true, criticalOnly: true };
    const isChecked = r.enabled !== false;

    return `
      <tr>
        <td><strong>${m.name}</strong></td>
        <td><span class="tab-btn-pill ${m.oem.toLowerCase()}" style="font-size:10px; padding:1px 6px;">${m.oem}</span></td>
        <td class="font-mono" style="color:var(--accent-cyan); font-weight:600;">${m.id}</td>
        <td>
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
            <input type="checkbox" id="model-enabled-${m.id}" ${isChecked ? 'checked' : ''} />
            <span style="font-size:13px;">${isChecked ? 'Actualizaciones Permitidas' : 'Pausado (Solo Auditoría)'}</span>
          </label>
        </td>
        <td>
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
            <input type="checkbox" id="model-crit-${m.id}" ${r.criticalOnly !== false ? 'checked' : ''} />
            <span style="font-size:12px; color:var(--text-secondary);">Solo Parches Críticos</span>
          </label>
        </td>
      </tr>
    `;
  }).join('');
}

async function saveFleetSettings() {
  const saveBtn = $('save-settings-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Guardando...'; }

  try {
    const fleet_mode = $('fleet-mode-scheduled')?.checked ? 'scheduled' : 'audit_only';
    const schedule_type = $('schedule-manual')?.checked ? 'manual' : 'monthly';
    const monthly_day = parseInt($('settings-monthly-day')?.value, 10) || 15;
    const critical_only = $('settings-critical-only')?.checked !== false;
    const pilot_group_enabled = $('settings-pilot-immediate')?.checked !== false;

    const model_rules = {};
    KNOWN_MODELS.forEach(m => {
      const enabled = $(`model-enabled-${m.id}`)?.checked !== false;
      const crit = $(`model-crit-${m.id}`)?.checked !== false;
      model_rules[m.id] = { enabled, criticalOnly: crit, name: m.name };
    });

    const payload = {
      fleet_mode,
      schedule_type,
      monthly_day,
      critical_only,
      pilot_group_enabled,
      model_rules
    };

    const res = await fetch('/api/fleet/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error('Error al guardar en el servidor');
    showToast('Políticas guardadas y aplicadas con éxito', 'success');
  } catch (err) {
    showToast('Error al guardar: ' + err.message, 'error');
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Guardar Políticas'; }
  }
}

function resetSettingsToDefaults() {
  if (!confirm('¿Deseas restablecer a valores recomendados seguros?')) return;
  selectFleetModeCard('audit_only');
  if ($('schedule-monthly')) $('schedule-monthly').checked = true;
  if ($('settings-monthly-day')) $('settings-monthly-day').value = 15;
  if ($('settings-critical-only')) $('settings-critical-only').checked = true;
  if ($('settings-pilot-immediate')) $('settings-pilot-immediate').checked = true;
  showToast('Valores restablecidos en el formulario. Pulsa Guardar para confirmar.', 'info');
}

window.selectFleetModeCard = selectFleetModeCard;
window.saveFleetSettings = saveFleetSettings;
window.resetSettingsToDefaults = resetSettingsToDefaults;

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();

  const saveBtn = $('save-settings-btn');
  if (saveBtn) saveBtn.addEventListener('click', saveFleetSettings);

  const resetBtn = $('reset-settings-btn');
  if (resetBtn) resetBtn.addEventListener('click', resetSettingsToDefaults);
});
