/* Pruebas de cálculo y render de SalvaTuCurso.
   Ejecutar desde la raíz del proyecto: node tests/attendance.test.js */

const fs = require('fs');
const vm = require('vm');

const code = [
  'src/js/attendance.js',
  'src/js/calendar.js',
  'src/js/absence-day.js',
  'src/js/storage.js',
  'src/js/schedule.js',
  'src/js/tasks.js',
  'src/js/history.js',
  'src/js/app.js'
].map(f => fs.readFileSync(f, 'utf8')).join('\n') +
  '\nglobalThis.__getState = () => state; globalThis.__setState = (s) => { state = s; };';

const sample = {
  version: 2,
  etapa: 'fp_superior',
  asignaturas: [
    { id: 'a1', nombre: 'Sistemas', horasSemanales: 5, semanas: 30, horasTotales: 150, archivada: false },
    { id: 'a2', nombre: 'Bases', horasSemanales: 4, semanas: 30, horasTotales: 120, archivada: false }
  ],
  faltas: [
    { id: 'f1', asignaturaId: 'a1', fecha: '2026-11-01', horas: 30, tipo: 'no_justificada', motivo: '' }
  ],
  config: { criterio: { tipo: '', valor: null } },
  horario: {
    entrada: '08:00',
    salida: '10:00',
    duracionClase: 60,
    duracionRecreo: 0,
    recreoTras: 3,
    numRecreos: 0,
    dias: ['lunes', 'martes'],
    diasSalida: { lunes: '10:00', martes: '09:00' },
    franjas: [
      { id: 'h1', inicio: '08:00', fin: '09:00', tipo: 'clase' },
      { id: 'h2', inicio: '09:00', fin: '10:00', tipo: 'clase' }
    ],
    casillas: {
      'lunes|h1': { asignaturaId: 'a1' },
      'lunes|h2': { asignaturaId: 'a2' },
      'martes|h1': { asignaturaId: 'a1' }
    }
  }
};

const store = {};
store['miAsistenciaState'] = JSON.stringify(sample);

const dummyEl = () => ({
  value: '', innerHTML: '', textContent: '', style: {}, dataset: {},
  classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
  addEventListener() {}, appendChild() {}, files: [],
  showModal() {}, close() {}, closest() { return null; }
});

const sandbox = {
  console,
  setTimeout: () => 0,
  clearTimeout: () => {},
  confirm: () => true,
  alert: () => {},
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  },
  document: {
    addEventListener() {},
    querySelector: () => dummyEl(),
    querySelectorAll: () => [],
    createElement: () => dummyEl(),
    head: { appendChild() {} },
    body: { appendChild() {}, removeChild() {} }
  },
  window: {
    addEventListener() {},
    matchMedia: () => ({ matches: false }),
    scrollTo() {}
  },
  navigator: { userAgent: 'node-test', standalone: false },
  Blob: function () {},
  URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
  FileReader: function () {},
  Tesseract: undefined
};
sandbox.self = sandbox.window;

vm.createContext(sandbox);
vm.runInContext(code, sandbox);

// Cargar estado desde localStorage simulado
sandbox.loadState();

// Prueba de humo: render completo de todas las vistas
try {
  sandbox.render();
  console.log('OK: render() completo sin errores');
} catch (e) {
  console.error('FALLO en render():', e.message);
  process.exitCode = 1;
}

const st = sandbox.__getState();
const a1 = st.asignaturas.find(a => a.id === 'a1');
const a2 = st.asignaturas.find(a => a.id === 'a2');

const c1 = sandbox.calcAsignatura(a1);
const c2 = sandbox.calcAsignatura(a2);
const e1 = sandbox.estadoAsignatura(a1, c1);
const g = sandbox.calcGlobal();

function assert(cond, msg) {
  if (!cond) { console.error('FALLO: ' + msg); process.exitCode = 1; }
  else console.log('OK: ' + msg);
}

