/**
 * configuracion.js
 * Lógica dedicada para la administración de políticas de flota,
 * ventanas de actualización programada y anillos de despliegue.
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

const BASE_MODELS = [
  { id: '20W7', oem: 'lenovo', name: 'ThinkPad L14 Gen 2 Intel' },
  { id: '20L5', oem: 'lenovo', name: 'ThinkPad T480' },
  { id: '20N2', oem: 'lenovo', name: 'ThinkPad T490' },
  { id: '20U1', oem: 'lenovo', name: 'ThinkPad L14 Gen 1' },
  { id: '888A', oem: 'hp', name: 'HP ProBook 440 G8' },
  { id: '8A4E', oem: 'hp', name: 'HP ProBook 440 G9' },
  { id: '880D', oem: 'hp', name: 'HP EliteBook 840 G7' },
  { id: '8936', oem: 'hp', name: 'HP EliteBook 840 G8' }
];

const BASE_GROUPS = [
  { id: 'pilot', name: 'Grupo Piloto / IT', desc: 'Validación temprana y anillo 1. Permite despliegue anticipado inmediato para comprobar estabilidad de parches.' },
  { id: 'general', name: 'Grupo General / Producción', desc: 'Anillo corporativo estándar. Despliegue ordenado según la ventana de mantenimiento configurada.' },
  { id: 'vip', name: 'Grupo VIP / Dirección', desc: 'Anillo de máxima restricción. Funciona por defecto en modo Solo Auditoría para evitar cualquier interrupción o reinicio.' }
];

let currentSettings = {};
let allKnownModels = [...BASE_MODELS];
let groupCountsMap = { pilot: 0, general: 0, vip: 0 };
let detectedModelsMap = {};

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
  const navBadge = $('nav-mode-badge');

  if (mode === 'audit_only') {
    if (cardAudit) cardAudit.classList.add('selected');
    if (cardScheduled) cardScheduled.classList.remove('selected');
    if (radioAudit) radioAudit.checked = true;
    if (navBadge) {
      navBadge.textContent = 'Solo Saber';
      navBadge.className = 'nav-mode-badge audit';
    }
  } else {
    if (cardAudit) cardAudit.classList.remove('selected');
    if (cardScheduled) cardScheduled.classList.add('selected');
    if (radioScheduled) radioScheduled.checked = true;
    if (navBadge) {
      navBadge.textContent = 'Actualización Automática';
      navBadge.className = 'nav-mode-badge scheduled';
    }
  }

  updateActiveBannerPreview();
}

function updateActiveBannerPreview() {
  const isScheduled = $('fleet-mode-scheduled')?.checked;
  const indicator = $('active-banner-indicator');
  const title = $('active-banner-title');
  const pill = $('active-banner-pill');
  const desc = $('active-banner-desc');
  const windowEl = $('active-banner-window');

  if (isScheduled) {
    if (indicator) {
      indicator.style.background = 'var(--ms-admitted)';
      indicator.style.boxShadow = '0 0 10px var(--ms-admitted)';
    }
    if (title) title.textContent = 'MODO: ACTUALIZACIÓN PROGRAMADA ACTIVA';
    if (pill) {
      pill.textContent = 'AUTOMATIZADO';
      pill.className = 'status-pill critical';
    }
    if (desc) {
      desc.textContent = 'Los equipos cliente aplican automáticamente los parches y firmware autorizados según la ventana y anillos de riesgo configurados.';
    }

    const schedType = $('schedule-continuous')?.checked ? 'continuous' : ($('schedule-manual')?.checked ? 'manual' : 'monthly');
    if (windowEl) {
      if (schedType === 'continuous') windowEl.textContent = 'En Cada Check-in';
      else if (schedType === 'monthly') windowEl.textContent = `Día ${$('settings-monthly-day')?.value || 15} de cada mes`;
      else windowEl.textContent = 'Manual Bajo Demanda';
    }
  } else {
    if (indicator) {
      indicator.style.background = 'var(--accent-cyan)';
      indicator.style.boxShadow = '0 0 10px var(--accent-cyan)';
    }
    if (title) title.textContent = 'MODO: SOLO SABER (AUDITORÍA)';
    if (pill) {
      pill.textContent = 'SEGURO';
      pill.className = 'status-pill compliant';
    }
    if (desc) {
      desc.textContent = 'La telemetría se recopila con normalidad. No se aplican cambios ni descargas automáticas en los equipos de la flota.';
    }
    if (windowEl) windowEl.textContent = 'Auditoría Pura';
  }
}

async function loadSettings() {
  try {
    const res = await fetch('/api/fleet/settings');
    if (!res.ok) throw new Error('Error al consultar configuración del servidor');
    const settings = await res.json();
    currentSettings = settings;

    // Procesar modelos y grupos detectados en metadatos
    if (settings._meta) {
      if (settings._meta.groupCounts) groupCountsMap = settings._meta.groupCounts;
      if (Array.isArray(settings._meta.detectedModels)) {
        settings._meta.detectedModels.forEach(dm => {
          detectedModelsMap[dm.model_id] = dm;
          // Si no está en base models, añadirlo
          if (!allKnownModels.some(m => m.id === dm.model_id)) {
            allKnownModels.unshift({
              id: dm.model_id,
              oem: dm.oem || 'oem',
              name: dm.model_name || `Modelo ${dm.model_id}`,
              detectedCount: dm.count
            });
          }
        });
      }
    }

    // 1. Modo maestro
    selectFleetModeCard(settings.fleet_mode || 'audit_only');

    // 2. Frecuencia y ventana
    const schedType = settings.schedule_type || 'monthly';
    if (schedType === 'continuous' || schedType === 'immediate') {
      const el = $('schedule-continuous');
      if (el) el.checked = true;
    } else if (schedType === 'manual') {
      const el = $('schedule-manual');
      if (el) el.checked = true;
    } else {
      const el = $('schedule-monthly');
      if (el) el.checked = true;
    }

    const dayEl = $('settings-monthly-day');
    if (dayEl) dayEl.value = settings.monthly_day || 15;

    // Checkboxes
    const critEl = $('settings-critical-only');
    if (critEl) critEl.checked = settings.critical_only !== false;

    const pilotEl = $('settings-pilot-immediate');
    if (pilotEl) pilotEl.checked = settings.pilot_group_enabled !== false;

    const retryEl = $('settings-auto-retry');
    if (retryEl) retryEl.checked = settings.auto_retry_failed !== false;

    // 3. Tablas de Grupos y Modelos
    renderGroupsTable(settings.group_rules || {});
    renderModelsTable(settings.model_rules || {});

    // 4. Evaluar simulación en vivo
    evaluatePolicyImpact();

  } catch (err) {
    console.error('Error cargando configuración:', err);
    showToast('Error cargando configuración: ' + err.message, 'error');
  }
}

function renderGroupsTable(groupRules) {
  const tbody = $('groups-policies-tbody');
  if (!tbody) return;

  tbody.innerHTML = BASE_GROUPS.map(g => {
    const rule = groupRules[g.id] || { enabled: g.id !== 'vip', immediate: g.id === 'pilot' };
    const isEnabled = rule.enabled !== false;
    const count = groupCountsMap[g.id] || 0;

    let windowDesc = 'Ventana Mensual';
    if (g.id === 'pilot') windowDesc = 'Inmediata (Sin Espera)';
    else if (g.id === 'vip') windowDesc = 'Pausado (Solo Auditoría)';

    return `
      <tr>
        <td>
          <strong style="color:var(--text-primary); font-size:14px;">${escapeHtml(g.name)}</strong>
        </td>
        <td>
          <code class="font-mono text-cyan" style="font-size:12px;">${escapeHtml(g.id)}</code>
        </td>
        <td>
          <span class="tab-btn-pill" style="font-size:11px; padding:2px 8px; font-weight:600;">
            ${count} equipo${count === 1 ? '' : 's'}
          </span>
        </td>
        <td>
          <label class="toggle-switch">
            <input type="checkbox" id="group-toggle-${escapeHtml(g.id)}" ${isEnabled ? 'checked' : ''} />
            <span class="toggle-slider"></span>
          </label>
        </td>
        <td>
          <span style="font-size:12px; font-weight:600; color:${isEnabled ? 'var(--accent-cyan)' : 'var(--text-muted)'};">
            ${windowDesc}
          </span>
        </td>
        <td style="font-size:12px; color:var(--text-secondary); max-width:320px; line-height:1.4;">
          ${escapeHtml(g.desc)}
        </td>
      </tr>
    `;
  }).join('');
}

function renderModelsTable(modelRules) {
  const tbody = $('models-policies-tbody');
  if (!tbody) return;

  tbody.innerHTML = allKnownModels.map(m => {
    const rule = modelRules[m.id] || { enabled: true, criticalOnly: true };
    const isEnabled = rule.enabled !== false;
    const isCritical = rule.criticalOnly !== false;
    const detected = detectedModelsMap[m.id];
    const fleetCount = detected ? detected.count : (m.detectedCount || 0);

    return `
      <tr>
        <td>
          <strong style="color:var(--text-primary); font-size:14px;">${escapeHtml(m.name)}</strong>
        </td>
        <td>
          <code class="font-mono text-cyan" style="font-size:12px; font-weight:700;">${escapeHtml(m.id)}</code>
        </td>
        <td>
          <span class="tab-btn-pill ${(m.oem || '').toLowerCase()}" style="font-size:10px; padding:2px 7px;">
            ${escapeHtml((m.oem || 'oem').toUpperCase())}
          </span>
        </td>
        <td>
          ${fleetCount > 0 
            ? `<span class="status-pill compliant" style="font-size:11px; padding:2px 8px;">${fleetCount} en Flota</span>` 
            : `<span style="font-size:12px; color:var(--text-muted);">0 activos</span>`}
        </td>
        <td>
          <label class="toggle-switch">
            <input type="checkbox" id="model-toggle-${escapeHtml(m.id)}" ${isEnabled ? 'checked' : ''} />
            <span class="toggle-slider"></span>
          </label>
        </td>
        <td>
          <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer;">
            <input type="checkbox" id="model-crit-${escapeHtml(m.id)}" ${isCritical ? 'checked' : ''} />
            <span style="font-size:12px; color:var(--text-secondary);">Solo Críticos</span>
          </label>
        </td>
        <td id="model-status-cell-${escapeHtml(m.id)}">
          ${isEnabled 
            ? '<span class="status-pill compliant" style="font-size:11px;">Actualizaciones Habilitadas</span>' 
            : '<span class="status-pill outdated" style="font-size:11px;">Pausado / Solo Saber</span>'}
        </td>
      </tr>
    `;
  }).join('');

  // Vincular eventos en los toggles de modelos para actualizar la celda en tiempo real
  allKnownModels.forEach(m => {
    const toggle = $(`model-toggle-${m.id}`);
    if (toggle) {
      toggle.addEventListener('change', () => {
        const cell = $(`model-status-cell-${m.id}`);
        if (cell) {
          cell.innerHTML = toggle.checked 
            ? '<span class="status-pill compliant" style="font-size:11px;">Actualizaciones Habilitadas</span>' 
            : '<span class="status-pill outdated" style="font-size:11px;">Pausado / Solo Saber</span>';
        }
      });
    }
  });
}

async function evaluatePolicyImpact() {
  const simPill = $('sim-status-pill');
  const simSummary = $('sim-impact-summary');
  const bannerEligible = $('active-banner-eligible-devices');
  const bannerPending = $('active-banner-pending-drivers');
  const bannerWindow = $('active-banner-window');

  try {
    const res = await fetch('/api/fleet/policy-impact');
    if (!res.ok) throw new Error('Error al evaluar impacto');
    const impact = await res.json();

    if (bannerEligible) {
      bannerEligible.textContent = `${impact.eligibleDevices} / ${impact.totalDevices}`;
    }
    if (bannerPending) {
      bannerPending.textContent = `${impact.eligibleDriversTotal} parches`;
    }
    if (bannerWindow && impact.windowDescription) {
      bannerWindow.textContent = impact.scheduleType === 'continuous' ? 'Continuo' : (impact.scheduleType === 'monthly' ? `Día ${impact.monthlyDay}` : 'Manual');
    }

    if (simPill) {
      if (impact.fleetMode === 'audit_only') {
        simPill.textContent = 'SOLO SABER';
        simPill.className = 'status-pill compliant';
      } else if (impact.eligibleDevices > 0) {
        simPill.textContent = 'DESPLIEGUE ACTIVO';
        simPill.className = 'status-pill critical';
      } else {
        simPill.textContent = 'SIN ACCIONES';
        simPill.className = 'status-pill outdated';
      }
    }

    if (simSummary) {
      if (impact.fleetMode === 'audit_only') {
        simSummary.innerHTML = `<strong>Modo Auditoría Activo:</strong> Se detectaron <strong>${impact.totalDevices} equipo(s)</strong> con controladores cotejados. No se realizarán descargas ni instalaciones hasta que se active el modo programado o se envíe una orden manual.`;
      } else {
        simSummary.innerHTML = `<strong>${impact.eligibleDevices} de ${impact.totalDevices} equipo(s)</strong> cumplen las directivas activas. Se aplicarán <strong>${impact.eligibleDriversTotal} controlador(es)</strong> elegibles en la ventana: <em>${escapeHtml(impact.windowDescription)}</em>.`;
      }
    }
  } catch (err) {
    console.warn('Advertencia al consultar simulador de impacto:', err);
  }
}

async function triggerImmediateCycle() {
  const btn = $('btn-trigger-cycle-now');
  if (!confirm('¿Deseas disparar un ciclo de actualización inmediato para todos los equipos elegibles de la flota? Los agentes aplicarán los parches pendientes autorizados en su siguiente check-in.')) {
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Encolando Parches...';
  }

  try {
    const res = await fetch('/api/fleet/trigger-cycle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error('Error al emitir orden de ciclo en el servidor');
    const data = await res.json();

    if (data.queuedCount > 0) {
      showToast(`Ciclo iniciado: ${data.driversQueuedTotal} controladores encolados para ${data.queuedCount} equipo(s)`, 'success', 5000);
    } else {
      showToast(data.message || 'No hay parches elegibles para despachar', 'info', 4000);
    }

    evaluatePolicyImpact();
  } catch (err) {
    showToast('Error al disparar ciclo: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Disparar Ciclo Inmediato Ahora';
    }
  }
}

async function saveFleetSettings() {
  const saveBtn = $('btn-save-settings');
  const saveBtnBottom = $('btn-save-bottom');

  [saveBtn, saveBtnBottom].forEach(b => {
    if (b) { b.disabled = true; b.textContent = 'Guardando Políticas...'; }
  });

  try {
    // 1. Modo maestro
    const fleet_mode = $('fleet-mode-scheduled')?.checked ? 'scheduled' : 'audit_only';

    // 2. Frecuencia y ventana
    let schedule_type = 'monthly';
    if ($('schedule-continuous')?.checked) schedule_type = 'continuous';
    else if ($('schedule-manual')?.checked) schedule_type = 'manual';

    const monthly_day = parseInt($('settings-monthly-day')?.value, 10) || 15;
    const critical_only = $('settings-critical-only')?.checked !== false;
    const pilot_group_enabled = $('settings-pilot-immediate')?.checked !== false;
    const auto_retry_failed = $('settings-auto-retry')?.checked !== false;

    // 3. Reglas de modelos
    const model_rules = {};
    allKnownModels.forEach(m => {
      const toggle = $(`model-toggle-${m.id}`);
      const crit = $(`model-crit-${m.id}`);
      model_rules[m.id] = {
        name: m.name,
        enabled: toggle ? toggle.checked : true,
        criticalOnly: crit ? crit.checked : true
      };
    });

    // 4. Reglas de grupos
    const group_rules = {};
    BASE_GROUPS.forEach(g => {
      const toggle = $(`group-toggle-${g.id}`);
      group_rules[g.id] = {
        name: g.name,
        enabled: toggle ? toggle.checked : (g.id !== 'vip'),
        immediate: g.id === 'pilot'
      };
    });

    const payload = {
      fleet_mode,
      schedule_type,
      monthly_day,
      critical_only,
      pilot_group_enabled,
      auto_retry_failed,
      model_rules,
      group_rules
    };

    const res = await fetch('/api/fleet/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error('Error al persistir en el servidor');
    const data = await res.json();
    currentSettings = data.settings || payload;

    updateActiveBannerPreview();
    evaluatePolicyImpact();
    showToast('Políticas de flota guardadas y sincronizadas exitosamente', 'success', 4000);

  } catch (err) {
    console.error('Error al guardar políticas:', err);
    showToast('Error al guardar: ' + err.message, 'error');
  } finally {
    [saveBtn, saveBtnBottom].forEach(b => {
      if (b) { b.disabled = false; b.textContent = 'Guardar Políticas'; }
    });
    if (saveBtnBottom) saveBtnBottom.textContent = 'Guardar Todas las Políticas';
  }
}

function resetSettingsToDefaults() {
  if (!confirm('¿Deseas restablecer las políticas a los valores predeterminados seguros (Modo Solo Saber, ventana mensual día 15, solo parches críticos)?')) return;

  selectFleetModeCard('audit_only');
  if ($('schedule-monthly')) $('schedule-monthly').checked = true;
  if ($('settings-monthly-day')) $('settings-monthly-day').value = 15;
  if ($('settings-critical-only')) $('settings-critical-only').checked = true;
  if ($('settings-pilot-immediate')) $('settings-pilot-immediate').checked = true;
  if ($('settings-auto-retry')) $('settings-auto-retry').checked = true;

  // Restaurar checkboxes en tablas
  allKnownModels.forEach(m => {
    const toggle = $(`model-toggle-${m.id}`);
    const crit = $(`model-crit-${m.id}`);
    if (toggle) toggle.checked = (m.id !== '880D');
    if (crit) crit.checked = true;
    const cell = $(`model-status-cell-${m.id}`);
    if (cell) {
      cell.innerHTML = (m.id !== '880D')
        ? '<span class="status-pill compliant" style="font-size:11px;">Actualizaciones Habilitadas</span>'
        : '<span class="status-pill outdated" style="font-size:11px;">Pausado / Solo Saber</span>';
    }
  });

  BASE_GROUPS.forEach(g => {
    const toggle = $(`group-toggle-${g.id}`);
    if (toggle) toggle.checked = (g.id !== 'vip');
  });

  updateActiveBannerPreview();
  showToast('Valores restablecidos en el formulario. Pulsa "Guardar Políticas" para aplicar.', 'info');
}

// Inicialización de la vista y registro programático de eventos (Cero CSP inline)
document.addEventListener('DOMContentLoaded', () => {
  const today = new Date().getDate();
  const todayNumEl = $('preset-today-num');
  if (todayNumEl) todayNumEl.textContent = today;

  // Cargar configuración
  loadSettings();

  // Modo maestro
  const cardAudit = $('mode-card-audit');
  if (cardAudit) cardAudit.addEventListener('click', () => selectFleetModeCard('audit_only'));

  const cardScheduled = $('mode-card-scheduled');
  if (cardScheduled) cardScheduled.addEventListener('click', () => selectFleetModeCard('scheduled'));

  const radioAudit = $('fleet-mode-audit');
  if (radioAudit) radioAudit.addEventListener('change', () => selectFleetModeCard('audit_only'));

  const radioScheduled = $('fleet-mode-scheduled');
  if (radioScheduled) radioScheduled.addEventListener('change', () => selectFleetModeCard('scheduled'));

  // Radios de frecuencia
  ['schedule-continuous', 'schedule-monthly', 'schedule-manual'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('change', updateActiveBannerPreview);
  });

  const dayInput = $('settings-monthly-day');
  if (dayInput) dayInput.addEventListener('input', updateActiveBannerPreview);

  // Botones de presets de día
  const btnDay15 = $('btn-preset-day-15');
  if (btnDay15) {
    btnDay15.addEventListener('click', () => {
      if (dayInput) {
        dayInput.value = 15;
        updateActiveBannerPreview();
        showToast('Día 15 seleccionado (Patch Tuesday de Microsoft)', 'info', 2000);
      }
    });
  }

  const btnDayToday = $('btn-preset-day-today');
  if (btnDayToday) {
    btnDayToday.addEventListener('click', () => {
      if (dayInput) {
        dayInput.value = today;
        updateActiveBannerPreview();
        showToast(`Día ${today} seleccionado (Ventana activa hoy)`, 'info', 2000);
      }
    });
  }

  // Botones de Guardar
  const btnSave = $('btn-save-settings');
  if (btnSave) btnSave.addEventListener('click', saveFleetSettings);

  const btnSaveBottom = $('btn-save-bottom');
  if (btnSaveBottom) btnSaveBottom.addEventListener('click', saveFleetSettings);

  // Botones de Restablecer
  const btnReset = $('btn-reset-settings');
  if (btnReset) btnReset.addEventListener('click', resetSettingsToDefaults);

  const btnResetBottom = $('btn-reset-bottom');
  if (btnResetBottom) btnResetBottom.addEventListener('click', resetSettingsToDefaults);

  // Botones de Simulación y Disparo
  const btnEval = $('btn-evaluate-impact');
  if (btnEval) btnEval.addEventListener('click', () => {
    evaluatePolicyImpact();
    showToast('Impacto en flota recalculado', 'info', 2000);
  });

  const btnRecalcSim = $('btn-recalc-sim');
  if (btnRecalcSim) btnRecalcSim.addEventListener('click', () => {
    evaluatePolicyImpact();
    showToast('Simulación de despliegue actualizada', 'info', 2000);
  });

  const btnTriggerCycle = $('btn-trigger-cycle-now');
  if (btnTriggerCycle) btnTriggerCycle.addEventListener('click', triggerImmediateCycle);
});
