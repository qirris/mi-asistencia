/* Pruebas del calendario manual y de la edición de clases. */
(function schoolCalendarTest() {
  const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
  const clone = value => JSON.parse(JSON.stringify(value));
  const source = ['attendance', 'calendar', 'storage', 'schedule', 'tasks', 'history', 'recovery', 'app']
    .map(name => fs.readFileSync('src/js/' + name + '.js', 'utf8')).join('\n') +
    '\nthis.getState=()=>state; this.setState=s=>{state=s;};';
  const days = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  const sample = {
    etapa: 'fp_superior', asignaturas: [
      { id: 'a1', nombre: 'Redes', horasTotales: 120 }, { id: 'a2', nombre: 'Bases', horasTotales: 100 },
      { id: 'arch', nombre: 'Archivada', horasTotales: 50, archivada: true }
    ], faltas: [{ id: 'f1', asignaturaId: 'a1', fecha: '2026-11-10', horas: 2, tipo: 'justificada', motivo: 'Consulta' }],
    tareas: [{ id: 't1', asignaturaId: 'a1', asignaturaNombre: 'Redes', titulo: 'Examen con todos sus detalles', tipo: 'examen',
      prioridad: 'alta', estado: 'completada', descripcion: 'Temas 1 y 2', fechaEntrega: '2026-11-20',
      slotKey: 'lunes|h1', dia: 'lunes', horaInicio: '08:00', horaFin: '09:00' },
      { id: 't2', asignaturaId: 'a2', titulo: 'Actividad de otra clase', slotKey: 'martes|h1', dia: 'martes', horaInicio: '08:00', horaFin: '09:00' }],
    config: { onboarding: { etapaConfirmada: true, oculto: true }, criterio: { tipo: 'horas', valor: 20 } },
    horario: { entrada: '08:00', salida: '09:00', dias: days, diasSalida: {},
      franjas: [{ id: 'h1', inicio: '08:00', fin: '09:00', tipo: 'clase' }],
      casillas: Object.fromEntries(days.map(day => [day + '|h1', { asignaturaId: day === 'martes' ? 'a2' : 'a1' }])) }
  };
  function harness(input = sample) {
    let instant = new Date(2026, 10, 12, 8, 30).getTime(), failKey = '';
    class ClockDate extends Date {
      constructor(...args) { super(...(args.length ? args : [instant])); }
      static now() { return instant; }
    }
    const nodes = new Map(), store = {}, events = {}, winEvents = {};
    let document;
    function node(selector) {
      if (nodes.has(selector)) return nodes.get(selector);
      const classes = new Set(), attributes = {}, listeners = {};
      const element = { id: selector.startsWith('#') ? selector.slice(1) : selector, value: '', innerHTML: '', textContent: '',
        checked: false, disabled: false, open: false, hidden: false, style: {}, dataset: {}, scrollTop: 0,
        classList: { add(c) { classes.add(c); }, remove(c) { classes.delete(c); }, contains(c) { return classes.has(c); }, toggle(c, value) { if (value) classes.add(c); else classes.delete(c); } },
        addEventListener(name, callback) { (listeners[name] ||= []).push(callback); },
        fire(name, event = {}) { (listeners[name] || []).forEach(callback => callback(event)); },
        querySelector: child => node(selector + ' ' + child), querySelectorAll: () => [], closest: () => null,
        setAttribute: (name, value) => { attributes[name] = String(value); },
        getAttribute: name => attributes[name] ?? null, removeAttribute: name => { delete attributes[name]; },
        showModal() { this.open = true; }, close() { this.open = false; }, focus() { document.activeElement = this; },
        appendChild() {}, scrollIntoView() {} };
      nodes.set(selector, element); return element;
    }
    document = { hidden: false, activeElement: null, body: node('body'), head: node('head'),
      querySelector: node, querySelectorAll: () => [], createElement: () => node('new-' + nodes.size),
      addEventListener(name, callback) { (events[name] ||= []).push(callback); } };
    const sandbox = { console, document, Date: ClockDate, navigator: { userAgent: 'test' },
      window: { addEventListener(name, callback) { (winEvents[name] ||= []).push(callback); }, matchMedia: () => ({ matches: false }), scrollTo() {} },
      localStorage: { getItem: key => store[key] ?? null, removeItem: key => { delete store[key]; },
        setItem(key, value) { if (key === failKey) throw Error('sin espacio'); store[key] = String(value); } },
      setTimeout: () => 1, clearTimeout() {}, confirm: () => true, alert() {} };
    vm.createContext(sandbox); vm.runInContext(source, sandbox);
    sandbox.render = () => {};
    sandbox.clearFormErrors = () => {};
    sandbox.setFieldError = (element, message) => { element.error = message; };
    sandbox.setState(sandbox.normalizeState(clone(input))); sandbox.saveState();
    return { s: sandbox, state: () => sandbox.getState(), store, node, document, events,
      fail(key) { failKey = key; }, now(value) { instant = new Date(value).getTime(); } };
  }
  let h = harness(), s = h.s;
  assert.deepEqual(clone(h.state().config.calendario), { inicio: '', fin: '', noLectivos: [] });
  assert.equal(h.state().version, 2);
  h.store.miAsistenciaState = JSON.stringify(sample); s.loadState();
  assert.equal(s.persistCalendar({ inicio: '2026-09-01', fin: '2027-06-30', noLectivos: [] }), true, 'primer guardado tras cargar el formato anterior');
  assert.equal(s.saveScheduleCell('lunes|h1', { asignaturaId: 'a2' }).ok, true);
  h = harness(); s = h.s;
  for (const value of ['2024-02-29', '2000-02-29', '0099-01-01', '9999-12-31']) assert.equal(s.validCalendarDate(value), true, value);
  for (const value of ['2025-02-29', '2100-02-29', '0000-01-01', '2026-04-31', '2026-13-01', '2026-1-01', 'garbage']) assert.equal(s.validCalendarDate(value), false, value);
  assert.equal(s.calendarISO(s.calendarDate('0099-01-02')), '0099-01-02');
  assert.equal(s.calendarAddDays('2024-02-28', 1), '2024-02-29');
  assert.equal(s.calendarAddDays('2024-02-29', 1), '2024-03-01');
  assert.equal(s.calendarAddDays('9999-12-31', 1), '');
  for (const day of ['2027-03-28', '2027-10-31']) {
    const next = s.calendarAddDays(day, 1);
    assert.equal(s.calendarDayNumber(next) - s.calendarDayNumber(day), 1, 'día civil durante el cambio de hora');
    assert.equal(s.calendarISO(s.calendarDate(day)), day);
  }
  if (process.env.TZ === 'Europe/Madrid') {
    assert.equal((s.calendarDate('2027-03-28') - s.calendarDate('2027-03-27')) / 3600000, 23);
    assert.equal((s.calendarDate('2027-10-31') - s.calendarDate('2027-10-30')) / 3600000, 25);
  }
  const dirty = s.normalizeCalendar({ inicio: '2027-06-30', fin: '2026-09-01', noLectivos: [
    { id: 'same', inicio: '2026-12-24', nombre: '<script>vacaciones</script>' },
    { id: 'same', inicio: '2026-12-25', fin: '2027-01-10' },
    { inicio: '2025-02-29' }, { inicio: '2026-12-24', fin: '2026-12-20' }, { inicio: '2026-12-24', fin: 0 }, null
  ] });
  assert.equal(dirty.inicio, ''); assert.equal(dirty.fin, ''); assert.equal(dirty.noLectivos.length, 2);
  assert.equal(new Set(dirty.noLectivos.map(p => p.id)).size, 2);
  assert.equal(dirty.noLectivos[0].fin, '2026-12-24');
  // Límites incluidos y saltos largos, con solapamientos.
  const periods = [
    { id: 'p1', nombre: 'Vacaciones', inicio: '2026-11-12', fin: '2026-11-30' },
    { id: 'p2', nombre: 'Extensión', inicio: '2026-11-28', fin: '2026-12-15' }
  ];
  assert.equal(s.persistCalendar({ inicio: '2026-09-01', fin: '2027-06-30', noLectivos: periods }), true);
  assert.equal(s.getSchoolDayStatus('2026-11-12').hasta, '2026-12-15');
  let next = s.findNextClass(new Date(2026, 10, 12, 8, 30));
  assert.equal(s.calendarISO(next.date), '2026-12-16'); assert.equal(next.offset, 34); assert.equal(next.current, false);
  assert.equal(s.getSchoolDayStatus('2026-09-01').lectivo, true);
  assert.equal(s.getSchoolDayStatus('2027-06-30').lectivo, true);
  assert.equal(s.getSchoolDayStatus('2026-08-31').motivo, 'antes');
  assert.equal(s.getSchoolDayStatus('2027-07-01').motivo, 'despues');
  assert.equal(s.findNextClass(new Date(2027, 6, 1, 8, 0)), null);
  next = s.findNextClass(new Date(2026, 7, 1, 8, 0)); assert.equal(s.calendarISO(next.date), '2026-09-01');
  s.persistCalendar({ inicio: '2026-11-12', fin: '2026-11-12', noLectivos: [] });
  assert.equal(s.findNextClass(new Date(2026, 10, 12, 8, 30)).current, true);
  assert.equal(s.findNextClass(new Date(2026, 10, 12, 9, 0)), null);
  s.persistCalendar({ inicio: '2026-11-12', fin: '2026-11-20', noLectivos: periods });
  assert.equal(s.findNextClass(new Date(2026, 10, 12, 8, 0)), null, 'todo lo que queda del curso es no lectivo');
  s.persistCalendar({ inicio: '', fin: '', noLectivos: [{ inicio: '2026-11-12', fin: '9999-12-31' }] });
  assert.equal(s.findNextClass(new Date(2026, 10, 12, 8, 0)), null, 'salto al límite de fechas sin bucles');
  h = harness(); s = h.s;
  assert.equal(s.getSchoolDayStatus('2026-11-15').lectivo, true, 'se respetan domingos configurados');
  h.state().horario.dias = ['lunes']; s.saveState();
  assert.equal(s.getSchoolDayStatus('2026-11-15').motivo, 'semana');
  assert.equal(s.findNextClass(new Date(2026, 10, 15, 8, 0)).day.key, 'lunes');
  h.state().asignaturas.forEach(a => { a.archivada = true; });
  assert.equal(s.findNextClass(new Date(2026, 10, 15, 8, 0)), null);
  // Formularios, guardado, edición y eliminación confirmada, sin alterar datos académicos.
  h = harness(); s = h.s;
  const academic = clone(h.state()), attendanceBefore = clone(s.calcAsignatura(h.state().asignaturas[0]));
  h.node('#course-start').value = '2026-09-01'; h.node('#course-end').value = '';
  assert.equal(s.saveCourseDates(), false); assert.match(h.node('#course-end').error, /ambas fechas/);
  h.node('#course-end').value = '2026-08-01';
  assert.equal(s.saveCourseDates(), false); assert.match(h.node('#course-end').error, /posterior/);
  h.node('#course-end').value = '2027-06-30'; assert.equal(s.saveCourseDates(), true);
  s.openCalendarPeriod(); h.node('#period-start').value = '2026-12-24'; h.node('#period-name').value = ' Navidad ';
  assert.equal(s.saveCalendarPeriod(), true);
  let period = h.state().config.calendario.noLectivos[0]; assert.equal(period.nombre, 'Navidad'); assert.equal(period.fin, period.inicio);
  s.openCalendarPeriod(period.id); h.node('#period-end').value = '2027-01-10'; assert.equal(s.saveCalendarPeriod(), true);
  assert.equal(h.state().config.calendario.noLectivos.length, 1);
  assert.equal(h.state().config.calendario.noLectivos[0].fin, '2027-01-10');
  s.confirm = () => false; assert.equal(s.deleteCalendarPeriod(period.id), false);
  assert.equal(h.state().config.calendario.noLectivos.length, 1);
  s.confirm = () => true; assert.equal(s.deleteCalendarPeriod(period.id), true);
  for (const key of ['asignaturas', 'faltas', 'tareas', 'horario']) assert.deepEqual(clone(h.state()[key]), academic[key]);
  assert.deepEqual(clone(h.state().config.onboarding), academic.config.onboarding);
  assert.deepEqual(clone(s.calcAsignatura(h.state().asignaturas[0])), attendanceBefore);
  const reloaded = s.normalizeState(JSON.parse(h.store.miAsistenciaState)); assert.equal(reloaded.config.calendario.fin, '2027-06-30');
  s.openCalendarPeriod(); h.node('#period-start').value = '2027-01-10'; h.node('#period-end').value = '2026-12-24';
  assert.equal(s.saveCalendarPeriod(), false); assert.match(h.node('#period-end').error, /posterior/);
  h.node('#period-end').value = ''; h.fail('miAsistenciaState');
  const beforeFailure = clone(h.state()); assert.equal(s.saveCalendarPeriod(), false);
  assert.deepEqual(clone(h.state()), beforeFailure); assert.match(h.node('#period-feedback').textContent, /no se ha podido/i);
  h.fail(''); h.store.miAsistenciaState = JSON.stringify({ other: true });
  assert.equal(s.saveCalendarPeriod(), false); assert.deepEqual(clone(h.state()), beforeFailure);
  // Inicio comparte el calendario y conserva borradores al refrescar fechas.
  h = harness(); s = h.s;
  s.persistCalendar({ inicio: '2026-09-01', fin: '2027-06-30', noLectivos: periods });
  h.node('#dlg-task-titulo').value = 'Borrador de tarea'; h.node('#course-start').value = '2028-09-01';
  s.refreshDashboardTime();
  assert.match(h.node('#dash-classes-today').innerHTML, /Hoy no hay clases: Vacaciones/);
  assert.match(h.node('#dash-priorities').innerHTML, /16 dic/);
  h.now(new Date(2026, 11, 16, 8, 30)); s.refreshDashboardTime();
  assert.match(h.node('#dash-classes-today').innerHTML, /En curso/);
  assert.equal(h.node('#dlg-task-titulo').value, 'Borrador de tarea'); assert.equal(h.node('#course-start').value, '2028-09-01');
  h.now(new Date(2027, 6, 1)); s.refreshDashboardTime();
  assert.match(h.node('#dash-priorities').innerHTML, /Curso finalizado/);
  assert.match(h.node('#dash-classes-today').innerHTML, /curso ha finalizado/);
  // Edición: selección provisional, cancelar y reabrir, luego guardar con desvinculación precisa.
  h = harness(); s = h.s; s.bindSchedule();
  s.openCellDialog('lunes|h1', true);
  const beforeEdit = clone(h.state()), persisted = h.store.miAsistenciaState;
  s.aplicarAsignatura('a2');
  assert.deepEqual(clone(h.state()), beforeEdit); assert.equal(h.store.miAsistenciaState, persisted);
  assert.match(h.node('#cell-choice-summary').textContent, /1 actividad seguirá/);
  h.node('#dlg-cell-cancel').fire('click'); assert.equal(h.node('#dialog-cell').open, false);
  s.openCellDialog('lunes|h1', true); assert.equal(h.node('#dlg-cell-save').disabled, true);
  s.aplicarAsignatura('a2'); assert.equal(s.guardarCasilla(), true);
  assert.equal(h.state().horario.casillas['lunes|h1'].asignaturaId, 'a2');
  const detached = clone(beforeEdit.tareas[0]); Object.assign(detached, { slotKey: '', dia: '', horaInicio: '', horaFin: '' });
  assert.deepEqual(clone(h.state().tareas[0]), detached);
  assert.deepEqual(clone(h.state().tareas[1]), beforeEdit.tareas[1]);
  assert.deepEqual(clone(h.state().faltas), beforeEdit.faltas);
  assert.deepEqual(clone(h.state().config), beforeEdit.config);
  // Mismo valor conserva referencias y campos; vaciar y recreo nunca eliminan actividades.
  for (const value of [null, { recreo: true }]) {
    h = harness(); s = h.s;
    const snapshot = clone(h.state().tareas[0]);
    assert.equal(s.saveScheduleCell('lunes|h1', value).ok, true);
    assert.equal(h.state().tareas.length, 2); assert.equal(h.state().tareas[0].slotKey, '');
    assert.equal(h.state().tareas[0].titulo, snapshot.titulo);
    assert.equal(h.state().tareas[0].asignaturaId, 'a1');
  }
  h = harness(); s = h.s;
  const tasksRef = h.state().tareas;
  assert.equal(s.saveScheduleCell('lunes|h1', { asignaturaId: 'a1' }).changed, false); assert.equal(h.state().tareas, tasksRef);
  for (const id of ['arch', 'missing']) assert.equal(s.saveScheduleCell('lunes|h1', { asignaturaId: id }).ok, false);
  // Reparación de huérfanos, configuración abierta, instantánea obsoleta y almacenamiento.
  h.state().horario.casillas['lunes|h1'] = { asignaturaId: 'missing' }; s.saveState(); s.openCellDialog('lunes|h1');
  assert.equal(h.node('#dialog-cell').open, true); assert.match(h.node('#cell-current-description').textContent, /eliminada/);
  s.aplicarAsignatura('a2'); assert.equal(s.guardarCasilla(), true);
  s.toggleScheduleEdit(true);
  assert.equal(s.saveScheduleCell('lunes|h1', null).ok, false);
  s.openClassDetail('lunes', 'h1'); assert.match(h.node('#dialog-class-body').innerHTML, /btn-class-change[^>]*disabled/);
  s.toggleScheduleEdit(false);
  h = harness(); s = h.s;
  const oldSnapshot = s.cellEditorSnapshot('lunes|h1');
  h.state().horario.casillas['lunes|h1'] = { recreo: true }; s.saveState();
  assert.equal(s.saveScheduleCell('lunes|h1', { asignaturaId: 'a2' }, oldSnapshot).ok, false);
  h = harness(); s = h.s;
  const prior = clone(h.state()); h.fail('miAsistenciaState');
  assert.equal(s.saveScheduleCell('lunes|h1', { asignaturaId: 'a2' }).ok, false);
  assert.deepEqual(clone(h.state()), prior);
  h.fail(''); h.store.miAsistenciaState = JSON.stringify({ other: true });
  assert.equal(s.saveScheduleCell('lunes|h1', null).ok, false); assert.deepEqual(clone(h.state()), prior);
  console.log('OK: calendario manual, límites inclusivos, vacaciones largas, solapamientos, cambios de hora, Inicio, edición de clases y conservación de datos');
})();