assert(Math.abs(c1.pct - 80) < 0.001, 'a1 asistencia = 80% (obtenido ' + c1.pct.toFixed(2) + ')');
assert(Math.abs(c1.pctAusencia - 20) < 0.001, 'a1 ausencia = 20%');
assert(c2.pct === 100, 'a2 asistencia = 100%');
assert(e1.tone === 'yellow', 'a1 FP justo en el límite (20% ausencia) = cerca del límite (obtenido ' + e1.tone + ')');
assert(Math.abs(g.pct - (240 / 270) * 100) < 0.001, 'asistencia global ponderada correcta (' + g.pct.toFixed(2) + '%)');
assert(g.totalPlan === 270, 'horas planificadas globales = 270');

// Cambiar a ESO con criterio 15% y recalcular estado
st.etapa = 'eso';
st.config.criterio = { tipo: 'porcentaje', valor: 15 };
const e1eso = sandbox.estadoAsignatura(a1, sandbox.calcAsignatura(a1));
assert(e1eso.tone === 'red', 'a1 en ESO con criterio 15% = límite superado (obtenido ' + e1eso.tone + ')');

// Sin criterio en ESO
st.config.criterio = { tipo: '', valor: null };
const e1sin = sandbox.estadoAsignatura(a1, sandbox.calcAsignatura(a1));
assert(e1sin.tone === 'gray', 'a1 en ESO sin criterio = falta criterio (obtenido ' + e1sin.tone + ')');

// Normalización: etapa inválida
const norm = sandbox.normalizeState({ etapa: 'inventada', asignaturas: [], faltas: [] });
assert(norm.etapa === 'fp_superior', 'normalizeState corrige etapa inválida');

console.log('\nPrueba funcional completada.');

// Próxima clase: límites horarios, cambio de día y asignaturas archivadas.
st.etapa = 'fp_superior';
assert(sandbox.findNextClass(new Date(2026, 10, 9, 8, 30)).subject.id === 'a1', 'la clase en curso tiene prioridad');
assert(sandbox.findNextClass(new Date(2026, 10, 9, 9, 0)).subject.id === 'a2', 'al terminar una clase se muestra la siguiente');
const nextDay = sandbox.findNextClass(new Date(2026, 10, 9, 10, 0));
assert(nextDay.offset === 1 && nextDay.subject.id === 'a1', 'al terminar el día se busca la siguiente jornada');
const nextWeek = sandbox.findNextClass(new Date(2026, 10, 10, 9, 0));
assert(nextWeek.offset === 6 && nextWeek.day.key === 'lunes', 'se respeta la salida anticipada de cada día');
assert(sandbox.findNextClass(new Date(2026, 10, 15, 12, 0)).offset === 1, 'el domingo encuentra la clase del lunes');
a1.archivada = true;
assert(sandbox.findNextClass(new Date(2026, 10, 9, 8, 30)).subject.id === 'a2', 'no se muestran asignaturas archivadas');
a2.archivada = true;
assert(sandbox.findNextClass(new Date(2026, 10, 9, 8, 30)) === null, 'sin asignaturas activas no se inventa una clase');
a1.archivada = a2.archivada = false;

// La guía conserva el progreso y reconoce a quien ya tiene el curso preparado.
assert(st.config.onboarding.etapaConfirmada === true, 'los datos existentes no obligan a repetir la elección de etapa');
const fresh = sandbox.normalizeState({});
sandbox.__setState(fresh);
assert(sandbox.getSetupProgress().step === 1, 'un curso nuevo empieza por elegir etapa');
fresh.config.onboarding.etapaConfirmada = true;
assert(sandbox.getSetupProgress().step === 2, 'después de la etapa se añaden asignaturas');
fresh.asignaturas.push({id:'n1',nombre:'Matemáticas',archivada:false});
assert(sandbox.getSetupProgress().step === 3, 'con una asignatura se propone preparar el horario');
fresh.horario.casillas['lunes|' + fresh.horario.franjas.find(f => f.tipo === 'clase').id] = {asignaturaId:'n1'};
assert(sandbox.getSetupProgress().step === 4, 'la primera clase asignada completa los primeros pasos');
fresh.config.onboarding.oculto = true;
const restored = sandbox.normalizeState(JSON.parse(JSON.stringify(fresh)));
assert(restored.config.onboarding.oculto && restored.config.onboarding.etapaConfirmada, 'continuar después se conserva al guardar y recargar');
sandbox.__setState(st);
