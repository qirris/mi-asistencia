/* Pruebas de recuperación y copia segura del horario. */
(function changesTest() {
  const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
  const code = ['attendance', 'calendar', 'storage', 'schedule', 'tasks', 'history', 'recovery', 'app']
    .map(name => fs.readFileSync('src/js/' + name + '.js', 'utf8')).join('\n') +
    '\nthis.getState=()=>state; this.setState=s=>{state=s;}; this.setEditing=v=>{scheduleEditing=v;};';
  const clone = value => JSON.parse(JSON.stringify(value));
  const task = (id, subject = 'a1', slot = '') => ({
    id, asignaturaId: subject, titulo: 'Tarea ' + id, tipo: 'examen', prioridad: 'alta',
    estado: 'pendiente', fechaEntrega: '2026-11-20', descripcion: 'Detalles que deben conservarse',
    slotKey: slot, dia: slot.split('|')[0] || '', horaInicio: slot ? '08:00' : '', horaFin: slot ? '09:00' : ''
  });
  const sample = {
    etapa: 'fp_superior',
    asignaturas: [{ id: 'a1', nombre: 'Redes', horasTotales: 120 }, { id: 'a2', nombre: 'Bases', horasTotales: 100 },
      { id: 'a3', nombre: 'Archivada', horasTotales: 50, archivada: true }],
    tareas: [task('t1'), task('t2'), task('t3')],
    faltas: [{ id: 'f1', asignaturaId: 'a1', fecha: '2026-11-10', horas: 1, tipo: 'justificada', motivo: 'Consulta' }],
    config: { onboarding: { etapaConfirmada: true, oculto: true } },
    horario: { entrada: '08:00', salida: '12:00', dias: ['lunes', 'martes', 'miercoles'],
      diasSalida: { miercoles: '09:00' },
      franjas: [{ id: 'h1', inicio: '08:00', fin: '09:00', tipo: 'clase' },
        { id: 'h2', inicio: '09:00', fin: '10:00', tipo: 'clase' },
        { id: 'r1', inicio: '10:00', fin: '10:30', tipo: 'recreo' },
        { id: 'h3', inicio: '10:30', fin: '11:30', tipo: 'clase' }],
      casillas: { 'lunes|h1': { asignaturaId: 'a1' }, 'lunes|h2': { asignaturaId: 'a2' } } }
  };
  function harness(persisted = {}) {
    let now = 100000, nextTimer = 1;
    class TestDate extends Date {
      constructor(...args) { super(...(args.length ? args : [now])); }
      static now() { return now; }
    }
    const store = Object.assign({}, persisted), nodes = new Map(), events = {}, winEvents = {}, timers = new Map();
    let failKey = '';
    function node(id) {
      if (nodes.has(id)) return nodes.get(id);
      const classes = new Set(), listeners = {};
      const el = { value: '', textContent: '', innerHTML: '', hidden: false, checked: false, disabled: false, open: false, dataset: {}, style: {},
        classList: { add(c) { classes.add(c); }, remove(c) { classes.delete(c); }, contains(c) { return classes.has(c); }, toggle() {} },
        addEventListener(name, cb) { (listeners[name] ||= []).push(cb); },
        fire(name, event = {}) { (listeners[name] || []).forEach(cb => cb(event)); },
        querySelector: child => node(id + ' ' + child), querySelectorAll: () => [],
        closest: () => null, contains: other => other === el, close() { this.open = false; }, showModal() { this.open = true; },
        setAttribute() {}, removeAttribute() {}, focus() {} };
      nodes.set(id, el); return el;
    }
    const document = { hidden: false, body: node('body'), head: node('head'), querySelector: node, querySelectorAll: () => [], createElement: () => node('new' + nodes.size),
      addEventListener(name, cb) { (events[name] ||= []).push(cb); } };
    const sandbox = { console, Date: TestDate, document,
      window: { addEventListener(name, cb) { (winEvents[name] ||= []).push(cb); }, matchMedia: () => ({ matches: false }), scrollTo() {} },
      navigator: { userAgent: 'test' }, confirm: () => true, alert() {},
      localStorage: { getItem: key => store[key] ?? null,
        setItem(key, value) { if (key === failKey) throw Error('sin espacio'); store[key] = String(value); }, removeItem: key => { delete store[key]; } },
      setTimeout(callback, delay) { const id = nextTimer++; timers.set(id, { callback, at: now + delay }); return id; },
      clearTimeout(id) { timers.delete(id); } };
    vm.createContext(sandbox); vm.runInContext(code, sandbox);
    sandbox.render = () => {};
    sandbox.setState(sandbox.normalizeState(clone(sample)));
    const save = () => sandbox.saveState();
    if (!store.miAsistenciaState) save();
    return { s: sandbox, state: () => sandbox.getState(), store, node, document, events, winEvents, save,
      fail(key) { failKey = key; },
      advance(ms) { now += ms; let next; while ((next = [...timers.entries()].find(([, timer]) => timer.at <= now))) { timers.delete(next[0]); next[1].callback(); } },
      fire(name, event = {}) { (events[name] || []).forEach(cb => cb(event)); } };
  }
  // Borrado agrupado, orden original y conservación de cambios posteriores.
  let h = harness(), { s } = h;
  s.UndoManager.bind();
  const original = clone(h.state());
  assert.equal(s.UndoManager.remove('tareas', 't2'), true);
  assert.equal(s.UndoManager.remove('tareas', 't1'), true);
  assert.equal(s.UndoManager.remove('faltas', 'f1'), true);
  h.state().tareas[0].titulo = 'Editada después del borrado'; h.save();
  assert.equal(h.node('#undo-message').textContent, '3 registros eliminados.');
  assert.equal(s.UndoManager.restore(), true);
  assert.deepEqual(clone(h.state().tareas.map(t => t.id)), ['t1', 't2', 't3']);
  assert.deepEqual(clone(h.state().tareas[0]), original.tareas[0]);
  assert.equal(h.state().tareas[2].titulo, 'Editada después del borrado');
  assert.deepEqual(clone(h.state().faltas), original.faltas);
  assert.deepEqual(clone(h.state().config), original.config);
  assert.equal(h.store.salvatucursoDeshacer, undefined);
  assert.equal(h.node('#undo-notice').hidden, true);
  assert.equal(s.UndoManager.restore(), false, 'no se duplica la recuperación');
  // Recarga, vencimiento, foco y segundo plano.
  s.UndoManager.remove('tareas', 't1');
  const persisted = clone(h.store), afterDelete = clone(h.state());
  let reloaded = harness(persisted); reloaded.s.setState(reloaded.s.normalizeState(afterDelete)); reloaded.s.UndoManager.bind();
  assert.equal(reloaded.node('#undo-notice').hidden, false);
  assert.equal(reloaded.s.UndoManager.restore(), true, 'recupera tras recargar');
  h.advance(10001);
  assert.equal(s.UndoManager.restore(), false);
  s.UndoManager.remove('tareas', 't2');
  h.node('#undo-notice').fire('focusin'); h.advance(20000);
  assert.equal(h.node('#undo-notice').hidden, false);
  h.node('#undo-notice').fire('focusout', { relatedTarget: null }); h.advance(9999);
  assert.equal(s.UndoManager.restore(), true);
  s.UndoManager.remove('tareas', 't3');
  h.document.hidden = true; h.fire('visibilitychange'); h.advance(20000);
  h.document.hidden = false; h.fire('visibilitychange');
  assert.equal(s.UndoManager.restore(), true, 'el tiempo se pausa fuera de la app');
  // Error al guardar: no borrar ni sustituir el aviso anterior.
  h = harness(); s = h.s; s.UndoManager.bind();
  h.fail('salvatucursoDeshacer');
  assert.equal(s.UndoManager.remove('tareas', 't1'), false); assert.equal(h.state().tareas.length, 3);
  h.fail(''); s.UndoManager.remove('tareas', 't1');
  const journal = h.store.salvatucursoDeshacer;
  h.fail('miAsistenciaState');
  assert.equal(s.UndoManager.remove('faltas', 'f1'), false); assert.equal(h.state().faltas.length, 1);
  assert.equal(h.store.salvatucursoDeshacer, journal);
  assert.equal(s.UndoManager.restore(), false); assert.equal(h.state().tareas.length, 2);
  h.fail(''); assert.equal(s.UndoManager.restore(), true);
  // No restaurar sobre cambios de otra pestaña ni recuperar tras un reset.
  s.UndoManager.remove('tareas', 't1');
  h.store.miAsistenciaState = JSON.stringify({ changed: true });
  assert.equal(s.UndoManager.restore(), false); assert.equal(h.state().tareas.length, 2);
  h.save(); s.UndoManager.remove('tareas', 't2'); s.deleteAll();
  assert.equal(s.UndoManager.restore(), false); assert.equal(h.state().tareas.length, 0);
  h = harness(); s = h.s; s.UndoManager.bind(); s.UndoManager.remove('faltas', 'f1');
  h.winEvents.storage[0]({ key: 'miAsistenciaState' }); assert.equal(s.UndoManager.restore(), false);
  // Si la clase cambia durante el plazo, la tarea vuelve sin un enlace incorrecto.
  h = harness(); s = h.s;
  Object.assign(h.state().tareas[0], task('t1', 'a1', 'lunes|h1')); h.save(); s.UndoManager.bind();
  s.UndoManager.remove('tareas', 't1'); h.state().horario.casillas['lunes|h1'] = { asignaturaId: 'a2' }; h.save();
  s.UndoManager.restore();
  assert.equal(h.state().tareas[0].slotKey, ''); assert.equal(h.state().tareas[0].descripcion, original.tareas[0].descripcion);
  // Copia múltiple: franjas compartidas, recreos, referencias independientes y datos académicos intactos.
  h = harness(); s = h.s;
  const academic = clone({ tareas: h.state().tareas, faltas: h.state().faltas, config: h.state().config, asignaturas: h.state().asignaturas });
  const sourceBefore = clone(h.state().horario);
  let plan = s.getCopyDayPlan('lunes', ['martes', 'miercoles']);
  assert.equal(plan.patches.length, 3); assert.equal(plan.rows[1].skipped, 1);
  let result = s.copyScheduleDay('lunes', ['martes', 'miercoles']);
  assert.equal(result.ok, true);
  assert.deepEqual(clone(h.state().horario.casillas['martes|h1']), { asignaturaId: 'a1' });
  assert.equal(h.state().horario.casillas['miercoles|h2'], undefined);
  assert.notEqual(h.state().horario.casillas['lunes|h1'], h.state().horario.casillas['martes|h1']);
  assert.notEqual(h.state().horario.casillas['martes|h1'], h.state().horario.casillas['miercoles|h1']);
  assert.deepEqual(clone(h.state().horario.franjas), sourceBefore.franjas);
  assert.deepEqual(clone(h.state().horario.diasSalida), sourceBefore.diasSalida);
  assert.deepEqual(clone({ tareas: h.state().tareas, faltas: h.state().faltas, config: h.state().config, asignaturas: h.state().asignaturas }), academic);
  assert.equal(s.copyScheduleDay('lunes', ['martes']).ok, false, 'no se escribe una copia idéntica');
  assert.equal(s.copyScheduleDay('lunes', ['lunes']).ok, false);
  assert.equal(s.copyScheduleDay('lunes', ['no-existe']).ok, false);
  assert.equal(s.copyScheduleDay('lunes', []).ok, false);
  s.setEditing(true); assert.equal(s.copyScheduleDay('lunes', ['martes']).ok, false); s.setEditing(false);
  // Sustitución explícita y tareas conservadas, sin enlaces a otra asignatura.
  h = harness(); s = h.s;
  h.state().horario.casillas['martes|h1'] = { asignaturaId: 'a2' };
  h.state().horario.casillas['martes|h3'] = { asignaturaId: 'a1' }; // El hueco del lunes se copia.
  h.state().tareas = [task('keep-source', 'a1', 'lunes|h1'), task('detach', 'a2', 'martes|h1'),
    task('keep-target', 'a2', 'martes|h2'), task('clear-target', 'a1', 'martes|h3')]; h.save();
  const tasksBefore = clone(h.state().tareas), cellsBefore = clone(h.state().horario.casillas);
  assert.equal(s.copyScheduleDay('lunes', ['martes']).ok, false);
  assert.deepEqual(clone(h.state().horario.casillas), cellsBefore);
  plan = s.getCopyDayPlan('lunes', ['martes']); assert.equal(plan.replaced, 2); assert.equal(plan.detached.length, 2);
  assert.equal(s.copyScheduleDay('lunes', ['martes'], true).ok, true);
  assert.equal(h.state().horario.casillas['martes|h3'], undefined);
  h.state().tareas.forEach((t, i) => {
    const expected = clone(tasksBefore[i]);
    if (['detach', 'clear-target'].includes(t.id)) Object.assign(expected, { slotKey: '', dia: '', horaInicio: '', horaFin: '' });
    assert.deepEqual(clone(t), expected);
  });
  // Días cortos conservan las clases posteriores del destino; no se propagan huérfanos.
  h = harness(); s = h.s;
  h.state().horario.casillas['miercoles|h1'] = { recreo: true };
  h.state().horario.casillas['martes|h3'] = { asignaturaId: 'a2' };
  h.save();
  assert.equal(s.copyScheduleDay('miercoles', ['martes']).ok, true);
  assert.equal(h.state().horario.casillas['martes|h1'].recreo, true);
  assert.equal(h.state().horario.casillas['martes|h3'].asignaturaId, 'a2');
  h.state().horario.casillas['lunes|h2'] = { asignaturaId: 'a3' };
  h.state().horario.casillas['lunes|h3'] = { asignaturaId: 'missing' }; h.save();
  plan = s.getCopyDayPlan('lunes', ['martes']);
  assert.equal(plan.invalid, 2); assert.equal(plan.patches.length, 1);
  h.state().horario.casillas['lunes|h1'] = { asignaturaId: 'missing' }; h.save();
  assert.equal(s.getCopyDayPlan('lunes', ['martes']).patches.length, 0);
  // Fallo de almacenamiento y revisión obsoleta: no modificar el horario.
  h = harness(); s = h.s;
  const stateBefore = clone(h.state()); h.fail('miAsistenciaState');
  assert.equal(s.copyScheduleDay('lunes', ['martes']).ok, false);
  assert.deepEqual(clone(h.state()), stateBefore);
  h.fail(''); h.store.miAsistenciaState = JSON.stringify({ changed: true });
  assert.equal(s.copyScheduleDay('lunes', ['martes']).ok, false);
  assert.deepEqual(clone(h.state()), stateBefore);
  h.save();
  h.node('#copy-day-source').value = 'lunes'; h.node('#copy-day-targets').querySelectorAll = () => [{ value: 'martes' }];
  s.renderCopyDayPreview(); h.state().horario.casillas['martes|h1'] = { asignaturaId: 'a2' }; h.save();
  h.node('#copy-replace-confirm').checked = true; s.applyCopyDayDialog();
  assert.equal(h.node('#copy-replace-confirm').checked, false);
  assert.equal(h.state().horario.casillas['martes|h1'].asignaturaId, 'a2');
  // Cancelar la configuración también revierte lo persistido antes de poder copiar.
  h = harness(); s = h.s;
  const scheduleBefore = clone(h.state().horario);
  s.toggleScheduleEdit(true); h.state().horario.diasSalida.martes = '09:00'; h.save();
  s.cancelarEdicionHorario();
  assert.deepEqual(clone(h.state().horario), scheduleBefore);
  assert.deepEqual(JSON.parse(h.store.miAsistenciaState).horario, scheduleBefore);
  assert.equal(s.copyScheduleDay('lunes', ['martes']).ok, true);
  // Los botones de faltas del historial usan los mismos flujos de edición y deshacer.
  h = harness(); s = h.s; s.bindHistory(); s.UndoManager.bind();
  const dialog = h.node('#dialog-history-day'); dialog.open = true;
  const del = { dataset: { delfalta: 'f1' }, closest: () => dialog };
  h.fire('click', { target: { closest: selector => selector === '[data-delfalta]' ? del : null } });
  assert.equal(h.state().faltas.length, 0); assert.equal(dialog.open, false); assert.equal(s.UndoManager.restore(), true);
  let edited = ''; s.openFaltaEdit = id => { edited = id; }; dialog.open = true;
  const edit = { dataset: { editfalta: 'f1' }, closest: () => dialog };
  h.fire('click', { target: { closest: selector => selector === '[data-editfalta]' ? edit : null } });
  assert.equal(edited, 'f1'); assert.equal(dialog.open, false);
  console.log('OK: deshacer, recarga, expiración, foco, segundo plano, fallos de guardado, copia por días, sustitución revisada y tareas conservadas');
})();
