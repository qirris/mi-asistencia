/* ============================================================
   SalvaTuCurso — app.js
   Inicialización, render de vistas e interacción general.
   ============================================================ */

let state = null;
let editingId = null;
let editingFaltaId = null;
let deferredInstallPrompt = null;
let manualTotalAdd = false;
let manualTotalDlg = false;
let toastTimer = null;
let dashboardRefreshTimer = null;
let dashboardRefreshBound = false;
let dashboardClockSignature = '';
const ZOOM_PREFERENCE_KEY = 'miAsistenciaZoomPermitido';

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

function isZoomAllowed() {
  try {
    return localStorage.getItem(ZOOM_PREFERENCE_KEY) === 'true';
  } catch (error) {
    return false;
  }
}

function applyZoomPreference(allowZoom) {
  const viewport = $('meta[name="viewport"]');
  if (!viewport) return;
  const enabled = typeof allowZoom === 'boolean' ? allowZoom : isZoomAllowed();
  const base = 'width=device-width, initial-scale=1';
  viewport.content = enabled
    ? base + ', viewport-fit=cover'
    : base + ', maximum-scale=1, user-scalable=no, viewport-fit=cover';
}

function toast(msg) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

function uiIcon(name) {
  const paths = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    arrow: '<path d="m9 5 7 7-7 7"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    edit: '<path d="m16 3 5 5-12 12-6 1 1-6Z"/><path d="m14 5 5 5"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
    warning: '<path d="m12 3 10 18H2Z"/><path d="M12 9v4M12 17h.01"/>',
    note: '<path d="M14 3H5v18h14V8Z"/><path d="M14 3v5h5M8 12h8M8 16h5"/>',
    clipboard: '<path d="M9 5H5v16h14V5h-4"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M8 12h8M8 16h5"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    book: '<path d="M4 19V5a2 2 0 0 1 2-2h14v18H6a2 2 0 0 1-2-2Zm0 0a2 2 0 0 1 2-2h14"/>'
  };
  return '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || paths.arrow) + '</svg>';
}

function getSetupProgress() {
  const subjects = state.asignaturas.filter(a => !a.archivada);
  const assigned = Object.values(state.horario.casillas || {}).some(c => c && subjects.some(a => a.id === c.asignaturaId));
  const setup = state.config.onboarding || {};
  const stage = !!setup.etapaConfirmada;
  return { subjects, assigned, stage, step: !stage ? 1 : !subjects.length ? 2 : !assigned ? 3 : 4, hidden: !!setup.oculto };
}

function findNextClass(now = new Date()) {
  const h = state.horario;
  if (!h) return null;
  const active = new Set(state.asignaturas.filter(subject => !subject.archivada).map(subject => subject.id));
  const weekly = new Map();
  h.dias.forEach(day => {
    weekly.set(day, h.franjas.filter(slot => {
      const cell = getCasilla(h, day, slot.id);
      return slot.tipo === 'clase' && franjaActivaEnDia(h, slot, day) && cell && !cell.recreo && active.has(cell.asignaturaId);
    }).sort((a, b) => toMin(a.inicio) - toMin(b.inicio)));
  });
  if (![...weekly.values()].some(slots => slots.length)) return null;
  const today = calendarISO(now), calendar = state.config.calendario;
  if (!today) return null;
  let candidate = calendar.inicio && today < calendar.inicio ? calendar.inicio : today;
  const minute = now.getHours() * 60 + now.getMinutes();
  // Los periodos completos se saltan de una vez; entre ellos basta una semana.
  while (candidate && (!calendar.fin || candidate <= calendar.fin)) {
    const status = getSchoolDayStatus(candidate);
    if (status.motivo === 'noLectivo') { candidate = calendarAddDays(status.hasta, 1); continue; }
    if (status.motivo === 'despues') break;
    const date = calendarDate(candidate);
    const day = DIAS[(date.getDay() + 6) % 7];
    if (status.lectivo) {
      for (const slot of weekly.get(day.key) || []) {
        if (candidate === today && toMin(slot.fin) <= minute) continue;
        const cell = getCasilla(h, day.key, slot.id);
        const offset = calendarDayNumber(candidate) - calendarDayNumber(today);
        return { subject: asignaturaPorId(cell.asignaturaId), slot, day, date, offset,
          current: offset === 0 && minute >= toMin(slot.inicio) };
      }
    }
    candidate = calendarAddDays(candidate, 1);
  }
  return null;
}

