/* Validaciones puras, compartidas con las pruebas. Nunca aceptar destinos arbitrarios. */
export function validateSubscription(value) {
  if (!value || typeof value.endpoint !== 'string' || value.endpoint.length > 2048) throw new Error('Suscripción inválida');
  const url = new URL(value.endpoint);
  const host = url.hostname;
  const allowed = host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com' ||
    host.endsWith('.push.apple.com') || host.endsWith('.notify.windows.com');
  if (!allowed || url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) throw new Error('Destino no permitido');
  const keys = value.keys;
  if (!keys || !/^[A-Za-z0-9_-]{87}$/.test(keys.p256dh || '') || !/^[A-Za-z0-9_-]{22}$/.test(keys.auth || '')) throw new Error('Claves inválidas');
  return { endpoint: url.href, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.slice(0, 4) === '0000') return false;
  const date = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validateJobs(value, now = Date.now()) {
  if (!Array.isArray(value) || value.length > 1000) throw new Error('Máximo de 1000 avisos pendientes');
  const keys = new Set();
  return value.map(item => {
    if (!item || typeof item.taskId !== 'string' || !item.taskId || item.taskId.length > 100 ||
      !validDate(item.date) || item.key !== item.taskId + '|' + item.date || keys.has(item.key)) throw new Error('Actividad inválida o repetida');
    keys.add(item.key);
    const run = Date.parse(item.runAt), expiry = Date.parse(item.expiresAt);
    if (!Number.isFinite(run) || !Number.isFinite(expiry) || run > expiry || expiry <= now ||
      expiry - run > 9 * 86400000 || expiry - now > 3660 * 86400000) throw new Error('Fecha de aviso inválida');
    if (!['examen', 'tarea'].includes(item.kind) || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 160 ||
      typeof item.subject !== 'string' || item.subject.length > 100 || typeof item.timeZone !== 'string' || item.timeZone.length > 100) throw new Error('Contenido inválido');
    new Intl.DateTimeFormat('en', { timeZone: item.timeZone }).format();
    return { key: item.key, taskId: item.taskId, date: item.date, title: item.title.trim(), subject: item.subject,
      kind: item.kind, timeZone: item.timeZone, runAt: new Date(run).toISOString(), expiresAt: new Date(expiry).toISOString() };
  });
}
export function notificationPayload(job, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: job.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = name => parts.find(part => part.type === name).value;
  const today = value('year') + '-' + value('month') + '-' + value('day');
  const days = Math.round((Date.parse(job.date + 'T12:00:00Z') - Date.parse(today + 'T12:00:00Z')) / 86400000);
  const when = days === 0 ? 'hoy' : days === 1 ? 'mañana' : 'en ' + days + ' días';
  return { title: (job.kind === 'examen' ? 'Examen ' : 'Entrega ') + when,
    body: job.title + (job.subject ? ' · ' + job.subject : ''), taskId: job.taskId, tag: 'curso-' + job.key };
}
