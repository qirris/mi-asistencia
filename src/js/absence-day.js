/* Faltas por día: clases completas, coincidencias y selección provisional. */
let dayAbsencePlan = null, dayAbsenceSaving = false, dayAbsenceReturnFocus = true;
const dayAbsenceSelected = new Set(), dayAbsenceApproved = new Set();

function normalizeAbsenceSession(value, hours) {
  if (!value || !horaValida(value.inicio) || !horaValida(value.fin)) return null;
  const minutes = toMin(value.fin) - toMin(value.inicio);
  return minutes > 0 && Number.isFinite(Number(hours)) && Math.abs(Number(hours) * 60 - minutes) < 0.000001
    ? { inicio: value.inicio, fin: value.fin } : null;
}
function formatAbsenceDuration(hours) {
  if (!Number.isFinite(Number(hours)) || Number(hours) < 0) return '—';
  const minutes = Math.round(Number(hours) * 60 * 1000000) / 1000000;
  const whole = Math.floor(minutes / 60), rest = Math.round((minutes - whole * 60) * 1000000) / 1000000;
  const number = value => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value);
  return (whole ? number(whole) + ' h' : '') + (whole && rest ? ' ' : '') +
    (rest || !whole ? number(rest) + ' min' : '');
}
function absenceSessionText(record) {
  return record.sesion ? record.sesion.inicio + '–' + record.sesion.fin : '';
}
function absenceIntervalsOverlap(a, b) {
  return toMin(a.inicio) < toMin(b.fin) && toMin(b.inicio) < toMin(a.fin);
}
function getAbsenceDayPlan(date) {
  const plan = { date, rows: [], warnings: [], error: '', message: '', destination: 'horario' };
  if (!validCalendarDate(date)) plan.error = 'Selecciona una fecha válida.';
  else if (date > todayISO()) plan.error = 'Elige hoy o una fecha pasada.';
  if (plan.error) { plan.signature = JSON.stringify(plan); return plan; }
  const status = getSchoolDayStatus(date);
  if (!status.lectivo) {
    plan.destination = 'calendario';
    if (status.motivo === 'antes') plan.message = 'La fecha es anterior al inicio del curso: ' + formatCalendarDate(status.fecha) + '.';
    else if (status.motivo === 'despues') plan.message = 'El curso terminó el ' + formatCalendarDate(status.fecha) + '.';
    else if (status.motivo === 'noLectivo') plan.message = 'Día sin clase en tu calendario' + (status.nombre !== 'Día sin clase' ? ': ' + status.nombre : '') + '.';
    else { plan.message = 'No tienes clases configuradas para este día de la semana.'; plan.destination = 'horario'; }
    plan.signature = JSON.stringify(plan);
    return plan;
  }
  const h = state.horario, day = DIAS[(calendarDate(date).getDay() + 6) % 7].key;
  const existing = state.faltas.filter(record => record.fecha === date);
  let missing = 0, archived = 0, orphan = 0, repeated = 0;
  const keys = new Set();
  h.franjas.filter(slot => slot.tipo === 'clase' && franjaActivaEnDia(h, slot, day))
    .sort((a, b) => toMin(a.inicio) - toMin(b.inicio) || toMin(a.fin) - toMin(b.fin)).forEach(slot => {
      const cell = getCasilla(h, day, slot.id);
      if (cell && cell.recreo) return;
      if (!cell || !cell.asignaturaId) { missing++; return; }
      const subject = asignaturaPorId(cell.asignaturaId);
      if (!subject) { orphan++; return; }
      if (subject.archivada) { archived++; return; }
      const session = { inicio: slot.inicio, fin: slot.fin };
      const minutes = minutosFranja(slot);
      if (minutes <= 0) return;
      const key = JSON.stringify([date, subject.id, session.inicio, session.fin]);
      if (keys.has(key)) { repeated++; return; }
      keys.add(key);
      const exact = record => record.asignaturaId === subject.id && record.sesion &&
        record.sesion.inicio === session.inicio && record.sesion.fin === session.fin;
      const registered = existing.filter(exact);
      const conflicts = existing.filter(record => !exact(record) &&
        (record.sesion ? absenceIntervalsOverlap(record.sesion, session) : record.asignaturaId === subject.id));
      plan.rows.push({ key, asignaturaId: subject.id, nombre: subject.nombre, session, minutes,
        registered, conflicts: conflicts.map(record => Object.assign({}, record, {
          asignaturaNombre: (asignaturaPorId(record.asignaturaId) || {}).nombre || 'Asignatura eliminada'
        })) });
    });
  if (missing) plan.warnings.push(missing + (missing === 1 ? ' franja sin asignatura no se incluye.' : ' franjas sin asignatura no se incluyen.'));
  if (archived) plan.warnings.push(archived + (archived === 1 ? ' clase con asignatura archivada no se incluye.' : ' clases con asignatura archivada no se incluyen.'));
  if (orphan) plan.warnings.push(orphan + (orphan === 1 ? ' clase con asignatura eliminada no se incluye.' : ' clases con asignatura eliminada no se incluyen.'));
  if (repeated) plan.warnings.push('Hay franjas repetidas en el horario. Cada sesión se muestra una sola vez.');
  if (!plan.rows.length) plan.message = 'No hay clases disponibles. Completa el horario o registra la falta manualmente.';
  plan.signature = JSON.stringify(plan);
  return plan;
}
function validateAbsenceDaySelection(plan, selected, approved, type) {
  if (plan.error) return { ok: false, reason: plan.error };
  if (!['no_justificada', 'justificada'].includes(type)) return { ok: false, reason: 'Selecciona un tipo de falta válido.' };
  const keys = new Set(selected), acknowledgments = new Set(approved);
  const rows = plan.rows.filter(row => keys.has(row.key));
  if (!rows.length || rows.length !== keys.size) return { ok: false, reason: 'Selecciona al menos una clase disponible.' };
  if (rows.some(row => row.registered.length)) return { ok: false, reason: 'Una clase seleccionada ya tiene una falta registrada.' };
  if (rows.some(row => row.conflicts.length && !acknowledgments.has(row.key))) {
    return { ok: false, reason: 'Revisa las coincidencias y confirma cada clase que quieras añadir.' };
  }
  for (let i = 1; i < rows.length; i++) {
    if (rows.slice(0, i).some(row => absenceIntervalsOverlap(row.session, rows[i].session))) {
      return { ok: false, reason: 'Las clases seleccionadas se solapan. Revisa el horario o selecciona solo una de ellas.' };
    }
  }
  return { ok: true, rows, minutes: rows.reduce((sum, row) => sum + row.minutes, 0) };
}
function buildAbsenceDayBatch(plan, selected, approved, type, reason) {
  const selection = validateAbsenceDaySelection(plan, selected, approved, type);
  if (!selection.ok) return selection;
  return { ok: true, records: selection.rows.map(row => ({
    id: uid(), asignaturaId: row.asignaturaId, fecha: plan.date, horas: row.minutes / 60,
    tipo: type, motivo: String(reason || '').trim(), sesion: Object.assign({}, row.session)
  })), minutes: selection.minutes };
}
function refreshAbsenceDaySelection() {
  if (!dayAbsencePlan) return;
  const rows = dayAbsencePlan.rows.filter(row => dayAbsenceSelected.has(row.key));
  const minutes = rows.reduce((sum, row) => sum + row.minutes, 0);
  const result = validateAbsenceDaySelection(dayAbsencePlan, dayAbsenceSelected, dayAbsenceApproved, $('#day-absence-type').value);
  const pending = rows.filter(row => row.conflicts.length && !dayAbsenceApproved.has(row.key)).length;
  $('#day-absence-summary').textContent = rows.length + (rows.length === 1 ? ' clase' : ' clases') + ' · ' + formatAbsenceDuration(minutes / 60) +
    (pending ? ' · ' + pending + (pending === 1 ? ' revisión pendiente' : ' revisiones pendientes') : rows.length && !result.ok ? ' · Revisar selección' : '');
  $('#btn-day-absence-save').disabled = dayAbsenceSaving || !result.ok;
  $('#btn-day-absence-save').textContent = 'Registrar ' + rows.length + (rows.length === 1 ? ' falta' : ' faltas');
  const eligible = dayAbsencePlan.rows.filter(row => !row.registered.length);
  $('#btn-day-absence-all').disabled = !eligible.length;
  $('#btn-day-absence-all').textContent = eligible.length && rows.length === eligible.length ? 'Quitar selección' : 'Seleccionar todas';
  $('#day-absence-selection-help').textContent = rows.length && !result.ok ? result.reason : '';
  $('#day-absence-list').querySelectorAll('[data-day-pick]').forEach(input => { input.checked = dayAbsenceSelected.has(input.dataset.dayPick); });
  $('#day-absence-list').querySelectorAll('[data-day-conflict]').forEach(element => { element.hidden = !dayAbsenceSelected.has(element.dataset.dayConflict); });
  $('#day-absence-list').querySelectorAll('[data-day-ack]').forEach(input => { input.checked = dayAbsenceApproved.has(input.dataset.dayAck); });
}
function renderAbsenceDayPlan() {
  dayAbsenceSelected.clear(); dayAbsenceApproved.clear();
  dayAbsencePlan = getAbsenceDayPlan($('#day-absence-date').value);
  $('#day-absence-date').max = todayISO();
  $('#day-absence-feedback').textContent = dayAbsencePlan.error;
  $('#day-absence-status').textContent = dayAbsencePlan.message || (dayAbsencePlan.error ? '' :
    'Clases del ' + calendarDate(dayAbsencePlan.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
  $('#day-absence-warnings').innerHTML = dayAbsencePlan.warnings.map(warning => '<p>' + esc(warning) + '</p>').join('');
  $('#day-absence-common').hidden = !dayAbsencePlan.rows.length;
  $('#day-absence-links').innerHTML = dayAbsencePlan.error ? '' :
    `<button class="text-action" type="button" data-day-go="${dayAbsencePlan.destination}">${dayAbsencePlan.destination === 'calendario' ? 'Revisar calendario' : 'Revisar horario'}</button>
     <button class="text-action" type="button" data-day-go="manual">Registrar manualmente</button>`;
  $('#day-absence-list').innerHTML = dayAbsencePlan.rows.map(row => `<li class="day-absence-item">
    ${row.registered.length ? `<div class="day-absence-choice is-registered"><span class="checkbox-target" aria-hidden="true">${uiIcon('check')}</span>` :
      `<label class="day-absence-choice"><span class="checkbox-target"><input type="checkbox" data-day-pick="${esc(row.key)}"></span>`}
      <span class="day-absence-class"><strong>${esc(row.nombre)}</strong><span>${row.session.inicio}–${row.session.fin} · ${formatAbsenceDuration(row.minutes / 60)}</span></span>
      ${row.registered.length ? '<span class="badge gray">Ya registrada</span></div>' : '</label>'}
    ${row.conflicts.length && !row.registered.length ? `<div class="day-absence-conflict" data-day-conflict="${esc(row.key)}" hidden>
      <p>Ya hay faltas que podrían incluir esta clase:</p>
      <ul>${row.conflicts.map(record => `<li><strong>${esc(record.asignaturaNombre)}</strong> · ${formatAbsenceDuration(record.horas)}${record.sesion ? ' · ' + absenceSessionText(record) : ' · Sin franja indicada'} · ${record.tipo === 'justificada' ? 'Justificada' : 'No justificada'}${record.motivo ? ' · ' + esc(record.motivo) : ''}</li>`).join('')}</ul>
      <label class="day-absence-approval"><span class="checkbox-target"><input type="checkbox" data-day-ack="${esc(row.key)}" aria-label="Confirmo que ${esc(row.nombre)} ${row.session.inicio}–${row.session.fin} no está incluida en las faltas indicadas."></span>
        <span>Confirmo que esta clase no está incluida en las faltas indicadas.</span></label>
    </div>` : ''}
  </li>`).join('');
  refreshAbsenceDaySelection();
}
function openAbsenceDayDialog() {
  dayAbsenceReturnFocus = true; dayAbsenceSaving = false;
  $('#day-absence-date').value = todayISO();
  $('#day-absence-type').value = 'no_justificada';
  $('#day-absence-reason').value = '';
  renderAbsenceDayPlan();
  $('#dialog-day-absence').querySelector('.dialog-content').scrollTop = 0;
  $('#dialog-day-absence').showModal();
  $('#day-absence-date').focus();
}
function saveAbsenceDay() {
  if (dayAbsenceSaving || !dayAbsencePlan) return false;
  $('#day-absence-feedback').textContent = '';
  const current = getAbsenceDayPlan($('#day-absence-date').value);
  if (current.signature !== dayAbsencePlan.signature) {
    renderAbsenceDayPlan();
    $('#day-absence-feedback').textContent = 'Las clases o las faltas han cambiado. Revisa la selección antes de guardar.';
    return false;
  }
  try {
    if (!isStoredStateCurrent()) {
      $('#day-absence-feedback').textContent = 'Los datos han cambiado en otra pestaña. Recarga antes de registrar las faltas.';
      return false;
    }
  } catch (error) { $('#day-absence-feedback').textContent = 'No se puede acceder al almacenamiento. No se ha registrado ninguna falta.'; return false; }
  const result = buildAbsenceDayBatch(current, dayAbsenceSelected, dayAbsenceApproved, $('#day-absence-type').value, $('#day-absence-reason').value);
  if (!result.ok) { $('#day-absence-feedback').textContent = result.reason; return false; }
  dayAbsenceSaving = true;
  refreshAbsenceDaySelection();
  let saved = false;
  try { saved = UndoManager.addAbsences(result.records, $('#dialog-day-absence')); }
  finally { dayAbsenceSaving = false; }
  if (!saved) {
    $('#day-absence-feedback').textContent = 'No se ha podido guardar el lote. No se ha registrado ninguna falta.';
    refreshAbsenceDaySelection();
    return false;
  }
  return true;
}
function bindAbsenceDay() {
  $('#btn-add-day-absences').addEventListener('click', openAbsenceDayDialog);
  $('#day-absence-date').addEventListener('change', renderAbsenceDayPlan);
  $('#btn-day-absence-yesterday').addEventListener('click', () => {
    $('#day-absence-date').value = calendarAddDays(todayISO(), -1);
    renderAbsenceDayPlan();
  });
  $('#btn-day-absence-all').addEventListener('click', () => {
    const eligible = dayAbsencePlan.rows.filter(row => !row.registered.length);
    const allSelected = eligible.every(row => dayAbsenceSelected.has(row.key));
    if (allSelected) { dayAbsenceSelected.clear(); dayAbsenceApproved.clear(); }
    else eligible.forEach(row => dayAbsenceSelected.add(row.key));
    refreshAbsenceDaySelection();
  });
  $('#day-absence-list').addEventListener('change', event => {
    const pick = event.target.closest('[data-day-pick]');
    const ack = event.target.closest('[data-day-ack]');
    if (pick) {
      if (pick.checked) dayAbsenceSelected.add(pick.dataset.dayPick);
      else { dayAbsenceSelected.delete(pick.dataset.dayPick); dayAbsenceApproved.delete(pick.dataset.dayPick); }
    }
    if (ack && dayAbsenceSelected.has(ack.dataset.dayAck)) {
      if (ack.checked) dayAbsenceApproved.add(ack.dataset.dayAck); else dayAbsenceApproved.delete(ack.dataset.dayAck);
    }
    refreshAbsenceDaySelection();
  });
  $('#day-absence-type').addEventListener('change', refreshAbsenceDaySelection);
  $('#btn-day-absence-save').addEventListener('click', saveAbsenceDay);
  ['#btn-day-absence-close', '#btn-day-absence-cancel'].forEach(selector =>
    $(selector).addEventListener('click', () => $('#dialog-day-absence').close()));
  $('#dialog-day-absence').addEventListener('close', () => {
    if (dayAbsenceReturnFocus && $('#view-faltas').classList.contains('active') && !document.querySelector('dialog[open]')) {
      $('#btn-add-day-absences').focus({ preventScroll: true });
    }
  });
  $('#day-absence-links').addEventListener('click', event => {
    const button = event.target.closest('[data-day-go]');
    if (!button) return;
    dayAbsenceReturnFocus = false;
    const date = $('#day-absence-date').value, destination = button.dataset.dayGo;
    $('#dialog-day-absence').close();
    showView(destination === 'manual' ? 'faltas' : destination === 'calendario' ? 'config' : 'horario');
    if (destination === 'manual') {
      if (validCalendarDate(date) && date <= todayISO()) $('#falta-fecha').value = date;
      $('#falta-asig').focus();
    } else if (destination === 'calendario') {
      $('#school-calendar-card').scrollIntoView({ block: 'start' });
      $('#school-calendar-title').focus({ preventScroll: true });
    }
  });
}
