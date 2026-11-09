/* ============================================================
   Mi Asistencia — history.js
   Gestión del historial de ausencias, calendario mensual visual
   y estadísticas filtradas.
   ============================================================ */

let historyYear = new Date().getFullYear();
let historyMonth = new Date().getMonth();

const MESES_NOMBRES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function renderHistorialStats() {
  const cont = $('#history-stats');
  if (!cont) return;

  const items = getFilteredFaltas();
  const totalRegistros = items.length;
  const totalHoras = items.reduce((s, f) => s + (Number(f.horas) || 0), 0);
  const asigsAfectadas = new Set(items.map(f => f.asignaturaId)).size;

  cont.innerHTML = `
    <div class="stat">
      <span class="stat-label">Registros</span>
      <span class="stat-value">${totalRegistros}</span>
      <span class="stat-sub">faltas anotadas</span>
    </div>
    <div class="stat">
      <span class="stat-label">Horas ausentes</span>
      <span class="stat-value">${fmt(totalHoras)} h</span>
      <span class="stat-sub">acumuladas</span>
    </div>
    <div class="stat">
      <span class="stat-label">Asignaturas</span>
      <span class="stat-value">${asigsAfectadas}</span>
      <span class="stat-sub">afectadas</span>
    </div>
    <div class="stat">
      <span class="stat-label">Mes consultado</span>
      <span class="stat-value" style="font-size:1.15rem;">${MESES_NOMBRES[historyMonth]}</span>
      <span class="stat-sub">${historyYear}</span>
    </div>
  `;
}

function getFilteredFaltas() {
  const fa = $('#filtro-asig') ? $('#filtro-asig').value : '';
  const ft = $('#filtro-tipo') ? $('#filtro-tipo').value : '';
  const desde = $('#filtro-desde') ? $('#filtro-desde').value : '';
  const hasta = $('#filtro-hasta') ? $('#filtro-hasta').value : '';
  const orden = $('#filtro-orden') ? $('#filtro-orden').value : 'recientes';

  let items = [...(state.faltas || [])];
  if (fa) items = items.filter(f => f.asignaturaId === fa);
  if (ft) items = items.filter(f => f.tipo === ft);
  if (desde) items = items.filter(f => f.fecha >= desde);
  if (hasta) items = items.filter(f => f.fecha <= hasta);

  items.sort((a, b) => {
    const cmp = b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id);
    return orden === 'antiguos' ? -cmp : cmp;
  });

  return items;
}

