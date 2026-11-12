/* ============================================================
   Mi Asistencia — tasks.js
   Gestión completa de agenda académica (deberes, exámenes, trabajos, notas)
   vinculada a clases del horario y asignaturas.
   ============================================================ */

let editingTaskId = null;
let activeSlotContext = null;

const TIPOS_TAREA = {
  deberes: { label: 'Deberes', badge: 'blue', icon: '📝' },
  estudiar: { label: 'Estudiar', badge: 'purple', icon: '📖' },
  examen: { label: 'Examen', badge: 'red', icon: '📝' },
  trabajo: { label: 'Trabajo', badge: 'orange', icon: '📊' },
  proyecto: { label: 'Proyecto', badge: 'orange', icon: '🚀' },
  otros: { label: 'Otros', badge: 'gray', icon: '📌' },
  nota: { label: 'Nota personal', badge: 'teal', icon: '💡' }
};

const PRIORIDADES = {
  baja: { label: 'Baja', cls: 'p-low' },
  normal: { label: 'Normal', cls: 'p-normal' },
  alta: { label: 'Alta', cls: 'p-high' }
};

/* ---------- Utilidades de fecha y estado ---------- */
function diasHasta(fechaStr) {
  if (!fechaStr) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const entrega = new Date(fechaStr + 'T00:00:00');
  const diffTime = entrega - hoy;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function calcularEstadoVisualTask(t) {
  if (t.estado === 'completada') return { tone: 'green', label: 'Completada', cls: 'ok' };
  const d = diasHasta(t.fechaEntrega);
  if (d != null && d < 0) return { tone: 'red', label: 'Vencida (' + Math.abs(d) + 'd)', cls: 'over' };
  if (t.prioridad === 'alta') return { tone: 'red', label: 'Prioridad alta', cls: 'over' };
  if (d != null && d <= 2) return { tone: 'yellow', label: 'Próxima (' + (d === 0 ? 'hoy' : d + 'd') + ')', cls: 'miss' };
  return { tone: 'blue', label: 'Pendiente', cls: 'none' };
}

/* ---------- Consultas de tareas ---------- */
function getTareasForSlot(slotKey) {
  if (!state || !state.tareas) return [];
  return state.tareas.filter(t => t.slotKey === slotKey);
}

function getTareasForAsignatura(asignaturaId) {
  if (!state || !state.tareas) return [];
  return state.tareas.filter(t => t.asignaturaId === asignaturaId);
}

function countTareasPendientesSlot(slotKey) {
  return getTareasForSlot(slotKey).filter(t => t.estado === 'pendiente').length;
}

function countTareasPendientesAsignatura(asignaturaId) {
  return getTareasForAsignatura(asignaturaId).filter(t => t.estado === 'pendiente').length;
}

/* ---------- Acciones de tareas ---------- */
function crearTarea(data) {
  if (!state.tareas) state.tareas = [];
  const a = asignaturaPorId(data.asignaturaId);
  const nueva = {
    id: uid(),
    asignaturaId: String(data.asignaturaId),
    asignaturaNombre: a ? a.nombre : String(data.asignaturaNombre || ''),
    slotKey: data.slotKey ? String(data.slotKey) : '',
    dia: String(data.dia || ''),
    horaInicio: String(data.horaInicio || ''),
    horaFin: String(data.horaFin || ''),
    fechaCreacion: todayISO(),
    fechaEntrega: data.fechaEntrega ? String(data.fechaEntrega) : '',
    tipo: TIPOS_TAREA[data.tipo] ? data.tipo : 'deberes',
    prioridad: PRIORIDADES[data.prioridad] ? data.prioridad : 'normal',
    estado: data.estado === 'completada' ? 'completada' : 'pendiente',
    titulo: String(data.titulo || '').trim(),
    descripcion: String(data.descripcion || '').trim()
  };
  state.tareas.push(nueva);
  saveState();
  return nueva;
}

function actualizarTarea(id, data) {
  const t = state.tareas.find(x => x.id === id);
  if (!t) return false;
  t.asignaturaId = String(data.asignaturaId);
  const a = asignaturaPorId(t.asignaturaId);
  t.asignaturaNombre = a ? a.nombre : t.asignaturaNombre;
  t.titulo = String(data.titulo || '').trim();
  t.descripcion = String(data.descripcion || '').trim();
  t.tipo = TIPOS_TAREA[data.tipo] ? data.tipo : 'deberes';
  t.prioridad = PRIORIDADES[data.prioridad] ? data.prioridad : 'normal';
  t.fechaEntrega = data.fechaEntrega ? String(data.fechaEntrega) : '';
  if (data.estado) t.estado = data.estado === 'completada' ? 'completada' : 'pendiente';
  saveState();
  return true;
}

function eliminarTarea(id) {
  if (!confirm('¿Eliminar esta actividad o nota? Esta acción no se puede deshacer.')) return;
  state.tareas = state.tareas.filter(x => x.id !== id);
  saveState();
  toast('Actividad eliminada');
  render();
}

function alternarEstadoTarea(id) {
  const t = state.tareas.find(x => x.id === id);
  if (!t) return;
  t.estado = t.estado === 'completada' ? 'pendiente' : 'completada';
  saveState();
  toast(t.estado === 'completada' ? 'Marcada como completada' : 'Marcada como pendiente');
  render();
}

/* ---------- Diálogos e Interfaz de Tareas ---------- */
function openTaskDialog(prefill = {}) {
  editingTaskId = null;
  const asigs = state.asignaturas.filter(a => !a.archivada);
  const selAsig = $('#dlg-task-asig');
  if (selAsig) {
    selAsig.innerHTML = asigs.length
      ? asigs.map(a => `<option value="${a.id}">${esc(a.nombre)}</option>`).join('')
      : '<option value="">— Añade asignaturas primero —</option>';
    if (prefill.asignaturaId) selAsig.value = prefill.asignaturaId;
  }

  $('#dlg-task-title').textContent = 'Nueva actividad o nota';
  $('#dlg-task-titulo').value = '';
  $('#dlg-task-desc').value = '';
  $('#dlg-task-tipo').value = prefill.tipo || 'deberes';
  $('#dlg-task-prioridad').value = prefill.prioridad || 'normal';
  $('#dlg-task-fecha').value = prefill.fechaEntrega || '';
  $('#dlg-task-estado').value = 'pendiente';

  activeSlotContext = prefill.slotKey ? {
    slotKey: prefill.slotKey,
    dia: prefill.dia,
    horaInicio: prefill.horaInicio,
    horaFin: prefill.horaFin
  } : null;

  $('#dialog-task').showModal();
}

function openTaskEditDialog(id) {
  const t = state.tareas.find(x => x.id === id);
  if (!t) return;
  editingTaskId = id;
  const asigs = state.asignaturas.filter(a => !a.archivada);
  const selAsig = $('#dlg-task-asig');
  if (selAsig) {
    selAsig.innerHTML = asigs.map(a => `<option value="${a.id}">${esc(a.nombre)}</option>`).join('');
    selAsig.value = t.asignaturaId;
  }

  $('#dlg-task-title').textContent = 'Editar actividad o nota';
  $('#dlg-task-titulo').value = t.titulo;
  $('#dlg-task-desc').value = t.descripcion;
  $('#dlg-task-tipo').value = t.tipo;
  $('#dlg-task-prioridad').value = t.prioridad;
  $('#dlg-task-fecha').value = t.fechaEntrega;
  $('#dlg-task-estado').value = t.estado;

  activeSlotContext = t.slotKey ? {
    slotKey: t.slotKey,
    dia: t.dia,
    horaInicio: t.horaInicio,
    horaFin: t.horaFin
  } : null;

  $('#dialog-task').showModal();
}

function guardarTareaModal() {
  const titulo = $('#dlg-task-titulo').value.trim();
  const asignaturaId = $('#dlg-task-asig').value;
  if (!titulo) return toast('Escribe un título para la actividad');
  if (!asignaturaId) return toast('Selecciona una asignatura');

  const a = asignaturaPorId(asignaturaId);
  const tipo = $('#dlg-task-tipo').value;
  const prioridad = $('#dlg-task-prioridad').value;
  const fechaEntrega = $('#dlg-task-fecha').value;
  const estado = $('#dlg-task-estado').value;
  const descripcion = $('#dlg-task-desc').value.trim();

  const data = {
    asignaturaId,
    asignaturaNombre: a ? a.nombre : '',
    titulo,
    descripcion,
    tipo,
    prioridad,
    fechaEntrega,
    estado,
    slotKey: activeSlotContext ? activeSlotContext.slotKey : '',
    dia: activeSlotContext ? activeSlotContext.dia : '',
    horaInicio: activeSlotContext ? activeSlotContext.horaInicio : '',
    horaFin: activeSlotContext ? activeSlotContext.horaFin : ''
  };

  if (editingTaskId) {
    actualizarTarea(editingTaskId, data);
    toast('Actividad actualizada');
  } else {
    crearTarea(data);
    toast('Actividad creada');
  }

  $('#dialog-task').close();
  render();
}

/* ---------- Panel de detalle de clase ---------- */
function openClassDetail(day, fid) {
  const h = state.horario;
  const f = h.franjas.find(x => x.id === fid);
  const c = getCasilla(h, day, fid);
  if (!f || !c || !c.asignaturaId) return;

  const a = asignaturaPorId(c.asignaturaId);
  if (!a) return;

  const slotKey = day + '|' + fid;
  const tareasSlot = getTareasForSlot(slotKey);
  const tareasAsig = getTareasForAsignatura(a.id);

  const container = $('#dialog-class-body');
  if (!container) return;

  container.innerHTML = `
    <div class="class-detail-header sc-${a.color}">
      <span class="color-dot"></span>
      <div>
        <h3>${esc(a.nombre)}</h3>
        <p class="muted">${diaLabel(day)} · ${f.inicio}–${f.fin}</p>
      </div>
    </div>

    <div class="class-actions-bar" style="margin-top:1rem">
      <button class="btn btn-sm" type="button" id="btn-class-add-task" data-slot="${slotKey}" data-asig="${a.id}" data-dia="${day}" data-inicio="${f.inicio}" data-fin="${f.fin}">➕ Añadir tarea / examen</button>
      <button class="btn btn-ghost btn-sm" type="button" id="btn-class-add-note" data-slot="${slotKey}" data-asig="${a.id}" data-dia="${day}" data-inicio="${f.inicio}" data-fin="${f.fin}">📝 Añadir nota</button>
    </div>

    <div class="class-tasks-section" style="margin-top:1.25rem">
      <h4 class="section-title" style="margin-top:0">Tareas de esta sesión (${tareasSlot.length})</h4>
      ${tareasSlot.length === 0 ? '<p class="muted" style="font-size:0.85rem">No hay actividades registradas para esta clase concreta.</p>' : ''}
      <div class="tasks-mini-list">
        ${tareasSlot.map(t => renderTaskMiniCard(t)).join('')}
      </div>

      <h4 class="section-title" style="margin-top:1.25rem">Otras tareas de ${esc(a.nombre)} (${tareasAsig.filter(t => t.slotKey !== slotKey).length})</h4>
      <div class="tasks-mini-list">
        ${tareasAsig.filter(t => t.slotKey !== slotKey).length === 0 ? '<p class="muted" style="font-size:0.85rem">Sin otras tareas para esta asignatura.</p>' : tareasAsig.filter(t => t.slotKey !== slotKey).map(t => renderTaskMiniCard(t)).join('')}
      </div>
    </div>
  `;

  $('#dialog-class-detail').showModal();
}

function renderTaskMiniCard(t) {
  const st = calcularEstadoVisualTask(t);
  const tipoInfo = TIPOS_TAREA[t.tipo] || TIPOS_TAREA.deberes;
  return `
    <div class="task-mini-item ${t.estado === 'completada' ? 'completed' : ''}">
      <input type="checkbox" data-toggletask="${t.id}" ${t.estado === 'completada' ? 'checked' : ''} aria-label="Marcar completada">
      <div class="tmi-main">
        <div class="tmi-title">${tipoInfo.icon} ${esc(t.titulo)}</div>
        <div class="tmi-sub">${tipoInfo.label}${t.fechaEntrega ? ' · Entrega: ' + esc(t.fechaEntrega) : ''}</div>
      </div>
      <span class="badge ${st.tone}">${st.label}</span>
      <button class="btn btn-ghost btn-sm" type="button" data-edittask="${t.id}" aria-label="Editar">✎</button>
      <button class="btn btn-danger btn-sm" type="button" data-deltask="${t.id}" aria-label="Eliminar">×</button>
    </div>
  `;
}

/* ---------- Render: Vista «Mis tareas» ---------- */
function renderMisTareas() {
  const tareas = state.tareas || [];
  const pendientes = tareas.filter(t => t.estado === 'pendiente');
  const completadas = tareas.filter(t => t.estado === 'completada');
  const prioridadAlta = pendientes.filter(t => t.prioridad === 'alta');
  const proximas = pendientes.filter(t => {
    const d = diasHasta(t.fechaEntrega);
    return d != null && d >= 0 && d <= 3;
  });

  const statsEl = $('#tasks-stats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="stat">
        <span class="stat-label">Pendientes</span>
        <span class="stat-value">${pendientes.length}</span>
        <span class="stat-sub">actividades</span>
      </div>
      <div class="stat">
        <span class="stat-label">Próximas (3 días)</span>
        <span class="stat-value">${proximas.length}</span>
        <span class="stat-sub">vencimiento cercano</span>
      </div>
      <div class="stat">
        <span class="stat-label">Prioridad alta</span>
        <span class="stat-value">${prioridadAlta.length}</span>
        <span class="stat-sub">urgentes</span>
      </div>
      <div class="stat">
        <span class="stat-label">Completadas</span>
        <span class="stat-value">${completadas.length}</span>
        <span class="stat-sub">historial</span>
      </div>
    `;
  }

  const filtroAsig = $('#task-filtro-asig');
  const prevAsig = filtroAsig ? filtroAsig.value : '';
  if (filtroAsig) {
    filtroAsig.innerHTML = `<option value="">Todas las asignaturas</option>` +
      state.asignaturas.map(a => `<option value="${a.id}">${esc(a.nombre)}</option>`).join('');
    if (prevAsig) filtroAsig.value = prevAsig;
  }

  const fa = filtroAsig ? filtroAsig.value : '';
  const ft = $('#task-filtro-tipo') ? $('#task-filtro-tipo').value : '';
  const fe = $('#task-filtro-estado') ? $('#task-filtro-estado').value : 'pendiente';
  const fp = $('#task-filtro-prioridad') ? $('#task-filtro-prioridad').value : '';

  let lista = [...tareas];
  if (fa) lista = lista.filter(t => t.asignaturaId === fa);
  if (ft) lista = lista.filter(t => t.tipo === ft);
  if (fe && fe !== 'todos') lista = lista.filter(t => t.estado === fe);
  if (fp) lista = lista.filter(t => t.prioridad === fp);

  lista.sort((a, b) => {
    if (a.estado !== b.estado) return a.estado === 'pendiente' ? -1 : 1;
    if (!a.fechaEntrega && !b.fechaEntrega) return b.fechaCreacion.localeCompare(a.fechaCreacion);
    if (!a.fechaEntrega) return 1;
    if (!b.fechaEntrega) return -1;
    return a.fechaEntrega.localeCompare(b.fechaEntrega);
  });

  const cont = $('#tasks-list');
  if (!cont) return;

  if (lista.length === 0) {
    cont.innerHTML = `
      <div class="empty-state-card">
        <div class="esc-icon">🎯</div>
        <h3>¡Todo organizado!</h3>
        <p>No hay actividades ni notas que coincidan con los filtros seleccionados. Puedes añadir una nueva tarea pulsando el botón superior o desde tu horario.</p>
      </div>
    `;
    return;
  }

  cont.innerHTML = lista.map(t => {
    const a = asignaturaPorId(t.asignaturaId);
    const color = a ? a.color : 'azul';
    const st = calcularEstadoVisualTask(t);
    const tipoInfo = TIPOS_TAREA[t.tipo] || TIPOS_TAREA.deberes;

    return `
      <div class="task-card sc-${color} ${t.estado === 'completada' ? 'completed' : ''}">
        <div class="tc-top">
          <input type="checkbox" data-toggletask="${t.id}" ${t.estado === 'completada' ? 'checked' : ''} aria-label="Marcar completada">
          <div class="tc-info">
            <span class="badge ${tipoInfo.badge}">${tipoInfo.icon} ${tipoInfo.label}</span>
            <span class="badge ${st.tone}">${st.label}</span>
            ${t.prioridad === 'alta' ? '<span class="badge red">Alta</span>' : ''}
          </div>
          <div class="tc-actions">
            <button class="btn btn-ghost btn-sm" type="button" data-edittask="${t.id}" aria-label="Editar">Editar</button>
            <button class="btn btn-danger btn-sm" type="button" data-deltask="${t.id}" aria-label="Eliminar">×</button>
          </div>
        </div>
        <div class="tc-title">${esc(t.titulo)}</div>
        ${t.descripcion ? `<div class="tc-desc">${esc(t.descripcion)}</div>` : ''}
        <div class="tc-footer">
          <span>📚 <strong>${esc(a ? a.nombre : t.asignaturaNombre || 'Asignatura')}</strong></span>
          ${t.dia ? `<span>📅 ${diaLabel(t.dia)} (${t.horaInicio}–${t.horaFin})</span>` : ''}
          ${t.fechaEntrega ? `<span>⏰ Entrega: ${esc(t.fechaEntrega)}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

/* ---------- Render: Dashboard Tasks Widget ---------- */
function renderDashboardTasks() {
  const cont = $('#dash-tasks-preview');
  if (!cont) return;
  const tareas = (state.tareas || []).filter(t => t.estado === 'pendiente');
  tareas.sort((a, b) => {
    if (!a.fechaEntrega && !b.fechaEntrega) return 0;
    if (!a.fechaEntrega) return 1;
    if (!b.fechaEntrega) return -1;
    return a.fechaEntrega.localeCompare(b.fechaEntrega);
  });

  const proximas = tareas.slice(0, 4);

  if (proximas.length === 0) {
    cont.innerHTML = `
      <div class="card" style="margin-top:1rem">
        <h3 class="section-title" style="margin-top:0">Próximas tareas</h3>
        <p class="muted" style="font-size:0.85rem">¡Todo al día! No tienes tareas pendientes en este momento.</p>
      </div>
    `;
    return;
  }

  cont.innerHTML = `
    <div class="card" style="margin-top:1rem">
      <div class="schedule-config-head" style="margin-bottom:.5rem">
        <h3 class="section-title" style="margin-top:0">Próximas tareas (${tareas.length} pendientes)</h3>
        <button class="btn btn-ghost btn-sm" type="button" onclick="document.querySelector('.nav-btn[data-view=\"tareas\"]').click()">Ver todas</button>
      </div>
      <div class="tasks-mini-list">
        ${proximas.map(t => renderTaskMiniCard(t)).join('')}
      </div>
    </div>
  `;
}

/* ---------- Eventos de tareas ---------- */
function bindTasks() {
  const btnAdd = $('#btn-global-add-task');
  if (btnAdd) btnAdd.addEventListener('click', () => openTaskDialog());

  const saveBtn = $('#dlg-task-save');
  if (saveBtn) saveBtn.addEventListener('click', guardarTareaModal);
  const closeBtn = $('#dlg-task-close');
  if (closeBtn) closeBtn.addEventListener('click', () => $('#dialog-task').close());
  const cancelBtn = $('#dlg-task-cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', () => $('#dialog-task').close());

  ['#task-filtro-asig', '#task-filtro-tipo', '#task-filtro-estado', '#task-filtro-prioridad'].forEach(sel => {
    const el = $(sel);
    if (el) el.addEventListener('change', renderMisTareas);
  });

  document.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-toggletask]');
    if (toggle) {
      alternarEstadoTarea(toggle.dataset.toggletask);
      return;
    }
    const edit = e.target.closest('[data-edittask]');
    if (edit) {
      openTaskEditDialog(edit.dataset.edittask);
      return;
    }
    const del = e.target.closest('[data-deltask]');
    if (del) {
      eliminarTarea(del.dataset.deltask);
      return;
    }

    const addTaskFromClass = e.target.closest('#btn-class-add-task');
    if (addTaskFromClass) {
      const ds = addTaskFromClass.dataset;
      $('#dialog-class-detail').close();
      openTaskDialog({
        slotKey: ds.slot,
        asignaturaId: ds.asig,
        dia: ds.dia,
        horaInicio: ds.inicio,
        horaFin: ds.fin,
        tipo: 'deberes'
      });
      return;
    }

    const addNoteFromClass = e.target.closest('#btn-class-add-note');
    if (addNoteFromClass) {
      const ds = addNoteFromClass.dataset;
      $('#dialog-class-detail').close();
      openTaskDialog({
        slotKey: ds.slot,
        asignaturaId: ds.asig,
        dia: ds.dia,
        horaInicio: ds.inicio,
        horaFin: ds.fin,
        tipo: 'nota'
      });
      return;
    }
  });

  const closeClassDetail = $('#dlg-class-close');
  if (closeClassDetail) closeClassDetail.addEventListener('click', () => $('#dialog-class-detail').close());
}
