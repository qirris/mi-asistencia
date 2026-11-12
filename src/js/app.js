/* ============================================================
   Mi Asistencia — app.js
   Inicialización, render de vistas e interacción general.
   ============================================================ */

let state = null;
let editingId = null;
let editingFaltaId = null;
let deferredInstallPrompt = null;
let manualTotalAdd = false;
let manualTotalDlg = false;
let toastTimer = null;

/* ---------- Utilidades y Validación ---------- */
function clearFormErrors(formElement) {
  if (!formElement) return;
  formElement.querySelectorAll('.field-error').forEach(el => el.classList.remove('field-error'));
  formElement.querySelectorAll('[aria-invalid]').forEach(el => {
    el.removeAttribute('aria-invalid');
    el.removeAttribute('aria-describedby');
  });
  formElement.querySelectorAll('.field-error-msg').forEach(el => el.remove());
}

function setFieldError(inputEl, message) {
  if (!inputEl) return;
  inputEl.setAttribute('aria-invalid', 'true');
  const fieldDiv = inputEl.closest('.field') || inputEl.parentElement;
  if (fieldDiv) fieldDiv.classList.add('field-error');
  
  let errId = inputEl.id ? inputEl.id + '-error' : 'err-' + Math.random().toString(36).slice(2, 6);
  inputEl.setAttribute('aria-describedby', errId);
  
  let msgEl = fieldDiv.querySelector('.field-error-msg');
  if (!msgEl) {
    msgEl = document.createElement('div');
    msgEl.id = errId;
    msgEl.className = 'field-error-msg';
    fieldDiv.appendChild(msgEl);
  }
  msgEl.textContent = message;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function todayISO() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function fmt(n) {
  if (n == null || isNaN(n)) return '—';
  return (Math.round(n * 10) / 10).toString().replace('.', ',');
}
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return Array.from(document.querySelectorAll(sel)); }

function toast(msg) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- Render ---------- */
function render() {
  renderHeader();
  renderDashboard();
  renderAsignaturas();
  renderFaltas();
  renderHorario();
  renderDashboardTasks();
  renderMisTareas();
  renderHistorial();
  renderConfig();
}

function renderHeader() {
  const el = $('#header-etapa');
  if (el) el.textContent = (ETAPAS[state.etapa] || {}).label || 'Mi Asistencia';
}

function subjectCard(a) {
  const c = calcAsignatura(a);
  const e = estadoAsignatura(a, c);
  const pct = c.pct == null ? 0 : c.pct;
  const meta = [];
  if (a.horasSemanales) meta.push(fmt(a.horasSemanales) + ' h/sem');
  if (a.semanas) meta.push(a.semanas + ' semanas');
  return `
    <article class="subject tone-${e.tone}">
      <div class="subject-top">
        <div>
          <div class="subject-name"><span class="color-dot sc-${a.color}"></span>${esc(a.nombre)}</div>
          <div class="subject-meta">${meta.length ? meta.join(' · ') : 'Sin datos semanales'}</div>
        </div>
        <span class="badge ${e.tone}">${e.label}</span>
      </div>
      <div class="progress tone-${e.tone}"><span style="width:${Math.max(0, Math.min(100, pct))}%"></span></div>
      <div class="subject-stats">
        <span>Asistidas: <strong>${fmt(c.horasAsistidas)} h</strong></span>
        <span>Planificadas: <strong>${fmt(c.horasPlanificadas)} h</strong></span>
        <span>Ausencia: <strong>${fmt(c.horasAusencia)} h</strong></span>
        <span>Asistencia: <strong>${c.pct == null ? '—' : fmt(c.pct) + '%'}</strong></span>
      </div>
    </article>
  `;
}

function renderDashboardWelcome() {
  const fechaEl = $('#dash-fecha-actual');
  const etapaEl = $('#dash-etapa-badge');
  if (fechaEl) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const fechaStr = new Date().toLocaleDateString('es-ES', options);
    fechaEl.textContent = fechaStr.charAt(0).toUpperCase() + fechaStr.slice(1);
  }
  if (etapaEl) {
    etapaEl.textContent = (ETAPAS[state.etapa] || {}).label || 'Mi Asistencia';
  }
}