function renderDashboardPriorities() {
  const cont = $('#dash-priorities');
  if (!cont) return;
  const progress = getSetupProgress();
  const pending = (state.tareas || []).filter(t => t.estado === 'pendiente').sort((a, b) => (a.fechaEntrega || '9999').localeCompare(b.fechaEntrega || '9999'));
  const hasContent = (progress.hidden || progress.step === 4) && (progress.subjects.length > 0 || pending.length > 0);
  cont.classList.toggle('hidden', !hasContent);
  if (!hasContent) { cont.innerHTML = ''; return; }
  const next = findNextClass();
  const task = pending[0];
  const schoolStatus = getSchoolDayStatus(new Date());
  const emptyClassTitle = schoolStatus.motivo === 'despues' ? 'Curso finalizado' : progress.assigned ? 'Sin clases previstas' : 'Prepara tu semana';
  const emptyClassMessage = ['antes', 'despues', 'noLectivo'].includes(schoolStatus.motivo) ? schoolDayMessage(schoolStatus) : progress.assigned ? 'Revisa las fechas del curso y las clases de tu horario.' : 'Coloca tus asignaturas para ver tu próxima clase.';
  const classWhen = next ? (next.current ? 'En curso' : next.offset === 0 ? 'Hoy' : next.offset === 1 ? 'Mañana' : next.day.label + ' ' + next.date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })) + ' · ' + next.slot.inicio + '–' + next.slot.fin : emptyClassMessage;
  const taskSubject = task ? asignaturaPorId(task.asignaturaId) : null;
  cont.innerHTML = `
    <section class="priority-item priority-class">
      <h3>${uiIcon('calendar')} ${next && next.current ? 'Tu clase ahora' : 'Próxima clase'}</h3>
      <p class="priority-title">${next ? esc(next.subject.nombre) : emptyClassTitle}</p>
      <p class="priority-meta">${esc(classWhen)}</p>
      <button class="text-action" type="button" data-dashboard-action="${next || !progress.assigned ? 'horario' : 'calendario'}">${next ? 'Ver horario' : progress.assigned ? 'Revisar calendario' : 'Completar horario'} ${uiIcon('arrow')}</button>
    </section>
    <section class="priority-item priority-task">
      <h3>${uiIcon('clock')} Entrega más cercana</h3>
      <p class="priority-title">${task ? esc(task.titulo) : 'Todo al día'}</p>
      <p class="priority-meta">${task ? esc(formatoEntrega(task.fechaEntrega)) + (taskSubject ? ' · ' + esc(taskSubject.nombre) : '') : 'Cuando añadas una tarea, la verás aquí.'}</p>
      <button class="text-action" type="button" data-dashboard-action="${task ? 'tareas' : 'nueva-tarea'}">${task ? 'Ver mis tareas' : 'Añadir tarea'} ${uiIcon(task ? 'arrow' : 'plus')}</button>
    </section>`;
}

/* ---------- Render ---------- */
function render() {
  renderDashboard();
  renderAsignaturas();
  renderFaltas();
  renderHorario();
  renderDashboardTasks();
  renderMisTareas();
  renderHistorialView();
  renderConfig();
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
    etapaEl.textContent = (ETAPAS[state.etapa] || {}).label || 'SalvaTuCurso';
  }
}

