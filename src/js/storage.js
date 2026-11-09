/* ============================================================
   Mi Asistencia — storage.js
   Persistencia en localStorage, migración y normalización de datos.
   ============================================================ */

const STORAGE_KEY = 'miAsistenciaState';
const LEGACY_KEY = 'asistenciaData';

const DEFAULT_STATE = {
  version: 2,
  etapa: 'fp_superior',
  asignaturas: [],
  faltas: [],
  tareas: [],
  config: { criterio: { tipo: '', valor: null } },
  horario: null
};

/* ---------- Utilidades ---------- */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function todayISO() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

/* ---------- Persistencia ---------- */
function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      state = normalizeState(parsed);
      return;
    } catch (e) {
      console.warn('Estado corrupto, se reinicia.', e);
    }
  }
  state = normalizeState(JSON.parse(JSON.stringify(DEFAULT_STATE)));
  migrateLegacy();
}

function migrateLegacy() {
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) return;
  try {
    const old = JSON.parse(raw);
    if (!old || !Array.isArray(old.asignaturas) || old.asignaturas.length === 0) return;
    state.etapa = old.nivel === 'eso' ? 'eso' : 'fp_superior';
    state.asignaturas = old.asignaturas.map((a, i) => ({
      id: uid(),
      nombre: a.nombre || ('Materia ' + (i + 1)),
      horasSemanales: null,
      semanas: null,
      horasTotales: Number(a.total) || 0,
      archivada: false
    }));
    state.faltas = [];
    old.asignaturas.forEach((a, i) => {
      const h = Number(a.faltas) || 0;
      if (h > 0 && state.asignaturas[i]) {
        state.faltas.push({
          id: uid(),
          asignaturaId: state.asignaturas[i].id,
          fecha: todayISO(),
          horas: h,
          tipo: 'no_justificada',
          motivo: 'Migrado desde versión anterior'
        });
      }
    });
    // Conservar copia de los datos antiguos antes de migrar
    localStorage.setItem(LEGACY_KEY + '_backup', raw);
    saveState();
  } catch (e) {
    console.warn('No se pudo migrar la versión anterior.', e);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeState(input) {
  const out = Object.assign({}, DEFAULT_STATE, input || {});
  if (!ETAPAS[out.etapa]) out.etapa = 'fp_superior';

  out.asignaturas = Array.isArray(out.asignaturas)
    ? out.asignaturas.filter(a => a && a.id).map((a, i) => ({
        id: String(a.id),
        nombre: String(a.nombre || 'Sin nombre'),
        color: colorValido(a.color, i),
        horasSemanales: a.horasSemanales == null || a.horasSemanales === '' ? null : Number(a.horasSemanales),
        semanas: a.semanas == null || a.semanas === '' ? null : Number(a.semanas),
        horasTotales: Number(a.horasTotales) || 0,
        archivada: !!a.archivada
      }))
    : [];

  out.faltas = Array.isArray(out.faltas)
    ? out.faltas.filter(f => f && f.id && f.asignaturaId).map(f => ({
        id: String(f.id),
        asignaturaId: String(f.asignaturaId),
        fecha: String(f.fecha || todayISO()),
        horas: Number(f.horas) || 0,
        tipo: f.tipo === 'justificada' ? 'justificada' : 'no_justificada',
        motivo: String(f.motivo || '')
      }))
    : [];

  out.tareas = Array.isArray(out.tareas)
    ? out.tareas.filter(t => t && t.id && t.asignaturaId).map(t => ({
        id: String(t.id),
        asignaturaId: String(t.asignaturaId),
        asignaturaNombre: String(t.asignaturaNombre || ''),
        slotKey: t.slotKey ? String(t.slotKey) : '',
        dia: String(t.dia || ''),
        horaInicio: String(t.horaInicio || ''),
        horaFin: String(t.horaFin || ''),
        fechaCreacion: String(t.fechaCreacion || todayISO()),
        fechaEntrega: String(t.fechaEntrega || ''),
        tipo: ['deberes', 'estudiar', 'examen', 'trabajo', 'proyecto', 'otros', 'nota'].includes(t.tipo) ? t.tipo : 'deberes',
        prioridad: ['baja', 'normal', 'alta'].includes(t.prioridad) ? t.prioridad : 'normal',
        estado: t.estado === 'completada' ? 'completada' : 'pendiente',
        titulo: String(t.titulo || ''),
        descripcion: String(t.descripcion || '')
      }))
    : [];

  out.config = Object.assign({ criterio: { tipo: '', valor: null } }, out.config || {});
  out.config.criterio = Object.assign({ tipo: '', valor: null }, (out.config || {}).criterio || {});
  out.horario = normalizeHorario(out.horario);
  return out;
}
