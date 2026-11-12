/* Calendario manual: fechas civiles locales y periodos sin clase. */
let editingCalendarPeriod = null;
let calendarPeriodSnapshot = '';

function validCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 &&
    day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}
function calendarDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  return date;
}
function calendarISO(date) {
  const value = String(date.getFullYear()).padStart(4, '0') + '-' +
    String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  return validCalendarDate(value) ? value : '';
}
function calendarAddDays(value, days) {
  const date = calendarDate(value);
  date.setDate(date.getDate() + days);
  return calendarISO(date);
}
function calendarDayNumber(value) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 86400000);
}
function formatCalendarDate(value) {
  return calendarDate(value).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}
function normalizeCalendar(input) {
  const value = input && typeof input === 'object' ? input : {};
  const paired = validCalendarDate(value.inicio) && validCalendarDate(value.fin) && value.inicio <= value.fin;
  const ids = new Set();
  const periods = (Array.isArray(value.noLectivos) ? value.noLectivos : []).filter(period => period &&
    validCalendarDate(period.inicio) && (period.fin == null || period.fin === '' || validCalendarDate(period.fin)) &&
    (period.fin == null || period.fin === '' || period.inicio <= period.fin)).map(period => {
    let id = typeof period.id === 'string' && period.id ? period.id : uid();
    if (ids.has(id)) id = uid();
    ids.add(id);
    return { id, nombre: typeof period.nombre === 'string' ? period.nombre.trim() : '',
      inicio: period.inicio, fin: period.fin || period.inicio };
  });
  periods.sort((a, b) => a.inicio.localeCompare(b.inicio) || a.fin.localeCompare(b.fin));
  return { inicio: paired ? value.inicio : '', fin: paired ? value.fin : '', noLectivos: periods };
}
function calendarBlocks(calendar) {
  const blocks = [];
  calendar.noLectivos.slice().sort((a, b) => a.inicio.localeCompare(b.inicio)).forEach(period => {
    const previous = blocks[blocks.length - 1];
    if (previous && period.inicio <= (calendarAddDays(previous.fin, 1) || previous.fin)) {
      if (period.fin > previous.fin) previous.fin = period.fin;
    } else blocks.push({ inicio: period.inicio, fin: period.fin });
  });
  return blocks;
}
function getSchoolDayStatus(date, calendar = state.config.calendario, days = state.horario.dias) {
  const iso = typeof date === 'string' ? date : calendarISO(date);
  if (!validCalendarDate(iso)) return { lectivo: false, motivo: 'invalido' };
  if (calendar.inicio && iso < calendar.inicio) return { lectivo: false, motivo: 'antes', fecha: calendar.inicio };
  if (calendar.fin && iso > calendar.fin) return { lectivo: false, motivo: 'despues', fecha: calendar.fin };
  const period = calendar.noLectivos.find(item => iso >= item.inicio && iso <= item.fin);
  if (period) {
    const block = calendarBlocks(calendar).find(item => iso >= item.inicio && iso <= item.fin);
    return { lectivo: false, motivo: 'noLectivo', nombre: period.nombre || 'Día sin clase', hasta: block.fin };
  }
  const day = DIAS[(calendarDate(iso).getDay() + 6) % 7].key;
  return days.includes(day) ? { lectivo: true, motivo: 'lectivo' } : { lectivo: false, motivo: 'semana' };
}
function schoolDayMessage(status) {
  if (status.motivo === 'antes') return 'El curso empieza el ' + formatCalendarDate(status.fecha) + '.';
  if (status.motivo === 'despues') return 'El curso ha finalizado. Terminó el ' + formatCalendarDate(status.fecha) + '.';
  if (status.motivo === 'noLectivo') return status.nombre === 'Día sin clase' ? 'Hoy no tienes clases según tu calendario.' : 'Hoy no hay clases: ' + status.nombre + '.';
  return 'Hoy no tienes clases en el horario.';
}
function persistCalendar(next, feedbackSelector = null) {
  const previous = state.config.calendario;
  const report = message => { if (feedbackSelector) $(feedbackSelector).textContent = message; else toast(message); };
  try {
    if (!isStoredStateCurrent()) {
      report('Los datos han cambiado en otra pestaña. Recarga antes de guardar.');
      return false;
    }
    state.config.calendario = normalizeCalendar(next);
    saveState();
  } catch (error) {
    state.config.calendario = previous;
    report('No se ha podido guardar el calendario. Tus datos siguen igual.');
    return false;
  }
  render();
  return true;
}
function renderSchoolCalendar() {
  const calendar = state.config.calendario;
  $('#course-start').value = calendar.inicio;
  $('#course-end').value = calendar.fin;
  $('#course-dates-summary').textContent = calendar.inicio
    ? 'Del ' + formatCalendarDate(calendar.inicio) + ' al ' + formatCalendarDate(calendar.fin) + ', ambos incluidos.'
    : 'Sin fechas de curso: se utiliza tu horario semanal.';
  $('#calendar-periods-list').innerHTML = calendar.noLectivos.length
    ? calendar.noLectivos.map(period => `<li class="calendar-period">
        <div><strong>${esc(period.nombre || (period.inicio === period.fin ? 'Día sin clase' : 'Periodo sin clase'))}</strong>
        <span>${esc(formatCalendarDate(period.inicio))}${period.fin !== period.inicio ? ' – ' + esc(formatCalendarDate(period.fin)) : ''}</span></div>
        <div class="calendar-period-actions">
          <button class="btn btn-ghost btn-sm" type="button" data-editperiod="${esc(period.id)}" aria-label="Editar ${esc(period.nombre || 'periodo sin clase')}">${uiIcon('edit')}<span>Editar</span></button>
          <button class="btn btn-danger btn-sm" type="button" data-deleteperiod="${esc(period.id)}" aria-label="Eliminar ${esc(period.nombre || 'periodo sin clase')}">${uiIcon('trash')}</button>
        </div></li>`).join('')
    : '<li class="calendar-empty">Aún no has añadido días sin clase.</li>';
}
function saveCourseDates(event) {
  if (event) event.preventDefault();
  const start = $('#course-start'), end = $('#course-end');
  clearFormErrors($('#course-dates-form'));
  $('#course-dates-feedback').textContent = '';
  let field = null, message = '';
  if (start.validity && start.validity.badInput || start.value && !validCalendarDate(start.value)) {
    field = start; message = 'Indica una fecha de inicio válida.';
  } else if (end.validity && end.validity.badInput || end.value && !validCalendarDate(end.value)) {
    field = end; message = 'Indica una fecha de fin válida.';
  } else if (!!start.value !== !!end.value) {
    field = start.value ? end : start; message = 'Completa ambas fechas o deja las dos vacías.';
  } else if (start.value > end.value) {
    field = end; message = 'El fin del curso debe ser igual o posterior al inicio.';
  }
  if (field) { setFieldError(field, message); field.focus(); return false; }
  if (!persistCalendar(Object.assign({}, state.config.calendario, { inicio: start.value, fin: end.value }), '#course-dates-feedback')) return false;
  toast('Fechas del curso guardadas');
  return true;
}
function openCalendarPeriod(id = null) {
  const period = id ? state.config.calendario.noLectivos.find(item => item.id === id) : null;
  if (id && !period) return;
  editingCalendarPeriod = period ? period.id : null;
  calendarPeriodSnapshot = period ? JSON.stringify(period) : '';
  clearFormErrors($('#dialog-calendar-period'));
  $('#period-feedback').textContent = '';
  $('#calendar-period-title').textContent = period ? 'Editar días sin clase' : 'Añadir días sin clase';
  $('#period-name').value = period ? period.nombre : '';
  $('#period-start').value = period ? period.inicio : '';
  $('#period-end').value = period && period.fin !== period.inicio ? period.fin : '';
  $('#dialog-calendar-period').querySelector('.dialog-content').scrollTop = 0;
  $('#dialog-calendar-period').showModal();
  $('#period-start').focus();
}
function saveCalendarPeriod() {
  clearFormErrors($('#dialog-calendar-period'));
  $('#period-feedback').textContent = '';
  const start = $('#period-start'), end = $('#period-end');
  let field = null, message = '';
  if (!validCalendarDate(start.value) || start.validity && start.validity.badInput) {
    field = start; message = 'Indica una fecha de inicio válida.';
  } else if (end.validity && end.validity.badInput || end.value && !validCalendarDate(end.value)) {
    field = end; message = 'Indica una fecha de fin válida o déjala vacía para un solo día.';
  } else if (end.value && end.value < start.value) {
    field = end; message = 'La fecha final debe ser igual o posterior al inicio.';
  }
  if (field) { setFieldError(field, message); field.focus(); return false; }
  const calendar = state.config.calendario;
  const current = calendar.noLectivos.find(item => item.id === editingCalendarPeriod);
  if (editingCalendarPeriod && JSON.stringify(current) !== calendarPeriodSnapshot) {
    $('#period-feedback').textContent = 'Este periodo ha cambiado. Ciérralo y vuelve a abrirlo antes de guardar.';
    return false;
  }
  const period = { id: editingCalendarPeriod || uid(), nombre: $('#period-name').value.trim(),
    inicio: start.value, fin: end.value || start.value };
  const periods = calendar.noLectivos.filter(item => item.id !== editingCalendarPeriod).concat(period);
  if (!persistCalendar(Object.assign({}, calendar, { noLectivos: periods }), '#period-feedback')) return false;
  $('#dialog-calendar-period').close();
  toast('Días sin clase guardados');
  return true;
}
function deleteCalendarPeriod(id) {
  const calendar = state.config.calendario;
  const period = calendar.noLectivos.find(item => item.id === id);
  if (!period || !confirm('¿Eliminar «' + (period.nombre || 'Periodo sin clase') + '» del calendario?')) return false;
  if (!persistCalendar(Object.assign({}, calendar, { noLectivos: calendar.noLectivos.filter(item => item.id !== id) }))) return false;
  toast('Periodo eliminado del calendario');
  return true;
}
function bindSchoolCalendar() {
  $('#dialog-calendar-period').addEventListener('close', () => {
    if (document.querySelector('dialog[open]') || !$('#view-config').classList.contains('active')) return;
    const origin = editingCalendarPeriod ? Array.from($('#calendar-periods-list').querySelectorAll('[data-editperiod]')).find(button =>
      button.dataset.editperiod === editingCalendarPeriod) : null;
    (origin || $('#btn-add-calendar-period')).focus({ preventScroll: true });
  });
  $('#course-dates-form').addEventListener('submit', saveCourseDates);
  $('#btn-add-calendar-period').addEventListener('click', () => openCalendarPeriod());
  $('#calendar-periods-list').addEventListener('click', event => {
    const edit = event.target.closest('[data-editperiod]');
    const remove = event.target.closest('[data-deleteperiod]');
    if (edit) openCalendarPeriod(edit.dataset.editperiod);
    if (remove) deleteCalendarPeriod(remove.dataset.deleteperiod);
  });
  $('#period-save').addEventListener('click', saveCalendarPeriod);
  ['#period-close', '#period-cancel'].forEach(selector =>
    $(selector).addEventListener('click', () => $('#dialog-calendar-period').close()));
}
