/* Recordatorios por dispositivo conectados al curso de la cuenta. */
const TaskReminders = (() => {
  const KEY = 'salvatucursoAvisos';
  const DEVICE_KEY = 'salvatucursoPushDispositivos';
  const DEFAULTS = { enabled: false, examDays: 3, taskDays: 1, time: '18:00' };
  let prefs = readPrefs(), busy = false, bound = false, timer = null;
  let syncedSignature = '', message = '', queued = false, retries = 0;

  function normalize(value) {
    const input = value || {};
    const days = n => Number.isInteger(n) && [0, 1, 2, 3, 7].includes(n);
    return {
      enabled: input.enabled === true,
      examDays: days(input.examDays) ? input.examDays : 3,
      taskDays: days(input.taskDays) ? input.taskDays : 1,
      time: /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(input.time || '') ? input.time : '18:00'
    };
  }
  function readPrefs() {
    try { return normalize(JSON.parse(localStorage.getItem(KEY))); }
    catch (error) { return { ...DEFAULTS }; }
  }
  function writePrefs(next) {
    localStorage.setItem(KEY, JSON.stringify(next));
    prefs = next;
  }
  function config() { return window.SalvaTuCursoPushConfig || {}; }
  function configured() {
    const c = config();
    return c.enabled === true && c.apiBase === '/api' && /^[A-Za-z0-9_-]{87}$/.test(c.vapidPublicKey || '');
  }
  function isIOSBrowser() {
    return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function needsInstall() {
    return isIOSBrowser() && !(navigator.standalone || window.matchMedia('(display-mode: standalone)').matches);
  }
  function supported() {
    return window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }
  function localDateTime(iso, time) {
    const date = calendarDate(iso);
    const [hour, minute] = time.split(':').map(Number);
    date.setHours(hour, minute, 0, 0);
    return date;
  }
  function buildJobs(academic, settings = prefs, now = new Date()) {
    const today = calendarISO(now);
    const jobs = [];
    for (const task of academic.tareas || []) {
      if (task.estado !== 'pendiente' || task.tipo === 'nota' || !validCalendarDate(task.fechaEntrega) || task.fechaEntrega < today) continue;
      const subject = (academic.asignaturas || []).find(a => a.id === task.asignaturaId);
      if (!subject || subject.archivada) continue;
      const days = task.tipo === 'examen' ? settings.examDays : settings.taskDays;
      const start = calendarAddDays(task.fechaEntrega, -days);
      if (!validCalendarDate(start)) continue;
      const expiry = localDateTime(task.fechaEntrega, '23:59');
      expiry.setSeconds(59, 999);
      jobs.push({
        key: task.id + '|' + task.fechaEntrega,
        taskId: String(task.id), date: task.fechaEntrega,
        title: String(task.titulo).slice(0, 160), subject: String(subject.nombre).slice(0, 100),
        kind: task.tipo === 'examen' ? 'examen' : 'tarea',
        runAt: localDateTime(start, settings.time).toISOString(), expiresAt: expiry.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
    }
    return jobs.sort((a, b) => a.key.localeCompare(b.key));
  }
  function renderSettings() {
    const status = $('#push-status');
    if (!status) return;
    const active = prefs.enabled;
    [['#push-exam-days', String(prefs.examDays)], ['#push-task-days', String(prefs.taskDays)], ['#push-time', prefs.time]].forEach(([selector, value]) => {
      const field = $(selector);
      if (!field.dataset.dirty) field.value = value;
    });
    $('#push-enable').hidden = active;
    $('#push-enable').textContent = 'Activar notificaciones';
    $('#push-disable').hidden = !active;
    $('#push-test').hidden = !active;
    $('#push-enable').disabled = busy || !configured() || !supported() || needsInstall() || !CourseAccount.ready();
    $('#push-disable').disabled = busy;
    $('#push-test').disabled = busy || !configured() || !supported() || needsInstall();
    $('#push-save').disabled = busy;
    status.textContent = message || (!configured()
      ? 'El servicio de notificaciones aún no está conectado. Puedes dejar preparada tu preferencia.'
      : needsInstall() ? 'En iPhone o iPad, añade SalvaTuCurso a la pantalla de inicio y ábrela desde su icono para activar los avisos.'
      : !supported() ? 'Este navegador no admite estas notificaciones. Prueba desde un navegador compatible.'
      : Notification.permission === 'denied' ? 'Las notificaciones están bloqueadas. Permítelas en los ajustes del navegador y vuelve a activarlas aquí.'
      : !CourseAccount.user() ? 'Inicia sesión y sincroniza tu curso antes de activar los avisos.'
      : !CourseAccount.ready() ? 'Revisa la sincronización de tu curso antes de activar los avisos.'
      : active ? 'Notificaciones activadas en este dispositivo.' : 'Activa los avisos para recibirlos aunque cierres la app.');
    $('#push-state').textContent = active ? 'Activadas' : 'Desactivadas';
  }
  function setMessage(text) { message = text; renderSettings(); }
  function deviceId() {
    const owner = CourseAccount.user()?.id;
    if (!owner) throw new Error('Inicia sesión antes de activar los avisos.');
    const devices = JSON.parse(localStorage.getItem(DEVICE_KEY) || '{}');
    if (!devices[owner]) { devices[owner] = crypto.randomUUID(); localStorage.setItem(DEVICE_KEY, JSON.stringify(devices)); }
    return devices[owner];
  }
  async function api(action, body = {}) {
    return CourseAccount.api('push', { action, deviceId: deviceId(), ...body,
      prefs: { examDays: prefs.examDays, taskDays: prefs.taskDays, time: prefs.time },
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
  }
  async function registration() {
    const ready = navigator.serviceWorker.ready;
    let timeout;
    try {
      return await Promise.race([ready, new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('La app todavía se está preparando. Recarga y vuelve a intentarlo.')), 10000);
      })]);
    } finally { clearTimeout(timeout); }
  }
  function publicKey() {
    const base64 = config().vapidPublicKey.replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(base64 + '='.repeat((4 - base64.length % 4) % 4)), ch => ch.charCodeAt(0));
  }
  async function enable() {
    if (busy || !configured() || !supported() || needsInstall() || !CourseAccount.ready()) return;
    // El permiso se solicita directamente desde la pulsación, requisito de iOS.
    const permissionRequest = Notification.requestPermission();
    busy = true; setMessage('Activando las notificaciones…');
    let subscription, created = false;
    try {
      if (await permissionRequest !== 'granted') throw new Error('No se han activado. Puedes permitir las notificaciones en los ajustes del navegador.');
      // Comprobar que la preferencia y la sesión podrán persistir antes de suscribir.
      localStorage.setItem(KEY, JSON.stringify(prefs));
      const reg = await registration();
      subscription = await reg.pushManager.getSubscription();
      if (!subscription) { subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey() }); created = true; }
      const jobs = buildJobs(state);
      await api('sync', { subscription: subscription.toJSON() });
      writePrefs({ ...prefs, enabled: true });
      syncedSignature = JSON.stringify(jobs);
      setMessage('Notificaciones activadas. Los cambios de tareas se enviarán cuando tengas conexión.');
    } catch (error) {
      if ((created || !prefs.enabled) && subscription) await subscription.unsubscribe().catch(() => {});
      setMessage(error.message || 'No se han podido activar las notificaciones.');
    } finally { busy = false; renderSettings(); if (queued) queueSync(); }
  }
  async function sync() {
    if (!prefs.enabled || !configured() || !supported() || needsInstall() || busy) return;
    busy = true; queued = false;
    let failed = false;
    try {
      // Leer el estado realmente guardado: otra pestaña puede haber cambiado el curso.
      const raw = localStorage.getItem(STORAGE_KEY);
      const academic = raw ? normalizeState(JSON.parse(raw)) : state;
      const jobs = buildJobs(academic);
      const signature = JSON.stringify(jobs);
      if (signature === syncedSignature) return;
      if (Notification.permission !== 'granted') throw new Error('Los avisos están bloqueados por el navegador. Desactívalos aquí o revisa el permiso.');
      const reg = await registration(), sub = await reg.pushManager.getSubscription();
      if (!sub) throw new Error('Este dispositivo ha perdido la suscripción. Desactiva los avisos y vuelve a activarlos.');
      await CourseAccount.sync();
      if (!CourseAccount.ready()) throw new Error('Revisa la sincronización antes de actualizar los avisos.');
      await api('sync', { subscription: sub.toJSON() });
      syncedSignature = signature;
      message = 'Avisos actualizados en este dispositivo.';
    } catch (error) { failed = true; message = error.message + ' Los cambios quedan pendientes de conexión.'; }
    finally {
      busy = false; renderSettings();
      if (queued) queueSync();
      else if (failed && prefs.enabled && retries < 5) { retries++; timer = setTimeout(sync, 30000 * retries); }
      else if (!failed) retries = 0;
    }
  }
  function queueSync() {
    clearTimeout(timer);
    queued = true;
    if (prefs.enabled) timer = setTimeout(sync, 1200);
  }
  async function disable() {
    if (busy) return;
    busy = true; setMessage('Desactivando los avisos…');
    try {
      if (configured()) await api('disable');
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg && await reg.pushManager?.getSubscription();
        if (sub) await sub.unsubscribe();
      }
      writePrefs({ ...prefs, enabled: false });
      clearTimeout(timer); queued = false;
      syncedSignature = ''; message = 'Notificaciones desactivadas. Se han retirado los avisos pendientes de este dispositivo.';
      return true;
    } catch (error) { message = 'No se han podido desactivar. Conéctate a internet y vuelve a intentarlo.'; return false; }
    finally { busy = false; renderSettings(); if (queued) queueSync(); }
  }
  function saveSettings() {
    try {
      const next = normalize({ ...prefs, examDays: Number($('#push-exam-days').value), taskDays: Number($('#push-task-days').value), time: $('#push-time').value });
      if (!$('#push-time').value) { $('#push-time').reportValidity(); return; }
      writePrefs(next); syncedSignature = ''; queueSync();
      ['#push-exam-days', '#push-task-days', '#push-time'].forEach(selector => { delete $(selector).dataset.dirty; });
      setMessage(prefs.enabled ? 'Preferencia guardada. Actualizando los avisos…' : 'Preferencia guardada en este dispositivo.');
    } catch (error) { setMessage('No se ha podido guardar la preferencia. Comprueba que el navegador permite guardar datos.'); }
  }
  async function test() {
    if (busy || !prefs.enabled) return;
    busy = true; setMessage('Enviando una notificación de prueba…');
    try { await api('test'); message = 'Prueba enviada. Comprueba las notificaciones del dispositivo.'; }
    catch (error) { message = error.message; }
    finally { busy = false; renderSettings(); }
  }
  async function openTaskFromNotification(id) {
    if (id && typeof CourseAccount !== 'undefined') { await CourseAccount.started(); await CourseAccount.sync(); }
    if (id && !CourseAccount.ready()) { showView('config'); toast('Revisa tu cuenta y la sincronización para abrir la actividad.'); return; }
    showView('tareas');
    if (!id) return;
    const task = state.tareas.find(t => t.id === id);
    if (task) openTaskEditDialog(task.id);
    else toast('Esta actividad ya no está en este navegador.');
  }
  function bind() {
    if (bound) return;
    bound = true;
    $('#push-enable').addEventListener('click', enable);
    $('#push-disable').addEventListener('click', disable);
    $('#push-save').addEventListener('click', saveSettings);
    $('#push-test').addEventListener('click', test);
    ['#push-exam-days', '#push-task-days', '#push-time'].forEach(selector => {
      $(selector).addEventListener('input', () => { $(selector).dataset.dirty = 'true'; });
    });
    window.addEventListener('online', () => { syncedSignature = ''; queueSync(); });
    window.addEventListener('storage', event => {
      if (event.key === KEY || event.key === null) { prefs = readPrefs(); message = ''; renderSettings(); }
      if (event.key === KEY || event.key === STORAGE_KEY || event.key === null) { syncedSignature = ''; queueSync(); }
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { syncedSignature = ''; queueSync(); } });
    if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'open-reminder' && typeof event.data.taskId === 'string') openTaskFromNotification(event.data.taskId);
    });
    const params = new URLSearchParams(location.search);
    if (params.has('actividad')) {
      openTaskFromNotification(params.get('actividad'));
      params.delete('actividad');
      history.replaceState(null, '', location.pathname + (params.size ? '?' + params.toString() : '') + location.hash);
    }
    queueSync(); renderSettings();
  }
  return { normalize, buildJobs, renderSettings, bind, queueSync, disableForLogout: () => prefs.enabled ? disable() : Promise.resolve(true) };
})();
