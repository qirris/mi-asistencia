import { validDate } from './validation.mjs';
const DAY = 86400000;
const dateParts = (date, timeZone) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
export function inZone(iso, time, zone) {
  const [year, month, day] = iso.split('-').map(Number), [hour, minute] = time.split(':').map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  const offset = instant => { const p = dateParts(new Date(instant), zone); return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - instant; };
  const first = target - offset(target), second = target - offset(first);
  // En una hora inexistente del salto de verano se usa el lado posterior al salto.
  if (first !== second && target - offset(second) === first) return Math.max(first, second);
  return second;
}
export function reminderPrefs(value = {}) {
  const days = n => [0, 1, 2, 3, 7].includes(n) ? n : null;
  if (days(value.examDays) === null || days(value.taskDays) === null || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.time || '')) throw new Error('Preferencias inválidas');
  return { examDays: value.examDays, taskDays: value.taskDays, time: value.time };
}
export function jobsForCourse(course, prefs, timeZone, now = Date.now()) {
  const p = dateParts(new Date(now), timeZone), today = p.year + '-' + p.month + '-' + p.day;
  const jobs = [];
  for (const task of course.tareas || []) {
    const subject = course.asignaturas.find(a => a.id === task.asignaturaId && !a.archivada);
    if (!subject || task.estado !== 'pendiente' || task.tipo === 'nota' || !validDate(task.fechaEntrega) || task.fechaEntrega < today) continue;
    const days = task.tipo === 'examen' ? prefs.examDays : prefs.taskDays;
    const start = new Date(Date.parse(task.fechaEntrega + 'T12:00:00Z') - days * DAY).toISOString().slice(0, 10);
    const expiresAt = inZone(task.fechaEntrega, '23:59', timeZone) + 59999;
    jobs.push({ id: crypto.randomUUID(), key: task.id + '|' + task.fechaEntrega, taskId: task.id, date: task.fechaEntrega,
      title: String(task.titulo || '').slice(0, 160), subject: String(subject.nombre || '').slice(0, 100), kind: task.tipo === 'examen' ? 'examen' : 'tarea',
      timeZone, runAt: inZone(start, prefs.time, timeZone), expiresAt });
  }
  if (jobs.length > 1000) throw new Error('Demasiadas actividades pendientes');
  return jobs;
}
export function validateCourse(value) {
  if (!value || value.version !== 2 || !Array.isArray(value.asignaturas) || !Array.isArray(value.tareas) || !Array.isArray(value.faltas) || !value.config) throw new Error('Curso inválido');
  for (const name of ['asignaturas', 'tareas', 'faltas']) {
    if (value[name].length > 10000) throw new Error('Curso demasiado grande');
    const ids = new Set();
    for (const item of value[name]) {
      if (!item || !/^[A-Za-z0-9_-]{1,100}$/.test(item.id || '') || ids.has(item.id)) throw new Error('Identificadores inválidos');
      ids.add(item.id);
    }
  }
  return value;
}