function renderDashboardStats() {
  const g = calcGlobal();
  const totalAusencias = state.faltas.reduce((s, f) => s + (Number(f.horas) || 0), 0);
  const tareasPendientes = (state.tareas || []).filter(t => t.estado === 'pendiente').length;

  $('#dash-stats').innerHTML = `
    <div class="stat">
      <span class="stat-label">Asistencia global</span>
      <span class="stat-value">${g.pct == null ? '—' : fmt(g.pct) + '%'}</span>
      <span class="stat-sub">ponderada por horas</span>
    </div>
    <div class="stat">
      <span class="stat-label">Asignaturas</span>
      <span class="stat-value">${g.activas.length}</span>
      <span class="stat-sub">registradas</span>
    </div>
    <div class="stat">
      <span class="stat-label">Ausencia total</span>
      <span class="stat-value">${fmt(totalAusencias)} h</span>
      <span class="stat-sub">acumuladas</span>
    </div>
    <div class="stat">
      <span class="stat-label">Tareas pendientes</span>
      <span class="stat-value">${tareasPendientes}</span>
      <span class="stat-sub">por completar</span>
    </div>
  `;
}

function renderDashboardAlerts() {
  const cont = $('#dash-alerts');
  if (!cont) return;
  const avisos = [];

  state.asignaturas.filter(a => !a.archivada).forEach(a => {
    const c = calcAsignatura(a);
    const e = estadoAsignatura(a, c);
    if (e.tone === 'red') {
      avisos.push({ type: 'danger', text: `⚠️ <strong>${esc(a.nombre)}</strong>: Límite de asistencia superado (${e.label}).` });
    } else if (e.tone === 'yellow') {
      avisos.push({ type: 'warn', text: `⚡ <strong>${esc(a.nombre)}</strong>: Cerca del límite de asistencia (${e.label}).` });
    }
  });

  const tareas = (state.tareas || []).filter(t => t.estado === 'pendiente' && t.fechaEntrega);
  tareas.forEach(t => {
    const d = diasHasta(t.fechaEntrega);
    if (d != null && d < 0) {
      avisos.push({ type: 'danger', text: `⏰ Tarea vencida: <strong>${esc(t.titulo)}</strong> (${esc(t.asignaturaNombre)}).` });
    } else if (d != null && d === 0) {
      avisos.push({ type: 'warn', text: `⏰ Tarea para hoy: <strong>${esc(t.titulo)}</strong> (${esc(t.asignaturaNombre)}).` });
    }
  });

  if (avisos.length === 0) {
    cont.innerHTML = '';
    return;
  }

  cont.innerHTML = avisos.slice(0, 3).map(av => `
    <div class="alert-banner ${av.type}" role="status">${av.text}</div>
  `).join('');
}

function renderDashboardClassesToday() {
  const cont = $('#dash-classes-today');
  if (!cont || !state || !state.horario) return;
  const h = state.horario;
  const now = new Date();
  const jsDay = now.getDay();
  const dayKey = jsDay >= 1 && jsDay <= 6 ? DIAS[jsDay - 1].key : 'domingo';
  const min = now.getHours() * 60 + now.getMinutes();

  if (!h.dias.includes(dayKey)) {
    cont.innerHTML = `<div class="empty" style="padding:1.25rem"><strong>Hoy no es día lectivo</strong>Disfruta de tu jornada de descanso.</div>`;
    return;
  }

  const franjas = h.franjas.filter(f => franjaActivaEnDia(h, f, dayKey) && f.tipo === 'clase');
  if (!franjas.length) {
    cont.innerHTML = `<div class="empty" style="padding:1.25rem"><strong>Sin clases configuradas</strong>No hay franjas lectivas para hoy.</div>`;
    return;
  }

  cont.innerHTML = franjas.map(f => {
    const c = getCasilla(h, dayKey, f.id);
    const a = c && c.asignaturaId ? asignaturaPorId(c.asignaturaId) : null;
    const iniMin = toMin(f.inicio);
    const finMin = toMin(f.fin);
    const isNow = min >= iniMin && min < finMin;

    const nombre = a ? a.nombre : 'Casilla sin asignar';
    const colorClass = a ? 'sc-' + a.color : 'sg-empty';
    const count = countTareasPendientesSlot(dayKey + '|' + f.id);

    return `
      <div class="dash-class-item ${isNow ? 'active-class' : ''} ${colorClass}">
        <span class="dc-time">${f.inicio}–${f.fin}</span>
        <span class="dc-name">${esc(nombre)}</span>
        ${isNow ? '<span class="badge blue">En curso</span>' : ''}
        ${count > 0 ? `<span class="badge red">${count} pendiente${count === 1 ? '' : 's'}</span>` : ''}
      </div>
    `;
  }).join('');
}