function renderDashboardStats() {
  const cont = $('#dash-stats');
  const g = calcGlobal();
  const setup = getSetupProgress();
  const hasSubjects = g.activas.length > 0 && (setup.hidden || setup.step === 4);
  cont.classList.toggle('hidden', !hasSubjects);
  if (!hasSubjects) { cont.innerHTML = ''; return; }
  const absences = state.faltas.reduce((s, f) => s + (Number(f.horas) || 0), 0);
  cont.innerHTML = `
    <span><strong>${g.pct == null ? '—' : fmt(g.pct) + '%'}</strong> de asistencia</span>
    <span><strong>${g.activas.length}</strong> asignatura${g.activas.length === 1 ? '' : 's'}</span>
    <span><strong>${fmt(absences)} h</strong> de ausencia</span>`;
}

function renderDashboardAlerts() {
  const cont = $('#dash-alerts');
  if (!cont) return;
  const avisos = [];

  state.asignaturas.filter(a => !a.archivada).forEach(a => {
    const c = calcAsignatura(a);
    const e = estadoAsignatura(a, c);
    if (e.tone === 'red') {
      avisos.push({ type: 'danger', text: `${uiIcon('warning')} <strong>${esc(a.nombre)}</strong>: Límite de asistencia superado (${e.label}).` });
    } else if (e.tone === 'yellow') {
      avisos.push({ type: 'warn', text: `${uiIcon('warning')} <strong>${esc(a.nombre)}</strong>: Cerca del límite de asistencia (${e.label}).` });
    }
  });

  const tareas = (state.tareas || []).filter(t => t.estado === 'pendiente' && t.fechaEntrega);
  tareas.forEach(t => {
    const d = diasHasta(t.fechaEntrega);
    if (d != null && d < 0) {
      avisos.push({ type: 'danger', text: `${uiIcon('clock')} Tarea vencida: <strong>${esc(t.titulo)}</strong> (${esc(t.asignaturaNombre)}).` });
    } else if (d != null && d === 0) {
      avisos.push({ type: 'warn', text: `${uiIcon('clock')} Tarea para hoy: <strong>${esc(t.titulo)}</strong> (${esc(t.asignaturaNombre)}).` });
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
  const schoolStatus = getSchoolDayStatus(now);
  if (!schoolStatus.lectivo) {
    cont.innerHTML = '<div class="quiet-empty"><p>' + esc(schoolDayMessage(schoolStatus)) +
      '</p><button class="text-action" type="button" data-dashboard-action="calendario">Revisar calendario ' + uiIcon('arrow') + '</button></div>';
    return;
  }
  const dayKey = DIAS[(now.getDay() + 6) % 7].key;
  const minute = now.getHours() * 60 + now.getMinutes();
  const rows = h.dias.includes(dayKey) ? h.franjas.filter(f => franjaActivaEnDia(h, f, dayKey) && f.tipo === 'clase').map(f => {
    const c = getCasilla(h, dayKey, f.id);
    const a = c && c.asignaturaId ? asignaturaPorId(c.asignaturaId) : null;
    return { f, a };
  }).filter(row => row.a && !row.a.archivada).sort((x, y) => toMin(x.f.inicio) - toMin(y.f.inicio)) : [];
  if (!rows.length) {
    cont.innerHTML = `<div class="quiet-empty"><p>${getSetupProgress().assigned ? 'Hoy no tienes clases en el horario.' : 'Añade tu primera clase para empezar a organizar tu semana.'}</p><button class="text-action" type="button" data-dashboard-action="horario">Abrir horario ${uiIcon('arrow')}</button></div>`;
    return;
  }
  cont.innerHTML = rows.map(({f, a}) => {
    const isNow = minute >= toMin(f.inicio) && minute < toMin(f.fin);
    return `<div class="dash-class-item ${isNow ? 'active-class' : ''} sc-${a.color}">
      <span class="dc-time">${f.inicio}–${f.fin}</span>
      <span class="dc-name">${esc(a.nombre)}</span>${isNow ? '<span class="badge teal">En curso</span>' : ''}
    </div>`;
  }).join('');
}

function renderDashboardAttendanceSummary() {
  const cont = $('#dash-attendance-summary');

  if (!cont) return;

  const g = calcGlobal();

  const card = cont.closest('.dash-card');
  if (card) card.classList.toggle('hidden', g.activas.length === 0);
  if (g.activas.length === 0) {
    cont.innerHTML = '';
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

  const card = cont.closest('.dash-card');
  if (card) card.classList.toggle('hidden', activas.length === 0);
  if (activas.length === 0) {
    cont.innerHTML = '';
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
    const card = cont.closest('.dash-card');
    if (card) card.classList.add('hidden');
    cont.innerHTML = '';
    return;
  }

  const card = cont.closest('.dash-card');
  if (card) card.classList.remove('hidden');
  cont.innerHTML = `<div class="history-list">` + recientes.map(r => `
    <div class="history-item" style="padding:.5rem .75rem;font-size:.82rem;">
      <div class="h-main">
        <div>${r.texto}</div>
        <div class="h-sub">${esc(r.fecha)}</div>
      </div>
    </div>
  `).join('') + `</div>`;
}

function renderDashboardOnboarding() {
  const cont = $('#dash-onboarding');
  if (!cont) return;
  const progress = getSetupProgress();
  const show = !progress.hidden && progress.step < 4;
  cont.classList.toggle('hidden', !show);
  const grid = $('#dash-grid-main');
  if (grid) grid.classList.toggle('hidden', !progress.subjects.length || show);
  const absenceButton = $('#dash-register-absence');
  if (absenceButton) absenceButton.classList.toggle('hidden', !progress.subjects.length);
  if (!show) {
    cont.innerHTML = !progress.subjects.length ? `<div class="setup-rest"><h3>Tu curso, a tu ritmo</h3><p>Añade tus asignaturas y prepara el horario cuando quieras.</p><button class="btn" type="button" data-dashboard-action="preparar">Preparar mi curso ${uiIcon('arrow')}</button></div>` : '';
    if (!progress.subjects.length) cont.classList.remove('hidden');
    return;
  }
  const titles = ['Elige tu etapa', 'Añade tus asignaturas', 'Coloca tus clases'];
  const descriptions = [
    'Así podrás consultar la asistencia con las opciones de tu enseñanza.',
    'Empieza por una asignatura. Después podrás añadir el resto.',
    'Toca una casilla, elige su asignatura y guarda la clase. Puedes completar el resto después.'
  ];
  const options = Object.entries(ETAPAS).map(([key, item]) => `<option value="${key}" ${state.etapa === key ? 'selected' : ''}>${esc(item.label)}</option>`).join('');
  const stageForm = progress.step === 1 ? `<div class="setup-stage"><label for="setup-etapa">Tu etapa educativa</label><select id="setup-etapa">${options}</select></div>` : '';
  const action = progress.step === 1
    ? `<button class="btn" type="button" data-onboarding-action="confirm-stage">Continuar ${uiIcon('arrow')}</button>`
    : `<button class="btn" type="button" data-dashboard-action="${progress.step === 2 ? 'nueva-asignatura' : 'horario'}">${progress.step === 2 ? 'Añadir asignatura' : 'Abrir mi horario'} ${uiIcon('arrow')}</button>`;
  cont.innerHTML = `
    <div class="setup-heading"><h3>Prepara tu curso</h3><span>Paso ${progress.step} de 3</span></div>
    <ol class="setup-steps" aria-label="Preparación del curso">${['Etapa', 'Asignaturas', 'Horario'].map((label, i) => `<li class="${progress.step > i + 1 ? 'done' : progress.step === i + 1 ? 'current' : ''}" ${progress.step === i + 1 ? 'aria-current="step"' : ''}><span>${progress.step > i + 1 ? uiIcon('check') : i + 1}</span>${label}</li>`).join('')}</ol>
    <div class="setup-content"><h4>${titles[progress.step - 1]}</h4><p>${descriptions[progress.step - 1]}</p>${stageForm}</div>
    <div class="setup-actions">${action}<button class="text-action" type="button" data-onboarding-action="skip">Continuar después</button></div>`;
}

function renderDashboard() {
  renderDashboardWelcome();
  renderDashboardOnboarding();
  renderDashboardStats();
  renderDashboardPriorities();
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
      <div class="esc-icon">${uiIcon('book')}</div>
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


  const recientes = [...state.faltas]
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id))
    .slice(0, 5);
  const cont = $('#falta-recientes');
  cont.innerHTML = recientes.length
    ? `<h3 class="section-title">Últimas faltas</h3><div class="history-list">${recientes.map(histItem).join('')}</div>`
    : '';
}

function renderConfig() {
  renderSchoolCalendar();
  if (typeof SalvaTuCursoTheme !== 'undefined') SalvaTuCursoTheme.syncSettings();
  $('#cfg-etapa').value = state.etapa;
  $('#cfg-zoom').checked = isZoomAllowed();
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
function closeMobileMore(restoreFocus) {
  const menu = $('#mobile-more-menu');
  const button = $('#mobile-more-button');
  if (!menu || !button || menu.hidden) return;
  menu.hidden = true;
  button.ariaExpanded = 'false';
  if (restoreFocus) button.focus();
}

function showView(view) {
  if (view === 'dashboard') renderDashboard();
  if (!$('#view-' + view)) return;
  const moreViews = ['asignaturas', 'historial', 'config'];
  document.querySelectorAll('.nav-btn, .mobile-tab-button').forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle('active', active);
    button.ariaCurrent = active ? 'page' : null;
  });
  const moreButton = $('#mobile-more-button');
  if (moreButton) {
    const moreActive = moreViews.includes(view);
    moreButton.classList.toggle('active', moreActive);
    moreButton.ariaCurrent = moreActive ? 'page' : null;
  }
  document.querySelectorAll('.view').forEach((section) => {
    section.classList.toggle('active', section.id === 'view-' + view);
  });
  closeMobileMore(false);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function bindNav() {
  document.querySelectorAll('.nav-btn[data-view], .mobile-tab-button[data-view], .mobile-more-link[data-view]').forEach((button) => {
    button.addEventListener('click', () => showView(button.dataset.view));
  });

  const moreButton = $('#mobile-more-button');
  const moreMenu = $('#mobile-more-menu');
  if (moreButton && moreMenu) {
    moreButton.addEventListener('click', () => {
      moreMenu.hidden = !moreMenu.hidden;
      moreButton.ariaExpanded = String(!moreMenu.hidden);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMobileMore(true);
    });
    document.addEventListener('click', (event) => {
      if (!moreMenu.hidden && !event.target.closest('#mobile-more-menu, #mobile-more-button')) {
        closeMobileMore(false);
      }
    });
  }

  document.addEventListener('click', (event) => {
    const action = event.target.closest('[data-dashboard-action]');
    if (!action) return;
    const actionName = action.dataset.dashboardAction;
    if (actionName === 'calendario') {
      showView('config');
      $('#school-calendar-card').scrollIntoView({ block: 'start' });
      $('#school-calendar-title').focus({ preventScroll: true });
      return;
    }
    if (actionName === 'preparar') {
      state.config.onboarding.oculto = false;
      state.config.onboarding.etapaConfirmada = false;
      saveState();
      showView('dashboard');
      return;
    }
    if (actionName === 'nueva-tarea') {
      if (!state.asignaturas.some(a => !a.archivada)) { showView('asignaturas'); return; }
      showView('tareas');
      openTaskDialog();
      return;
    }
    const view = actionName === 'nueva-asignatura' ? 'asignaturas' : actionName;
    showView(view);
    if (actionName === 'nueva-asignatura') {
      const toggle = $('#btn-toggle-asig-form');
      const form = $('#asig-form-card');
      if (toggle && form && form.classList.contains('hidden')) toggle.click();
    }
  });
}

function bindOnboarding() {
  const guide = $('#dash-onboarding');
  guide.addEventListener('click', (event) => {
    const button = event.target.closest('[data-onboarding-action]');
    if (!button) return;
    if (button.dataset.onboardingAction === 'confirm-stage') {
      const choice = $('#setup-etapa').value;
      if (!ETAPAS[choice]) return;
      state.etapa = choice;
      state.config.onboarding.etapaConfirmada = true;
    } else {
      state.config.onboarding.oculto = true;
    }
    saveState();
    render();
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

      UndoManager.clear();
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
  $('#cfg-theme').addEventListener('change', (event) => {
    const saved = SalvaTuCursoTheme.setPreference(event.target.value);
    toast(saved ? 'Apariencia actualizada' : 'Tema aplicado. Esta preferencia no se ha podido guardar.');
  });
  $('#cfg-etapa').addEventListener('change', (e) => {
    state.etapa = e.target.value;
    state.config.onboarding.etapaConfirmada = true;
    saveState();
    toast('Etapa actualizada');
    render();
  });

  $('#cfg-zoom').addEventListener('change', (event) => {
    const allowZoom = event.target.checked;
    try {
      localStorage.setItem(ZOOM_PREFERENCE_KEY, String(allowZoom));
      applyZoomPreference(allowZoom);
      toast(allowZoom ? 'Zoom permitido' : 'Zoom desactivado');
    } catch (error) {
      event.target.checked = isZoomAllowed();
      applyZoomPreference();
      toast('No se pudo guardar esta preferencia');
    }
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
  a.download = 'salvatucurso-copia-' + todayISO() + '.json';
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
      UndoManager.clear();
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
  UndoManager.clear();
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

function refreshDashboardTime() {
  if (!state || !state.horario || document.hidden) return false;
  const next = findNextClass();
  const signature = JSON.stringify([todayISO(), getSchoolDayStatus(new Date()), next ? [next.day.key, next.slot.id, next.slot.inicio, next.slot.fin, next.subject.id, next.current, next.offset] : null]);
  if (signature === dashboardClockSignature) return false;
  dashboardClockSignature = signature;

  // Conservar el foco si cambia el bloque en el que se estaba navegando.
  const focused = document.activeElement;
  const container = focused && focused.closest ? focused.closest('#dash-priorities, #dash-tasks-preview') : null;
  const attribute = container ? ['data-dashboard-action', 'data-toggletask', 'data-edittask', 'data-deltask'].find(name => focused.hasAttribute(name)) : null;
  const value = attribute ? focused.getAttribute(attribute) : null;
  renderDashboardWelcome();
  renderDashboardPriorities();
  renderDashboardAlerts();
  renderDashboardClassesToday();
  renderDashboardTasks();
  if (container && attribute) {
    const replacement = Array.from(container.querySelectorAll('button, input')).find(el => el.getAttribute(attribute) === value);
    if (replacement) replacement.focus({ preventScroll: true });
  }
  return true;
}

function scheduleDashboardRefresh() {
  if (dashboardRefreshTimer !== null) clearTimeout(dashboardRefreshTimer);
  dashboardRefreshTimer = null;
  if (document.hidden) return;
  refreshDashboardTime();
  // Alinear con el minuto siguiente y recuperar los cambios tras una suspensión.
  dashboardRefreshTimer = setTimeout(scheduleDashboardRefresh, 60000 - (Date.now() % 60000) + 25);
}

function bindDashboardRefresh() {
  if (dashboardRefreshBound) return;
  dashboardRefreshBound = true;
  document.addEventListener('visibilitychange', scheduleDashboardRefresh);
  window.addEventListener('focus', scheduleDashboardRefresh);
  window.addEventListener('pageshow', scheduleDashboardRefresh);
  scheduleDashboardRefresh();
}

/* ---------- Inicio ---------- */
function init() {
  applyZoomPreference();
  loadState();
  initColorPicker('#asig-color-picker', '#asig-color');
  initColorPicker('#dlg-color-picker', '#dlg-color');
  setColorPicker('#asig-color-picker', '#asig-color', PALETA[state.asignaturas.length % PALETA.length]);
  bindNav();
  bindOnboarding();
  bindAsignaturas();
  bindDialog();
  bindDialogFalta();
  bindFaltas();
  bindSchedule();
  bindTasks();
  bindHistory();
  bindConfig();
  bindSchoolCalendar();
  setupInstall();
  render();
  UndoManager.bind();
  bindDashboardRefresh();
}

document.addEventListener('DOMContentLoaded', init);
