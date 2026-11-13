import { createAuth } from './auth.mjs';
import { validateSubscription, notificationPayload } from './validation.mjs';
import { jobsForCourse, reminderPrefs, validateCourse } from './planning.mjs';
import webpush from 'web-push';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
async function readBody(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Faltan datos');
  const chunks = []; let size = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength;
    if (size > 2000000) { await reader.cancel(); throw new Error('Demasiados datos'); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
function jobsStatements(db, deviceId, jobs, userId, revision) {
  const guard = 'EXISTS (SELECT 1 FROM courses WHERE user_id=? AND revision=?) AND EXISTS (SELECT 1 FROM push_devices WHERE id=? AND user_id=?)';
  const data = JSON.stringify(jobs);
  return [
    db.prepare(`DELETE FROM push_jobs WHERE device_id=? AND status<>'sent' AND event_key NOT IN (SELECT json_extract(value,'$.key') FROM json_each(?)) AND ${guard}`).bind(deviceId, data, userId, revision, deviceId, userId),
    db.prepare(`INSERT INTO push_jobs(id,device_id,event_key,payload,run_at,expires_at)
      SELECT json_extract(value,'$.id'),?,json_extract(value,'$.key'),value,json_extract(value,'$.runAt'),json_extract(value,'$.expiresAt') FROM json_each(?) WHERE ${guard}
      ON CONFLICT(device_id,event_key) DO UPDATE SET payload=excluded.payload,run_at=excluded.run_at,expires_at=excluded.expires_at,status='pending',claim_id=NULL,lease_until=NULL WHERE push_jobs.status<>'sent'`).bind(deviceId, data, userId, revision, deviceId, userId)
  ];
}
async function putCourse(env, userId, input) {
  if (!Object.hasOwn(input, 'revision') || (input.revision !== null && typeof input.revision !== 'string')) return json({ error: 'Falta la versión revisada' }, 428);
  const course = validateCourse(input.state), revision = crypto.randomUUID(), now = Date.now(), db = env.DB;
  const statements = [];
  if (input.revision === null) statements.push(db.prepare('INSERT INTO courses(user_id,state,revision,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO NOTHING').bind(userId, JSON.stringify(course), revision, now));
  else {
    statements.push(db.prepare('UPDATE courses SET state=?,revision=?,updated_at=? WHERE user_id=? AND revision=?').bind(JSON.stringify(course), revision, now, userId, input.revision));
  }
  // La revisión nueva protege también el reemplazo de los avisos de todos los dispositivos.
  const devices = (await db.prepare('SELECT * FROM push_devices WHERE user_id=?').bind(userId).all()).results;
  for (const device of devices) statements.push(...jobsStatements(db, device.id, jobsForCourse(course, JSON.parse(device.prefs), device.timezone), userId, revision));
  statements.push(db.prepare('INSERT INTO course_backups(id,user_id,state,created_at) SELECT ?,user_id,state,? FROM courses WHERE user_id=? AND revision=?').bind(crypto.randomUUID(), now, userId, revision));
  statements.push(db.prepare('DELETE FROM course_backups WHERE user_id=? AND id NOT IN (SELECT id FROM course_backups WHERE user_id=? ORDER BY created_at DESC LIMIT 5)').bind(userId, userId));
  const results = await db.batch(statements);
  if (results[0].meta.changes !== 1) return json({ error: 'El curso cambió en otro dispositivo' }, 409);
  return json({ revision, updatedAt: now });
}
async function send(env, subscription, payload, ttl = 3600) {
  return webpush.sendNotification(validateSubscription(subscription), JSON.stringify(payload), {
    vapidDetails: { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY },
    TTL: Math.max(0, Math.min(3600, ttl)), urgency: 'normal', timeout: 10000
  });
}
async function deviceAction(env, userId, input) {
  if (!/^[a-f0-9-]{36}$/.test(input.deviceId || '')) return json({ error: 'Dispositivo inválido' }, 400);
  const db = env.DB, device = await db.prepare('SELECT * FROM push_devices WHERE id=?').bind(input.deviceId).first();
  if (device && device.user_id !== userId) return json({ error: 'Dispositivo no disponible' }, 403);
  if (input.action === 'disable') {
    await db.prepare('DELETE FROM push_devices WHERE id=? AND user_id=?').bind(input.deviceId, userId).run(); return json({ ok: true });
  }
  if (input.action === 'test') {
    const result = await db.prepare('UPDATE push_devices SET last_test_at=? WHERE id=? AND user_id=? AND (last_test_at IS NULL OR last_test_at<?) RETURNING subscription').bind(Date.now(), input.deviceId, userId, Date.now() - 60000).first();
    if (!result) return json({ error: 'Espera un minuto antes de repetir la prueba' }, 429);
    await send(env, JSON.parse(result.subscription), { title: 'Tus avisos están preparados', body: 'Aquí recibirás los recordatorios de SalvaTuCurso.', tag: 'curso-prueba', taskId: '' }); return json({ ok: true });
  }
  if (input.action !== 'sync') return json({ error: 'Acción inválida' }, 400);
  const subscription = validateSubscription(input.subscription), prefs = reminderPrefs(input.prefs);
  new Intl.DateTimeFormat('es', { timeZone: input.timeZone }).format();
  const course = await db.prepare('SELECT state,revision FROM courses WHERE user_id=?').bind(userId).first();
  if (!course) return json({ error: 'Sincroniza primero tu curso' }, 409);
  const count = await db.prepare('SELECT count(*) AS n FROM push_devices WHERE user_id=?').bind(userId).first();
  if (!device && count.n >= 10) return json({ error: 'Límite de dispositivos alcanzado' }, 400);
  const jobs = jobsForCourse(JSON.parse(course.state), prefs, input.timeZone);
  const results = await db.batch([
    db.prepare('INSERT INTO push_devices(id,user_id,subscription,prefs,timezone,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET subscription=excluded.subscription,prefs=excluded.prefs,timezone=excluded.timezone,updated_at=excluded.updated_at WHERE push_devices.user_id=excluded.user_id').bind(input.deviceId, userId, JSON.stringify(subscription), JSON.stringify(prefs), input.timeZone, Date.now()),
    ...jobsStatements(db, input.deviceId, jobs, userId, course.revision),
    db.prepare('SELECT revision FROM courses WHERE user_id=?').bind(userId)
  ]);
  if (results.at(-1).results[0]?.revision !== course.revision) return json({ error: 'El curso cambió; vuelve a actualizar los avisos' }, 409);
  return json({ ok: true, count: jobs.length });
}
export async function dispatch(env, sender = send) {
  const now = Date.now(), db = env.DB, claim = crypto.randomUUID();
  await db.batch([
    db.prepare('DELETE FROM "rateLimit" WHERE "key" LIKE \'curso:%\' AND "lastRequest"<?').bind(now - 120000),
    db.prepare('DELETE FROM push_devices WHERE updated_at<?').bind(now - 120 * 86400000),
    db.prepare('DELETE FROM push_jobs WHERE expires_at<?').bind(now - 7 * 86400000)
  ]);
  const { results: jobs } = await db.prepare(`UPDATE push_jobs SET status='leased',attempts=attempts+1,claim_id=?,lease_until=? WHERE id IN
    (SELECT id FROM push_jobs WHERE run_at<=? AND expires_at>? AND attempts<4 AND (status='pending' OR (status='leased' AND lease_until<?)) ORDER BY run_at LIMIT 25) RETURNING *`).bind(claim, now + 120000, now, now, now).all();
  for (let index = 0; index < jobs.length; index += 5) await Promise.all(jobs.slice(index, index + 5).map(async job => {
    const current = await db.prepare('SELECT d.subscription FROM push_jobs j JOIN push_devices d ON j.device_id=d.id WHERE j.id=? AND j.claim_id=? AND j.status=\'leased\'').bind(job.id, claim).first();
    if (!current) return;
    let status = 'pending';
    try { await sender(env, JSON.parse(current.subscription), notificationPayload(JSON.parse(job.payload)), Math.floor((job.expires_at - Date.now()) / 1000)); status = 'sent'; }
    catch (error) {
      if ([404, 410].includes(error.statusCode)) { await db.prepare('DELETE FROM push_devices WHERE id=? AND EXISTS (SELECT 1 FROM push_jobs WHERE id=? AND claim_id=?)').bind(job.device_id, job.id, claim).run(); return; }
      if (job.attempts >= 4 || (error.statusCode && error.statusCode < 500 && error.statusCode !== 429)) status = 'expired';
    }
    await db.prepare('UPDATE push_jobs SET status=?,run_at=?,claim_id=NULL,lease_until=NULL WHERE id=? AND claim_id=?').bind(status, status === 'pending' ? Date.now() + 300000 : job.run_at, job.id, claim).run();
  }));
}
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/src/js/push-config.js') return new Response('window.SalvaTuCursoPushConfig = ' + JSON.stringify({ enabled: true, apiBase: '/api', vapidPublicKey: env.VAPID_PUBLIC_KEY || '', google: !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET, email: env.AUTH_EMAIL_ENABLED === 'true' && !!env.EMAIL && !!env.EMAIL_FROM }) + ';', { headers: { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' } });
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) return json({ error: 'El servicio aún no está configurado' }, 503);
    try {
      const auth = createAuth(env, ctx);
      if (url.pathname.startsWith('/api/auth/')) return auth.handler(request);
      if (request.method !== 'GET' && request.headers.get('Origin') !== env.APP_ORIGIN) return json({ error: 'Origen no permitido' }, 403);
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session?.user?.emailVerified) return json({ error: 'Inicia sesión para continuar' }, 401);
      const userId = session.user.id;
      if (request.method !== 'GET') {
        const now = Date.now(), key = 'curso:' + userId + ':' + Math.floor(now / 60000);
        const allowed = await env.DB.prepare('INSERT INTO "rateLimit"("id","key","count","lastRequest") VALUES(?,?,1,?) ON CONFLICT("key") DO UPDATE SET "count"="count"+1 WHERE "count"<60 RETURNING "count"').bind(crypto.randomUUID(), key, now).first();
        if (!allowed) return json({ error: 'Espera un minuto antes de volver a guardar' }, 429);
      }
      if (url.pathname === '/api/course' && request.method === 'GET') {
        const course = await env.DB.prepare('SELECT state,revision,updated_at FROM courses WHERE user_id=?').bind(userId).first();
        return json(course ? { state: JSON.parse(course.state), revision: course.revision, updatedAt: course.updated_at } : { state: null, revision: null });
      }
      if (url.pathname === '/api/course' && request.method === 'PUT') return await putCourse(env, userId, await readBody(request));
      if (url.pathname === '/api/push' && request.method === 'POST') return await deviceAction(env, userId, await readBody(request));
      return json({ error: 'No disponible' }, 404);
    } catch (error) { return json({ error: 'No se ha podido completar la operación' }, error instanceof SyntaxError ? 400 : 503); }
  },
  async scheduled(controller, env, ctx) { ctx.waitUntil(dispatch(env)); }
};