function renderDashboardAttendanceSummary() {
  const cont = $('#dash-attendance-summary');
  const formulaEl = $('#dash-formula');
  if (!cont) return;

  const g = calcGlobal();
  const tipo = (ETAPAS[state.etapa] || {}).tipo;

  if (formulaEl) {
    formulaEl.textContent = tipo === 'fp'
      ? 'Fórmula: (horas asistidas ÷ horas planificadas) × 100. Límite FP: 80% asistencia (20% ausencia).'
      : 'Fórmula: (horas asistidas ÷ horas planificadas) × 100. Límite según criterio del centro.';
  }

  if (g.activas.length === 0) {
    cont.innerHTML = `<p class="muted" style="font-size:0.85rem">Añade asignaturas para ver el resumen de asistencia.</p>`;
    return;
  }

  const totalPlan = g.totalPlan;
  const totalAsist = g.totalAsist;
  const totalAusent = totalPlan - totalAsist;
  const pct = g.pct != null ? g.pct : 0;

  cont.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;font-weight:700;">
      <span>Asistencia global</span>
      <span>${g.pct == null ? '—' : fmt(g.pct) + '%'}</span>
    </div>
    <div class="progress" style="height:12px;margin-bottom:.85rem;">
      <span style="width:${Math.max(0, Math.min(100, pct))}%"></span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.5rem;text-align:center;font-size:.8rem;color:var(--muted);">
      <div style="background:var(--gray-soft);padding:.5rem;border-radius:8px;">Planificadas<br><strong style="color:var(--text);">${fmt(totalPlan)} h</strong></div>
      <div style="background:var(--gray-soft);padding:.5rem;border-radius:8px;">Asistidas<br><strong style="color:var(--green);">${fmt(totalAsist)} h</strong></div>
      <div style="background:var(--gray-soft);padding:.5rem;border-radius:8px;">Ausencias<br><strong style="color:var(--red);">${fmt(totalAusent)} h</strong></div>
    </div>
  `;
}

function renderDashboardSubjects() {
  const cont = $('#dash-subjects');
  if (!cont) return;
  const activas = state.asignaturas.filter(a => !a.archivada);

  if (activas.length === 0) {
    cont.innerHTML = `<p class="muted" style="font-size:0.85rem">No hay asignaturas registradas.</p>`;
    return;
  }

  cont.innerHTML = `<div class="subject-list" style="gap:.5rem;">` + activas.slice(0, 4).map(a => {
    const c = calcAsignatura(a);
    const e = estadoAsignatura(a, c);
    return `
      <div class="summary-row sc-${a.color}" style="padding:.5rem .75rem;">
        <span class="color-dot"></span>
        <span class="sr-name" style="font-size:.84rem;">${esc(a.nombre)}</span>
        <span class="sr-data">${c.pct == null ? '—' : fmt(c.pct) + '%'}</span>
        <span class="badge ${e.tone}" style="font-size:.65rem;padding:.15rem .4rem;">${e.label}</span>
      </div>
    `;
  }).join('') + `</div>`;
}

function renderDashboardRecentActivity() {
  const cont = $('#dash-recent-activity');
  if (!cont) return;
  const faltasRecientes = [...state.faltas].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 3);
  const tareasRecientes = [...(state.tareas || [])].sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion)).slice(0, 3);

  const items = [];
  faltasRecientes.forEach(f => {
    const a = asignaturaPorId(f.asignaturaId);
    items.push({
      fecha: f.fecha,
      texto: `Falta registrada en <strong>${esc(a ? a.nombre : 'Asignatura')}</strong> (${fmt(f.horas)} h)`
    });
  });
  tareasRecientes.forEach(t => {
    items.push({
      fecha: t.fechaCreacion,
      texto: `Actividad creada: <strong>${esc(t.titulo)}</strong>`
    });
  });

  items.sort((a, b) => b.fecha.localeCompare(a.fecha));
  const recientes = items.slice(0, 4);

  if (recientes.length === 0) {
    cont.innerHTML = `<p class="muted" style="font-size:0.85rem">Sin actividad reciente registrada.</p>`;
    return;
  }

  cont.innerHTML = `<div class="history-list">` + recientes.map(r => `
    <div class="history-item" style="padding:.5rem .75rem;font-size:.82rem;">
      <div class="h-main">
        <div>${r.texto}</div>
        <div class="h-sub">${esc(r.fecha)}</div>
      </div>
    </div>
  `).join('') + `</div>`;
}

function renderDashboard() {
  renderDashboardWelcome();
  renderDashboardStats();
  renderDashboardAlerts();
  renderDashboardClassesToday();
  renderDashboardAttendanceSummary();
  renderDashboardSubjects();
  renderDashboardRecentActivity();
  renderDashboardTasks();
}

function asigCardAdmin(a) {
  const c = calcAsignatura(a);
  const e = estadoAsignatura(a, c);
  return `
    <article class="subject tone-${e.tone}">
      <div class="subject-top">
        <div>
          <div class="subject-name"><span class="color-dot sc-${a.color}"></span>${esc(a.nombre)}${a.archivada ? ' <span class="badge gray">Archivada</span>' : ''}</div>
          <div class="subject-meta">${a.horasSemanales ? fmt(a.horasSemanales) + ' h/sem' : '—'} · ${a.semanas ? a.semanas + ' semanas' : '—'} · Total ${fmt(c.horasPlanificadas)} h</div>
        </div>
        <span class="badge ${e.tone}">${e.label}</span>
      </div>
      <div class="subject-actions">
        <button class="btn btn-ghost btn-sm" type="button" data-edit="${a.id}">Editar</button>
        <button class="btn btn-ghost btn-sm" type="button" data-archive="${a.id}">${a.archivada ? 'Restaurar' : 'Archivar'}</button>
        <button class="btn btn-danger btn-sm" type="button" data-delete="${a.id}">Eliminar</button>
      </div>
    </article>
  `;
}

function renderAsignaturas() {
  const cont = $('#asig-list');
  const activas = state.asignaturas.filter(a => !a.archivada);
  const archivadas = state.asignaturas.filter(a => a.archivada);
  let html = '';
  if (activas.length === 0) {
    html += `<div class="empty-state-card">
      <div class="esc-icon">📚</div>
      <h3>¡Vamos a organizar tus clases!</h3>
      <p>Primero añade las asignaturas que tienes y después podrás colocarlas en tu horario y registrar tus faltas.</p>
    </div>`;
  } else {
    html += activas.map(asigCardAdmin).join('');
  }
  if (archivadas.length) {
    html += `<h3 class="section-title">Archivadas</h3>` + archivadas.map(asigCardAdmin).join('');
  }
  cont.innerHTML = html;
}

function histItem(f) {
  const a = state.asignaturas.find(x => x.id === f.asignaturaId);
  const nombre = a ? a.nombre : 'Asignatura eliminada';
  return `
    <div class="history-item">
      <div class="h-main">
        <div>${esc(nombre)}</div>
        <div class="h-sub">${esc(f.fecha)} · ${f.tipo === 'justificada' ? 'Justificada' : 'No justificada'}${f.motivo ? ' · ' + esc(f.motivo) : ''}</div>
      </div>
      <div class="h-hours">${fmt(f.horas)} h</div>
    </div>
  `;
}

function renderFaltas() {
  const sel = $('#falta-asig');
  const activas = state.asignaturas.filter(a => !a.archivada);
  const prev = sel.value;
  sel.innerHTML = activas.length
    ? activas.map(a => `<option value="${a.id}">${esc(a.nombre)}</option>`).join('')
    : `<option value="">— Añade asignaturas primero —</option>`;
  if (prev && activas.some(a => a.id === prev)) sel.value = prev;

  const fechaEl = $('#falta-fecha');
  if (fechaEl && !fechaEl.value) fechaEl.value = todayISO();

  const tipo = (ETAPAS[state.etapa] || {}).tipo;
  $('#falta-legal').textContent = tipo === 'fp'
    ? 'En FP presencial se computan las ausencias justificadas e injustificadas para la evaluación continua (Orden de 18/09/2025, art. 2.4).'
    : 'En ESO/Bachillerato el criterio depende del Plan de Convivencia de tu centro (Decreto 327/2010, art. 34.3).';

  const recientes = [...state.faltas]
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id))
    .slice(0, 5);
  const cont = $('#falta-recientes');
  cont.innerHTML = recientes.length
    ? `<h3 class="section-title">Últimas faltas</h3><div class="history-list">${recientes.map(histItem).join('')}</div>`
    : '';
}


function renderHistorial() {
  const filtroAsig = $('#filtro-asig');
  const prev = filtroAsig.value;
  filtroAsig.innerHTML = `<option value="">Todas</option>` +
    state.asignaturas.map(a => `<option value="${a.id}">${esc(a.nombre)}</option>`).join('');
  if (prev && state.asignaturas.some(a => a.id === prev)) filtroAsig.value = prev;

  const fa = filtroAsig.value;
  const ft = $('#filtro-tipo').value;
  const desde = $('#filtro-desde').value;
  const hasta = $('#filtro-hasta').value;
  let items = [...state.faltas].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));
  if (fa) items = items.filter(f => f.asignaturaId === fa);
  if (ft) items = items.filter(f => f.tipo === ft);
  if (desde) items = items.filter(f => f.fecha >= desde);
  if (hasta) items = items.filter(f => f.fecha <= hasta);

  const cont = $('#historial-list');
  if (items.length === 0) {
    cont.innerHTML = `
      <div class="empty-state-card">
        <div class="esc-icon">📋</div>
        <h3>Sin registros en el historial</h3>
        <p>No hay faltas que coincidan con los filtros seleccionados o todavía no has registrado ninguna ausencia.</p>
      </div>
    `;
    return;
  }
  cont.innerHTML = items.map(f => {
    const a = state.asignaturas.find(x => x.id === f.asignaturaId);
    return `
      <div class="history-item">
        <div class="h-main">
          <div>${esc(a ? a.nombre : 'Asignatura eliminada')}</div>
          <div class="h-sub">${esc(f.fecha)} · ${f.tipo === 'justificada' ? 'Justificada' : 'No justificada'}${f.motivo ? ' · ' + esc(f.motivo) : ''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:.4rem">
          <span class="h-hours">${fmt(f.horas)} h</span>
          <button class="btn btn-ghost btn-sm" type="button" data-editfalta="${f.id}" aria-label="Editar falta">Editar</button>
          <button class="btn btn-danger btn-sm" type="button" data-delfalta="${f.id}" aria-label="Eliminar falta">×</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderConfig() {
  $('#cfg-etapa').value = state.etapa;
  const tipo = (ETAPAS[state.etapa] || {}).tipo;
  $('#cfg-criterio-wrap').style.display = tipo === 'fp' ? 'none' : 'block';

  const crit = state.config.criterio || {};
  $('#cfg-criterio-tipo').value = crit.tipo || '';
  $('#cfg-criterio-valor').value = crit.valor == null ? '' : crit.valor;

  $('#cfg-legal').textContent = tipo === 'fp'
    ? 'FP presencial: asistencia mínima del 80 % (Orden de 18/09/2025, art. 2.4). El centro puede concretar en su Proyecto educativo el incumplimiento que determina la pérdida.'
    : 'ESO/Bachillerato: el máximo de faltas lo fija el Plan de Convivencia del IES (Decreto 327/2010, art. 34.3). La aplicación no impone un porcentaje autonómico.';

  $('#cfg-info').textContent = 'Versión de datos: ' + state.version + '. Revisión normativa: 09/11/2026. Fuentes: BOJA y Junta de Andalucía.';
}

/* ---------- Eventos: navegación ---------- */
function bindNav() {
  $$('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      $$('.nav-btn').forEach(b => b.classList.toggle('active', b === btn));
      $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

/* ---------- Eventos: asignaturas ---------- */
function bindAsignaturas() {
  const nombreInput = $('#asig-nombre');
  const horasInput = $('#asig-horas');
  const colorInput = $('#asig-color');
  const previewName = $('#preview-name');
  const previewHours = $('#preview-hours');
  const previewDot = $('#preview-dot');

  function updatePreview() {
    const nombre = nombreInput.value.trim() || 'Nombre de la asignatura';
    const horas = parseFloat(horasInput.value) || 4;
    const color = colorInput.value || 'azul';
    previewName.textContent = nombre;
    previewHours.textContent = horas + ' h/sem';
    previewDot.className = 'color-dot sc-' + color;
  }

  if (nombreInput) nombreInput.addEventListener('input', updatePreview);
  if (horasInput) horasInput.addEventListener('input', updatePreview);
  if (colorInput) {
    const observer = new MutationObserver(updatePreview);
    observer.observe(colorInput, { attributes: true });
    // También actualizamos al hacer clic en la paleta
    const picker = $('#asig-color-picker');
    if (picker) {
      picker.addEventListener('click', () => setTimeout(updatePreview, 10));
    }
  }

  const formCard = $('#asig-form-card');
  const btnToggle = $('#btn-toggle-asig-form');
  const btnCancel = $('#btn-cancel-asig');

  if (btnToggle && formCard) {
    btnToggle.addEventListener('click', () => {
      formCard.classList.toggle('hidden');
      if (!formCard.classList.contains('hidden')) {
        nombreInput.focus();
      }
    });
  }

  if (btnCancel && formCard) {
    btnCancel.addEventListener('click', () => {
      clearFormErrors(formCard);
      formCard.classList.add('hidden');
    });
  }

  $('#btn-add-asig').addEventListener('click', () => {
    const cardEl = nombreInput.closest('.card') || nombreInput.parentElement;
    clearFormErrors(cardEl);

    const nombre = nombreInput.value.trim();
    const h = parseFloat(horasInput.value);

    let hasError = false;
    let firstErr = null;

    if (!nombre) {
      setFieldError(nombreInput, 'Escribe el nombre de la asignatura.');
      if (!firstErr) firstErr = nombreInput;
      hasError = true;
    } else if (state.asignaturas.some(a => !a.archivada && a.nombre.toLowerCase() === nombre.toLowerCase())) {
      setFieldError(nombreInput, 'Ya existe una asignatura con este nombre.');
      if (!firstErr) firstErr = nombreInput;
      hasError = true;
    }

    if (isNaN(h) || h <= 0) {
      setFieldError(horasInput, 'Indica un número válido de horas semanales.');
      if (!firstErr) firstErr = horasInput;
      hasError = true;
    }

    if (hasError) {
      if (firstErr) firstErr.focus();
      return toast('Revisa los campos marcados en rojo');
    }

    const color = colorInput.value || PALETA[state.asignaturas.length % PALETA.length];
    const semanas = 30; // Estándar académico predeterminado
    const horasTotales = h * semanas;

    state.asignaturas.push({
      id: uid(),
      nombre,
      color,
      horasSemanales: h,
      semanas,
      horasTotales,
      archivada: false
    });
    saveState();
    nombreInput.value = '';
    horasInput.value = '';
    setColorPicker('#asig-color-picker', '#asig-color', PALETA[state.asignaturas.length % PALETA.length]);
    updatePreview();
    if (formCard) formCard.classList.add('hidden');
    toast('Asignatura añadida');
    render();
  });

  // Delegación para acciones de cada tarjeta
  $('#asig-list').addEventListener('click', (e) => {
    const edit = e.target.closest('[data-edit]');
    const arch = e.target.closest('[data-archive]');
    const del = e.target.closest('[data-delete]');

    if (edit) openEdit(edit.dataset.edit);

    if (arch) {
      const a = state.asignaturas.find(x => x.id === arch.dataset.archive);
      if (!a) return;
      a.archivada = !a.archivada;
      saveState();
      toast(a.archivada ? 'Asignatura archivada' : 'Asignatura restaurada');
      render();
    }

    if (del) {
      const a = state.asignaturas.find(x => x.id === del.dataset.delete);
      if (!a) return;

      const usos = casillasDeAsignatura(a.id);
      if (usos > 0) {
        const vaciar = confirm('«' + a.nombre + '» está colocada en ' + usos + ' casilla(s) del horario.\n\nAceptar: eliminar la asignatura, sus faltas y vaciar esas casillas.\nCancelar: elegir otra opción.');
        if (vaciar) {
          limpiarCasillasAsignatura(a.id);
        } else {
          const conservar = confirm('¿Eliminar «' + a.nombre + '» y sus faltas, conservando las casillas como «Asignatura eliminada»?\n\nAceptar: conservar las casillas.\nCancelar: no eliminar nada.');
          if (!conservar) return;
        }
      } else if (!confirm('¿Eliminar «' + a.nombre + '» y todas sus faltas? Esta acción no se puede deshacer.')) {
        return;
      }

      state.asignaturas = state.asignaturas.filter(x => x.id !== a.id);
      state.faltas = state.faltas.filter(f => f.asignaturaId !== a.id);
      saveState();
      toast('Asignatura eliminada');
      render();
    }
  });
}

/* ---------- Eventos: diálogo edición ---------- */
function openEdit(id) {
  const a = state.asignaturas.find(x => x.id === id);
  if (!a) return;
  editingId = id;
  $('#dlg-title').textContent = 'Editar asignatura';
  $('#dlg-nombre').value = a.nombre;
  setColorPicker('#dlg-color-picker', '#dlg-color', a.color);
  $('#dlg-horas').value = a.horasSemanales == null ? '' : a.horasSemanales;
  $('#dialog-asig').showModal();
}

function bindDialog() {
  $('#dlg-close').addEventListener('click', () => $('#dialog-asig').close());
  $('#dlg-cancel').addEventListener('click', () => $('#dialog-asig').close());

  $('#dlg-save').addEventListener('click', () => {
    const dialogEl = $('#dialog-asig');
    clearFormErrors(dialogEl);

    const a = state.asignaturas.find(x => x.id === editingId);
    if (!a) return;
    const nombreInput = $('#dlg-nombre');
    const horasInput = $('#dlg-horas');
    const nombre = nombreInput.value.trim();
    const h = parseFloat(horasInput.value);

    let hasError = false;
    let firstErr = null;

    if (!nombre) {
      setFieldError(nombreInput, 'El nombre no puede estar vacío.');
      if (!firstErr) firstErr = nombreInput;
      hasError = true;
    }
    if (isNaN(h) || h <= 0) {
      setFieldError(horasInput, 'Las horas semanales deben ser mayores que 0.');
      if (!firstErr) firstErr = horasInput;
      hasError = true;
    }

    if (hasError) {
      if (firstErr) firstErr.focus();
      return toast('Revisa los campos marcados en rojo');
    }

    const semanas = a.semanas || 30;
    a.nombre = nombre;
    a.color = $('#dlg-color').value || a.color || 'azul';
    a.horasSemanales = h;
    a.semanas = semanas;
    a.horasTotales = h * semanas;
    saveState();
    dialogEl.close();
    toast('Cambios guardados');
    render();
  });
}

/* ---------- Eventos: faltas ---------- */
function bindFaltas() {
  $('#btn-add-falta').addEventListener('click', () => {
    const cardEl = $('#faltas-form-card');
    clearFormErrors(cardEl);

    const asignaturaEl = $('#falta-asig');
    const fechaEl = $('#falta-fecha');
    const horasEl = $('#falta-horas');

    const asignaturaId = asignaturaEl.value;
    const fecha = fechaEl.value;
    const horas = parseFloat(horasEl.value);
    const tipo = $('#falta-tipo').value;
    const motivo = $('#falta-motivo').value.trim();

    let hasError = false;
    let firstErr = null;

    if (!asignaturaId) {
      setFieldError(asignaturaEl, 'Selecciona una asignatura.');
      if (!firstErr) firstErr = asignaturaEl;
      hasError = true;
    }
    if (!fecha) {
      setFieldError(fechaEl, 'Selecciona una fecha.');
      if (!firstErr) firstErr = fechaEl;
      hasError = true;
    }
    if (isNaN(horas) || horas <= 0) {
      setFieldError(horasEl, 'Las horas deben ser mayores que 0.');
      if (!firstErr) firstErr = horasEl;
      hasError = true;
    }

    if (hasError) {
      if (firstErr) firstErr.focus();
      return toast('Revisa los campos marcados en rojo');
    }

    const a = state.asignaturas.find(x => x.id === asignaturaId);
    if (a && horas > Number(a.horasTotales)) {
      if (!confirm('Has indicado más horas que el total planificado de la asignatura. ¿Continuar?')) return;
    }

    state.faltas.push({ id: uid(), asignaturaId, fecha, horas, tipo, motivo });
    saveState();
    horasEl.value = '';
    $('#falta-motivo').value = '';
    toast('Falta registrada');
    render();
  });
}

/* ---------- Eventos: historial ---------- */
function bindHistorial() {
  $('#filtro-asig').addEventListener('change', renderHistorial);
  $('#filtro-tipo').addEventListener('change', renderHistorial);
  $('#filtro-desde').addEventListener('change', renderHistorial);
  $('#filtro-hasta').addEventListener('change', renderHistorial);

  $('#btn-limpiar-filtros').addEventListener('click', () => {
    $('#filtro-asig').value = '';
    $('#filtro-tipo').value = '';
    $('#filtro-desde').value = '';
    $('#filtro-hasta').value = '';
    renderHistorial();
  });

  $('#historial-list').addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-editfalta]');
    if (editBtn) {
      openFaltaEdit(editBtn.dataset.editfalta);
      return;
    }

    const btn = e.target.closest('[data-delfalta]');
    if (!btn) return;
    const id = btn.dataset.delfalta;
    const f = state.faltas.find(x => x.id === id);
    if (!f) return;
    if (!confirm('¿Eliminar esta falta? Los cálculos se actualizarán.')) return;
    state.faltas = state.faltas.filter(x => x.id !== id);
    saveState();
    toast('Falta eliminada');
    render();
  });
}

function openFaltaEdit(id) {
  const f = state.faltas.find(x => x.id === id);
  if (!f) return;
  editingFaltaId = id;
  const sel = $('#dlg-falta-asig');
  sel.innerHTML = state.asignaturas.map(a => `<option value="${a.id}">${esc(a.nombre)}</option>`).join('');
  sel.value = f.asignaturaId;
  $('#dlg-falta-fecha').value = f.fecha;
  $('#dlg-falta-horas').value = f.horas;
  $('#dlg-falta-tipo').value = f.tipo;
  $('#dlg-falta-motivo').value = f.motivo || '';
  $('#dialog-falta').showModal();
}

function bindDialogFalta() {
  $('#dlg-falta-close').addEventListener('click', () => $('#dialog-falta').close());
  $('#dlg-falta-cancel').addEventListener('click', () => $('#dialog-falta').close());

  $('#dlg-falta-save').addEventListener('click', () => {
    const f = state.faltas.find(x => x.id === editingFaltaId);
    if (!f) return;
    const asignaturaId = $('#dlg-falta-asig').value;
    const fecha = $('#dlg-falta-fecha').value;
    const horas = parseFloat($('#dlg-falta-horas').value);
    const tipo = $('#dlg-falta-tipo').value;
    const motivo = $('#dlg-falta-motivo').value.trim();

    if (!asignaturaId) return toast('Selecciona una asignatura');
    if (!fecha) return toast('Selecciona una fecha');
    if (isNaN(horas) || horas <= 0) return toast('Las horas deben ser mayores que 0');

    f.asignaturaId = asignaturaId;
    f.fecha = fecha;
    f.horas = horas;
    f.tipo = tipo;
    f.motivo = motivo;
    saveState();
    $('#dialog-falta').close();
    toast('Falta actualizada');
    render();
  });
}

/* ---------- Eventos: configuración ---------- */
function bindConfig() {
  $('#cfg-etapa').addEventListener('change', (e) => {
    state.etapa = e.target.value;
    saveState();
    toast('Etapa actualizada');
    render();
  });

  $('#cfg-criterio-tipo').addEventListener('change', (e) => {
    state.config.criterio.tipo = e.target.value;
    saveState();
    render();
  });

  $('#cfg-criterio-valor').addEventListener('input', (e) => {
    const v = e.target.value;
    state.config.criterio.valor = v === '' ? null : Number(v);
    saveState();
    renderDashboard();
    renderAsignaturas();
  });

  $('#btn-export').addEventListener('click', exportJSON);
  $('#import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importJSON(file);
    e.target.value = '';
  });
  $('#btn-delete-all').addEventListener('click', deleteAll);
  $('#btn-install').addEventListener('click', promptInstall);
  $('#btn-install-cfg').addEventListener('click', promptInstall);
}

