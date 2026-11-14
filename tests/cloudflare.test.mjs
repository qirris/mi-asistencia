/* Integración local con SQLite y el mismo contrato de D1. No envía correos ni Push reales. */
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import worker, { dispatch } from '../cloudflare/worker.mjs';
import { inZone, jobsForCourse } from '../cloudflare/planning.mjs';

class LocalD1 {
  constructor() { this.sqlite = new DatabaseSync(':memory:'); this.failSQL = ''; }
  exec(sql) { this.sqlite.exec(sql); }
  prepare(sql) {
    const database = this;
    return { sql, params: [], bind(...params) { return { ...this, params }; },
      execute() {
        if (database.failSQL && sql.includes(database.failSQL)) { database.failSQL = ''; throw Error('Fallo simulado de guardado'); }
        const before = database.sqlite.prepare('SELECT total_changes() AS n').get().n;
        const results = database.sqlite.prepare(sql).all(...this.params);
        const after = database.sqlite.prepare('SELECT total_changes() AS n').get().n;
        return { success: true, results, meta: { changes: after - before, last_row_id: database.sqlite.prepare('SELECT last_insert_rowid() AS n').get().n } };
      },
      async all() { return this.execute(); }, async run() { return this.execute(); },
      async first() { return this.execute().results[0] || null; }, async raw() { return this.execute().results.map(Object.values); }
    };
  }
  async batch(statements) {
    this.exec('SAVEPOINT batch_test');
    try { const results = statements.map(statement => statement.execute()); this.exec('RELEASE batch_test'); return results; }
    catch (error) { this.exec('ROLLBACK TO batch_test; RELEASE batch_test'); throw error; }
  }
}
const db = new LocalD1();
db.exec(readFileSync('cloudflare/migrations/0001_acceso.sql', 'utf8'));
db.exec(readFileSync('cloudflare/migrations/0002_curso_y_avisos.sql', 'utf8'));
const mails = [], background = [];
const env = { DB: db, APP_ORIGIN: 'http://localhost:8787', BETTER_AUTH_SECRET: randomBytes(40).toString('base64url'),
  AUTH_EMAIL_ENABLED: 'true', EMAIL_FROM: 'pruebas@example.test', EMAIL: { async send(email) { mails.push(email); } } };
