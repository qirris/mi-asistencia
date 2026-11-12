/* Pruebas de Inicio actualizado y tareas rápidas. */
(function dailyUseTest() {
  const fs = require('fs');
  const vm = require('vm');
  const assert = require('assert/strict');
  let instant = new Date(2026, 10, 9, 8, 59, 30).getTime();
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [instant])); }
    static now() { return instant; }
  }
  const docEvents = {}, winEvents = {}, timers = new Map(), nodes = new Map(), storage = {};
  let timerId = 0;
  const document = { hidden: false, activeElement: null };
  function element(selector) {
    if (nodes.has(selector)) return nodes.get(selector);
    const classes = new Set();
    const el = {
      id: selector.startsWith('#') && !selector.includes(' ') ? selector.slice(1) : '',
      value: '', textContent: '', style: {}, dataset: {}, open: false, scrollTop: 99, writes: 0,
      classList: { add(x) { classes.add(x); }, remove(x) { classes.delete(x); }, toggle(x, force) { if (force) classes.add(x); else classes.delete(x); }, contains(x) { return classes.has(x); } },
      addEventListener() {}, appendChild() {}, removeAttribute() {}, setAttribute() {},
      closest() { return null; }, querySelectorAll() { return []; },
      querySelector(child) { return element(selector + ' ' + child); },
      showModal() { this.open = true; }, close() { this.open = false; },
      focus() { document.activeElement = this; }
    };
    let html = '';
    Object.defineProperty(el, 'innerHTML', { get() { return html; }, set(value) { html = value; this.writes++; } });
    nodes.set(selector, el);
    return el;
  }
  document.querySelector = element;
  document.querySelectorAll = () => [];
  document.createElement = () => element('new-' + nodes.size);
  document.addEventListener = (name, callback) => (docEvents[name] ||= []).push(callback);
  document.head = { appendChild() {} };
  document.body = { appendChild() {}, removeChild() {} };
  const sandbox = {
    Date: ClockDate, console, document,
    window: { addEventListener(name, callback) { (winEvents[name] ||= []).push(callback); }, matchMedia() { return { matches: false }; }, scrollTo() {} },
    navigator: { userAgent: 'test', standalone: false },
    localStorage: { getItem: key => storage[key] ?? null, setItem: (key, value) => { storage[key] = String(value); }, removeItem: key => { delete storage[key]; } },
    setTimeout(callback, delay) { const id = timerId++; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    confirm: () => true, alert() {}, Blob: function () {}, URL: {}, FileReader: function () {}
  };
  const source = ['attendance', 'storage', 'schedule', 'tasks', 'history', 'app'].map(name => fs.readFileSync('src/js/' + name + '.js', 'utf8')).join('\n') +
    '\nthis.getState = () => state; this.setState = value => { state = value; };';
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  const state = sandbox.normalizeState({
    etapa: 'fp_superior',
    asignaturas: [
      { id: 'a1', nombre: 'Redes', horasTotales: 120 },
      { id: 'a2', nombre: 'Bases', horasTotales: 120 }
    ],
    tareas: [{ id: 't1', asignaturaId: 'a1', titulo: 'Repasar', fechaEntrega: '2026-11-09', estado: 'pendiente' }],
    config: { onboarding: { etapaConfirmada: true, oculto: false } },
    horario: { entrada: '08:00', salida: '10:00', dias: ['lunes', 'martes'], franjas: [
      { id: 'h1', inicio: '08:00', fin: '09:00', tipo: 'clase' },
      { id: 'h2', inicio: '09:00', fin: '10:00', tipo: 'clase' }
    ], casillas: { 'lunes|h1': { asignaturaId: 'a1' }, 'lunes|h2': { asignaturaId: 'a2' }, 'martes|h1': { asignaturaId: 'a1' } } }
  });
  sandbox.setState(state);
  const nextTitle = () => element('#dash-priorities').innerHTML.match(/class="priority-title">([^<]+)/)[1];
  const fire = (events, name) => events[name].forEach(callback => callback({}));
  sandbox.bindDashboardRefresh();
  sandbox.bindDashboardRefresh();
  assert.equal(timers.size, 1, 'un solo temporizador aunque se intente enlazar dos veces');
  assert.equal(docEvents.visibilitychange.length, 1);
  assert.equal(winEvents.pageshow.length, 1);
  assert.equal(winEvents.focus.length, 1);
  assert.equal(nextTitle(), 'Redes');
  assert.match(element('#dash-alerts').innerHTML, /Tarea para hoy/);
  const initial = [...timers.entries()][0];
  assert.equal(initial[1].delay, 30025, 'se alinea con el siguiente minuto');
  instant = new Date(2026, 10, 9, 9, 0, 1).getTime();
  timers.delete(initial[0]);
  initial[1].callback();
  assert.equal(nextTitle(), 'Bases', 'cambia la clase al cruzar su hora de inicio');
  assert.equal(timers.size, 1);
  const unchangedWrites = element('#dash-priorities').writes;
  fire(winEvents, 'focus');
  assert.equal(element('#dash-priorities').writes, unchangedWrites, 'no reconstruye bloques sin cambios');
  assert.equal(timers.size, 1);

  element('#dlg-task-titulo').value = 'Borrador sin guardar';
  element('#setup-etapa').value = 'bachillerato';
  document.hidden = true;
  fire(docEvents, 'visibilitychange');
  assert.equal(timers.size, 0, 'se detiene al ocultar la app');
  instant = new Date(2026, 10, 10, 0, 1).getTime();
  document.hidden = false;
  fire(docEvents, 'visibilitychange');
  assert.match(element('#dash-fecha-actual').textContent, /10 de noviembre/);
  assert.match(element('#dash-alerts').innerHTML, /Tarea vencida/);
  assert.equal(element('#dlg-task-titulo').value, 'Borrador sin guardar');
  assert.equal(element('#setup-etapa').value, 'bachillerato');
  assert.equal(timers.size, 1);
  instant = new Date(2026, 10, 10, 8, 15).getTime();
  fire(winEvents, 'pageshow');
  assert.match(element('#dash-priorities').innerHTML, /Tu clase ahora/);
  instant = new Date(2026, 10, 10, 9, 15).getTime();
  fire(winEvents, 'focus');
  assert.match(element('#dash-priorities').innerHTML, /Próxima clase/);
  assert.equal(timers.size, 1);

  // El formulario reducido conserva los valores de los campos plegados.
  sandbox.openTaskDialog();
  assert.equal(element('#task-more-options').open, false);
  assert.equal(document.activeElement.id, 'dlg-task-titulo');
  assert.equal(element('#dialog-task .dialog-content').scrollTop, 0);
  element('#dlg-task-titulo').value = 'Ejercicios';
  element('#dlg-task-asig').value = 'a1';
  sandbox.guardarTareaModal();
  const basic = state.tareas[state.tareas.length - 1];
  assert.equal(basic.tipo, 'deberes');
  assert.equal(basic.prioridad, 'normal');
  assert.equal(basic.estado, 'pendiente');
  assert.equal(basic.descripcion, '');
  assert.equal(basic.fechaEntrega, '');

  sandbox.openTaskDialog({ asignaturaId: 'a2', tipo: 'examen', prioridad: 'alta', fechaEntrega: '2026-11-12',
    slotKey: 'lunes|h2', dia: 'lunes', horaInicio: '09:00', horaFin: '10:00' });
  assert.equal(element('#task-more-options').open, true);
  element('#task-more-options').open = false;
  element('#dlg-task-titulo').value = 'Examen SQL';
  element('#dlg-task-desc').value = 'Temas 1 y 2';
  sandbox.guardarTareaModal();
  const advanced = state.tareas[state.tareas.length - 1];
  assert.equal(advanced.tipo, 'examen');
  assert.equal(advanced.prioridad, 'alta');
  assert.equal(advanced.descripcion, 'Temas 1 y 2');
  assert.equal(advanced.fechaEntrega, '2026-11-12');
  assert.equal(advanced.slotKey, 'lunes|h2');

  assert.match(element('#tasks-stats').innerHTML, /1<\/strong> examen<\/span>/);
  sandbox.alternarEstadoTarea(advanced.id);
  assert.match(element('#tasks-stats').innerHTML, /1<\/strong> completada<\/span>/);

  const count = state.tareas.length;
  sandbox.openTaskEditDialog(advanced.id);
  assert.equal(element('#task-more-options').open, true);
  element('#task-more-options').open = false;
  element('#dlg-task-titulo').value = 'Examen SQL actualizado';
  sandbox.guardarTareaModal();
  assert.equal(state.tareas.length, count);
  assert.equal(advanced.estado, 'completada', 'editar no pierde el estado completado');
  assert.equal(advanced.tipo, 'examen');
  assert.equal(advanced.prioridad, 'alta');
  assert.equal(advanced.descripcion, 'Temas 1 y 2');
  assert.equal(advanced.slotKey, 'lunes|h2');

  state.asignaturas[1].archivada = true;
  sandbox.openTaskEditDialog(advanced.id);
  assert.match(element('#dlg-task-asig').innerHTML, /a2.*Bases.*archivada/);
  assert.equal(element('#dlg-task-asig').value, 'a2');
  sandbox.guardarTareaModal();
  assert.equal(advanced.asignaturaId, 'a2');

  sandbox.openTaskDialog();
  assert.equal(element('#task-more-options').open, false);
  assert.equal(element('#dlg-task-tipo').value, 'deberes');
  assert.equal(element('#dlg-task-desc').value, '');
  sandbox.openTaskDialog({ tipo: 'nota', asignaturaId: 'a1' });
  assert.equal(element('#task-more-options').open, true);
  assert.equal(element('#dlg-task-tipo').value, 'nota');
  assert.equal(element('#dlg-task-title').textContent, 'Nueva nota');

  const html = fs.readFileSync('index.html', 'utf8');
  const dialog = html.match(/<dialog id="dialog-task"[\s\S]*?<\/dialog>/)[0];
  const beforeOptions = dialog.split('<details class="task-options"')[0];
  assert.deepEqual([...beforeOptions.matchAll(/<(?:input|select|textarea)[^>]+id="([^"]+)"/g)].map(m => m[1]),
    ['dlg-task-titulo', 'dlg-task-asig', 'dlg-task-fecha'], 'sólo se muestran los tres campos básicos al crear');
  console.log('OK: cambio de clase, medianoche, retorno a la app, temporizador único, borradores y tareas rápidas con campos avanzados conservados');
})();