/* ---------- Copia de seguridad ---------- */
function exportJSON() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mi-asistencia-backup-' + todayISO() + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Copia exportada');
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.asignaturas) || !Array.isArray(data.faltas)) {
        throw new Error('Estructura no válida');
      }
      if (!confirm('Esto reemplazará tus datos actuales. ¿Continuar?')) return;
      // Copia de seguridad del estado actual antes de reemplazar
      localStorage.setItem(STORAGE_KEY + '_backup_' + Date.now(), localStorage.getItem(STORAGE_KEY) || '');
      state = normalizeState(data);
      saveState();
      toast('Datos importados');
      render();
    } catch (e) {
      toast('Archivo no válido: ' + e.message);
    }
  };
  reader.readAsText(file);
}

function deleteAll() {
  if (!confirm('¿Borrar TODOS los datos? Se eliminarán asignaturas, faltas y configuración.')) return;
  if (!confirm('Esta acción no se puede deshacer. ¿Confirmar borrado definitivo?')) return;
  localStorage.setItem(STORAGE_KEY + '_backup_' + Date.now(), localStorage.getItem(STORAGE_KEY) || '');
  state = normalizeState(JSON.parse(JSON.stringify(DEFAULT_STATE)));
  saveState();
  toast('Todos los datos borrados');
  render();
}