const ctx = { waitUntil(promise) { background.push(promise); } };
async function call(path, method = 'GET', body, cookie = '', origin = env.APP_ORIGIN) {
  const response = await worker.fetch(new Request(env.APP_ORIGIN + path, { method,
    headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie, 'cf-connecting-ip': '127.0.0.1' },
    body: body === undefined ? undefined : JSON.stringify(body) }), env, ctx);
  await Promise.all(background.splice(0));
  return response;
}
const cookieOf = response => response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
async function register(name) {
  const email = name + '@example.test', password = 'Clave-local-de-prueba-12345';
  const signup = await call('/api/auth/sign-up/email', 'POST', { name, email, password, callbackURL: env.APP_ORIGIN });
  assert.equal(signup.status, 200, 'registro local aceptado');
  assert.equal((await signup.json()).user.emailVerified, false);
  const beforeVerify = await call('/api/auth/sign-in/email', 'POST', { email, password });
  assert.equal(beforeVerify.status, 403, 'no entra con un correo sin verificar');
  const url = new URL(mails.at(-1).text.match(/https?:\/\/\S+/)[0]);
  const verified = await call(url.pathname + url.search);
  assert.equal(verified.status, 302);
  const signin = await call('/api/auth/sign-in/email', 'POST', { email, password });
  assert.equal(signin.status, 200, 'entra después de verificar');
  return { cookie: cookieOf(signin), email, password };
}
try {
  const configRequest = new Request(env.APP_ORIGIN + '/src/js/push-config.js');
  const publicConfig = async values => {
    const response = await worker.fetch(configRequest, values, ctx);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    const script = await response.text();
    assert.ok(!script.includes(env.BETTER_AUTH_SECRET), 'la configuración pública no expone secretos');
    return JSON.parse(script.slice(script.indexOf('=') + 1, -1));
  };
  assert.equal((await publicConfig({})).enabled, false, 'sin proveedor conectado no se anuncia acceso disponible');
  assert.equal((await publicConfig(env)).email, true);
  const googleConfig = await publicConfig({ BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID: 'cliente', GOOGLE_CLIENT_SECRET: 'secreto-google' });
  assert.equal(googleConfig.enabled, true); assert.equal(googleConfig.google, true); assert.equal(googleConfig.email, false);
  assert.ok(!JSON.stringify(googleConfig).includes('secreto-google'));
  const a = await register('alumna');
  const b = await register('alumno');
  const before = await call('/api/course'); assert.equal(before.status, 401);
  assert.equal((await (await call('/api/course', 'GET', undefined, a.cookie)).json()).state, null);
  const due = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const course = { version: 2, etapa: 'fp_superior', asignaturas: [{ id: 'a', nombre: 'Redes', archivada: false }],
    tareas: [{ id: 't', asignaturaId: 'a', titulo: 'Examen de redes', tipo: 'examen', estado: 'pendiente', fechaEntrega: due }],
    faltas: [{ id: 'f', asignaturaId: 'a', fecha: '2026-11-12', horas: 1 }], config: { onboarding: { oculto: true } }, horario: null };
  let result = await call('/api/course', 'PUT', { revision: null, state: course }, a.cookie);
  assert.equal(result.status, 200); let revision = (await result.json()).revision;
  assert.deepEqual((await (await call('/api/course', 'GET', undefined, a.cookie)).json()).state, course);
  assert.equal((await (await call('/api/course?userId=alumna', 'GET', undefined, b.cookie)).json()).state, null, 'las cuentas quedan aisladas');
  assert.equal((await call('/api/course', 'PUT', { revision, state: course }, a.cookie, 'https://evil.test')).status, 403);
  const parallel = await Promise.all([call('/api/course', 'PUT', { revision, state: { ...course, etapa: 'eso' } }, a.cookie), call('/api/course', 'PUT', { revision, state: { ...course, etapa: 'bachillerato' } }, a.cookie)]);
  assert.deepEqual(parallel.map(r => r.status).sort(), [200, 409], 'un cambio concurrente no sobrescribe el otro');
  revision = (await (await call('/api/course', 'GET', undefined, a.cookie)).json()).revision;
  const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/prueba-local', keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) } };
  const deviceId = crypto.randomUUID();
  result = await call('/api/push', 'POST', { action: 'sync', deviceId, subscription, prefs: { examDays: 3, taskDays: 1, time: '18:00' }, timeZone: 'Europe/Madrid' }, a.cookie);
  assert.equal(result.status, 200); assert.equal((await result.json()).count, 1);
  assert.equal((await call('/api/push', 'POST', { action: 'disable', deviceId }, b.cookie)).status, 403);
  const sent = [];
  await dispatch(env, async (...args) => sent.push(args));
  assert.equal(sent.length, 1, 'el cron envía el aviso que ya corresponde');
  result = await call('/api/course', 'PUT', { revision, state: { ...course, tareas: [{ ...course.tareas[0], titulo: 'Título actualizado' }] } }, a.cookie);
  revision = (await result.json()).revision;
  await dispatch(env, async (...args) => sent.push(args));
  assert.equal(sent.length, 1, 'guardar o editar el título no repite un aviso enviado');
  const extra = { ...course, tareas: [{ ...course.tareas[0], id: 't2' }] };
  result = await call('/api/course', 'PUT', { revision, state: extra }, a.cookie); revision = (await result.json()).revision;
  assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM push_jobs WHERE status='pending'").get().n, 1);
  const beforeFailure = db.sqlite.prepare('SELECT state,revision FROM courses').get(); db.failSQL = 'INSERT INTO push_jobs';
  result = await call('/api/course', 'PUT', { revision, state: { ...extra, tareas: [] } }, a.cookie);
  assert.equal(result.status, 503); assert.deepEqual(db.sqlite.prepare('SELECT state,revision FROM courses').get(), beforeFailure, 'un fallo conserva curso y avisos anteriores');
  result = await call('/api/course', 'PUT', { revision, state: { ...extra, tareas: [] } }, a.cookie); assert.equal(result.status, 200);
  assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM push_jobs WHERE status='pending'").get().n, 0, 'completar o borrar desde otro dispositivo retira los avisos pendientes');
  await call('/api/push', 'POST', { action: 'disable', deviceId }, a.cookie);
  assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM push_devices').get().n, 0);
  result = await call('/api/auth/request-password-reset', 'POST', { email: a.email, redirectTo: env.APP_ORIGIN + '?restablecer=1' });
  assert.equal(result.status, 200);
  const resetURL = new URL(mails.at(-1).text.match(/https?:\/\/\S+/)[0]);
  const token = resetURL.pathname.split('/').at(-1);
  result = await call('/api/auth/reset-password', 'POST', { token, newPassword: 'Nueva-clave-local-12345' });
  assert.equal(result.status, 200);
  assert.equal((await call('/api/course', 'GET', undefined, a.cookie)).status, 401, 'restablecer contraseña retira sesiones anteriores');
  const storedPassword = db.sqlite.prepare("SELECT password FROM account WHERE providerId='credential' LIMIT 1").get().password;
  assert.notEqual(storedPassword, a.password); assert.notEqual(storedPassword, 'Nueva-clave-local-12345');
  const london = inZone('2026-03-30', '18:00', 'Europe/London'); assert.equal(new Date(london).toISOString(), '2026-03-30T17:00:00.000Z');
  const madrid = inZone('2026-10-26', '18:00', 'Europe/Madrid'); assert.equal(new Date(madrid).toISOString(), '2026-10-26T17:00:00.000Z');
  assert.equal(jobsForCourse({ ...course, tareas: [{ ...course.tareas[0], estado: 'completada' }] }, { examDays: 3, taskDays: 1, time: '18:00' }, 'Europe/Madrid').length, 0);
  console.log('OK: registro, verificación, contraseña, aislamiento de cuentas, sincronización concurrente, guardado atómico, planificación y cancelación de avisos en Cloudflare');
} finally { db.sqlite.close(); }