function renderHistoryCalendar() {
  const titleEl = $('#cal-month-title');
  const gridEl = $('#cal-grid');
  if (!titleEl || !gridEl) return;

  titleEl.textContent = `${MESES_NOMBRES[historyMonth]} ${historyYear}`;

  const firstDay = new Date(historyYear, historyMonth, 1);
  const lastDay = new Date(historyYear, historyMonth + 1, 0);
  const daysInMonth = lastDay.getDate();
  
  let startDay = firstDay.getDay() - 1;
  if (startDay === -1) startDay = 6;

  const faltas = state.faltas || [];
  const faltasPorFecha = {};
  faltas.forEach(f => {
    if (!faltasPorFecha[f.fecha]) faltasPorFecha[f.fecha] = [];
    faltasPorFecha[f.fecha].push(f);
  });

  let html = `
    <div class="cal-header-day">Lun</div>
    <div class="cal-header-day">Mar</div>
    <div class="cal-header-day">Mié</div>
    <div class="cal-header-day">Jue</div>
    <div class="cal-header-day">Vie</div>
    <div class="cal-header-day">Sáb</div>
    <div class="cal-header-day">Dom</div>
  `;

  for (let i = 0; i < startDay; i++) {
    html += `<div class="cal-day other-month" aria-hidden="true"></div>`;
  }

  const todayStr = todayISO();

  for (let day = 1; day <= daysInMonth; day++) {
    const mStr = String(historyMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const dateStr = `${historyYear}-${mStr}-${dStr}`;
    const dayFaltas = faltasPorFecha[dateStr] || [];
    const hasFalta = dayFaltas.length > 0;
    const isToday = dateStr === todayStr;

    html += `
      <button type="button" class="cal-day ${isToday ? 'today' : ''} ${hasFalta ? 'has-absence' : ''}" data-caldate="${dateStr}">
        <span class="cal-day-num">${day}</span>
        ${hasFalta ? `<span class="cal-badge">${dayFaltas.reduce((s, x) => s + x.horas, 0)}h</span>` : ''}
      </button>
    `;
  }

  gridEl.innerHTML = html;
}

function openHistoryDayModal(dateStr) {
  const faltas = (state.faltas || []).filter(f => f.fecha === dateStr);
  const titleEl = $('#dlg-day-title');
  const bodyEl = $('#dlg-day-body');
  if (!titleEl || !bodyEl) return;

  titleEl.textContent = `Ausencias del ${dateStr}`;
  if (faltas.length === 0) {
    bodyEl.innerHTML = `<p class="muted" style="padding:1rem 0;text-align:center;">No hay ausencias registradas para esta fecha.</p>`;
  } else {
    const totalH = faltas.reduce((s, x) => s + x.horas, 0);
    bodyEl.innerHTML = `
      <p class="muted" style="margin-bottom:.75rem;font-weight:700;">Total ausente: ${fmt(totalH)} horas</p>
      <div class="history-list">
        ${faltas.map(f => {
          const a = asignaturaPorId(f.asignaturaId);
          return `
            <div class="history-item sc-${a ? a.color : 'gris'}">
              <div class="h-main">
                <div><strong>${esc(a ? a.nombre : 'Asignatura eliminada')}</strong></div>
                <div class="h-sub">${f.tipo === 'justificada' ? 'Justificada' : 'No justificada'}${f.motivo ? ' · ' + esc(f.motivo) : ''}</div>
              </div>
              <div style="display:flex;align-items:center;gap:.4rem">
                <span class="h-hours">${fmt(f.horas)} h</span>
                <button class="btn btn-ghost btn-sm" type="button" data-editfalta="${f.id}">Editar</button>
                <button class="btn btn-danger btn-sm" type="button" data-delfalta="${f.id}">×</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }
  $('#dialog-history-day').showModal();
}

function renderHistoryList() {
  const items = getFilteredFaltas();
  const cont = $('#historial-list');
  if (!cont) return;

  if (items.length === 0) {
    cont.innerHTML = `
      <div class="empty-state-card">
        <div class="esc-icon">📋</div>
        <h3>Todavía no tienes ausencias registradas</h3>
        <p>Cuando registres una falta, aparecerá aquí organizada cronológicamente para que puedas consultar tu historial.</p>
      </div>
    `;
    return;
  }

  cont.innerHTML = items.map(f => {
    const a = asignaturaPorId(f.asignaturaId);
    const color = a ? a.color : 'gris';
    return `
      <div class="history-item sc-${color}">
        <div class="h-main">
          <div><strong>${esc(a ? a.nombre : 'Asignatura eliminada')}</strong></div>
          <div class="h-sub">${esc(f.fecha)} · <span class="badge ${f.tipo === 'justificada' ? 'green' : 'red'}">${f.tipo === 'justificada' ? 'Justificada' : 'No justificada'}</span>${f.motivo ? ' · ' + esc(f.motivo) : ''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:.5rem">
          <span class="h-hours">${fmt(f.horas)} h</span>
          <button class="btn btn-ghost btn-sm" type="button" data-editfalta="${f.id}" aria-label="Editar falta">Editar</button>
          <button class="btn btn-danger btn-sm" type="button" data-delfalta="${f.id}" aria-label="Eliminar falta">×</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderHistorialView() {
  renderHistorialStats();
  renderHistoryCalendar();
  renderHistoryList();
}

function bindHistory() {
  const asigSel = $('#filtro-asig');
  if (asigSel) {
    const prev = asigSel.value;
    asigSel.innerHTML = `<option value="">Todas las asignaturas</option>` +
      state.asignaturas.map(a => `<option value="${a.id}">${esc(a.nombre)}</option>`).join('');
    if (prev && state.asignaturas.some(a => a.id === prev)) asigSel.value = prev;
  }

  ['#filtro-asig', '#filtro-tipo', '#filtro-desde', '#filtro-hasta', '#filtro-orden'].forEach(sel => {
    const el = $(sel);
    if (el) el.addEventListener('change', renderHistorialView);
  });

  const btnLimpiar = $('#btn-limpiar-filtros');
  if (btnLimpiar) {
    btnLimpiar.addEventListener('click', () => {
      if ($('#filtro-asig')) $('#filtro-asig').value = '';
      if ($('#filtro-tipo')) $('#filtro-tipo').value = '';
      if ($('#filtro-desde')) $('#filtro-desde').value = '';
      if ($('#filtro-hasta')) $('#filtro-hasta').value = '';
      if ($('#filtro-orden')) $('#filtro-orden').value = 'recientes';
      renderHistorialView();
    });
  }

  const prevM = $('#cal-prev');
  const nextM = $('#cal-next');
  const todayM = $('#cal-today');

  if (prevM) {
    prevM.addEventListener('click', () => {
      historyMonth -= 1;
      if (historyMonth < 0) { historyMonth = 11; historyYear -= 1; }
      renderHistoryCalendar();
    });
  }
  if (nextM) {
    nextM.addEventListener('click', () => {
      historyMonth += 1;
      if (historyMonth > 11) { historyMonth = 0; historyYear += 1; }
      renderHistoryCalendar();
    });
  }
  if (todayM) {
    todayM.addEventListener('click', () => {
      const now = new Date();
      historyYear = now.getFullYear();
      historyMonth = now.getMonth();
      renderHistoryCalendar();
    });
  }

  const calGrid = $('#cal-grid');
  if (calGrid) {
    calGrid.addEventListener('click', (e) => {
      const dayBtn = e.target.closest('[data-caldate]');
      if (!dayBtn) return;
      openHistoryDayModal(dayBtn.dataset.caldate);
    });
  }

  const closeDayModal = $('#dlg-day-close');
  if (closeDayModal) closeDayModal.addEventListener('click', () => $('#dialog-history-day').close());
}