/* ---------- Instalación PWA ---------- */
function setupInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const b1 = $('#btn-install');
    const b2 = $('#btn-install-cfg');
    if (b1) b1.classList.remove('hidden');
    if (b2) b2.classList.remove('hidden');
  });

  const installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (installed) {
    const b1 = $('#btn-install');
    if (b1) b1.classList.add('hidden');
  }
}

function promptInstall() {
  const help = $('#install-help');
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(() => {
      deferredInstallPrompt = null;
      const b1 = $('#btn-install');
      if (b1) b1.classList.add('hidden');
    });
    return;
  }
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (help) {
    help.textContent = isIOS
      ? 'En iPhone/iPad: abre esta web en Safari, pulsa Compartir y elige «Añadir a pantalla de inicio».'
      : 'Si tu navegador no muestra el aviso, usa el menú del navegador y elige «Instalar aplicación» o «Añadir a pantalla de inicio».';
  }
  toast('Sigue las instrucciones para instalar');
}

/* ---------- Inicio ---------- */
function init() {
  loadState();
  initColorPicker('#asig-color-picker', '#asig-color');
  initColorPicker('#dlg-color-picker', '#dlg-color');
  setColorPicker('#asig-color-picker', '#asig-color', PALETA[state.asignaturas.length % PALETA.length]);
  bindNav();
  bindAsignaturas();
  bindDialog();
  bindDialogFalta();
  bindFaltas();
  bindSchedule();
  bindTasks();
  bindHistorial();
  bindConfig();
  setupInstall();
  render();
}

document.addEventListener('DOMContentLoaded', init);
