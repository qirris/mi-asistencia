/* Acceso y sincronización: cookies de sesión; nunca se guardan contraseñas en el navegador. */
const CourseAccount = (() => {
  const META = 'salvatucursoCuenta', GUEST = 'salvatucursoInvitado';
  let user = null, meta = null, remote = null, suppress = false, busy = false, pending = false;
  let status = '', timer = null, pollTimer = null, request = null, formMode = 'login', resetToken = '', draft = false, bound = false, initialization = null, authenticated = false;
  try { meta = JSON.parse(localStorage.getItem(META)); user = meta?.user || null; } catch (error) { /* Sin cuenta local. */ }
  const config = () => window.SalvaTuCursoPushConfig || {};
  const configured = () => config().enabled === true && config().apiBase === '/api';
  const hasData = course => !!(course && ['asignaturas', 'faltas', 'tareas'].some(key => course[key]?.length));
  const counts = course => course ? [[course.asignaturas.length, 'asignatura', 'asignaturas'], [course.tareas.length, 'actividad', 'actividades'], [course.faltas.length, 'falta', 'faltas']].map(([n, singular, plural]) => n + ' ' + (n === 1 ? singular : plural)).join(' · ') : 'Sin datos guardados';
  function persist() {
    localStorage.setItem(META, JSON.stringify(meta));
    if (meta?.user?.id) {
      localStorage.setItem(META + '_' + meta.user.id, JSON.stringify(meta));
      localStorage.setItem('salvatucursoCursoCuenta_' + meta.user.id, JSON.stringify(state));
    }
  }
  function backup() {
    const prefix = 'salvatucursoCopiaSync_' + user.id + '_';
    localStorage.setItem(prefix + Date.now(), JSON.stringify(state));
    const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter(key => key?.startsWith(prefix)).sort().reverse();
    keys.slice(5).forEach(key => localStorage.removeItem(key));
  }
  function renderSettings() {
    if (!$('#account-status')) return;
    $('#account-person').textContent = user ? user.email : 'Comparte tu curso entre el móvil y el ordenador.';
    $('#account-status').textContent = status || (!configured() ? 'El acceso y la sincronización en Cloudflare aún no están conectados.' : user ? 'Cuenta conectada.' : 'Inicia sesión para guardar una copia de tu curso en Cloudflare.');
    $('#account-login').hidden = !!user && authenticated; $('#account-logout').hidden = !user; $('#account-sync').hidden = !user;
    $('#account-login').disabled = busy || !configured() || (!config().google && !config().email);
    $('#account-logout').disabled = busy; $('#account-sync').disabled = busy;
    $('#account-sync').textContent = pending ? 'Revisar sincronización' : 'Sincronizar ahora';
  }
  async function api(path, body, method = 'POST') {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('/api/' + path, { method, credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) { const error = new Error(response.status === 429 ? 'Espera un minuto y vuelve a intentarlo.' : response.status === 401 ? 'Vuelve a iniciar sesión para sincronizar.' : 'No se ha podido completar. Revisa los datos y tu conexión.'); error.status = response.status; error.code = data.code; throw error; }
      return data;
    } finally { clearTimeout(timeout); }
  }
  function applyRemote(data) {
    const previous = state, previousMeta = meta;
    if (!isStoredStateCurrent()) throw new Error('Los datos cambiaron en otra pestaña. Recarga antes de sincronizar.');
    backup();
    try {
      suppress = true; state = normalizeState(data.state); saveState();
      meta = { user, revision: data.revision, base: JSON.stringify(state), dirty: false }; persist();
    } catch (error) {
      state = previous; meta = previousMeta;
      try { saveState(); if (meta) persist(); } catch (restoreError) { /* Se conserva la copia previa. */ }
      throw new Error('No se ha podido guardar en este navegador. Se conserva una copia anterior.');
    } finally { suppress = false; }
    pending = false; remote = null; draft = false; UndoManager.clear(); render();
    if (typeof TaskReminders !== 'undefined') TaskReminders.queueSync();
  }
  function review(data) {
    remote = data; pending = true;
    $('#sync-local-summary').textContent = counts(state);
    $('#sync-cloud-summary').textContent = counts(data.state);
    $('#sync-use-cloud').disabled = !data.state;
    $('#sync-review-status').textContent = 'Se guardará una copia local antes de sustituir datos. Las dos versiones no se mezclan automáticamente.';
    const dialog = $('#dialog-sync');
    if (!dialog.open && !document.querySelector('dialog[open]')) dialog.showModal();
    status = 'Hay datos que revisar antes de sincronizar.'; renderSettings();
  }
  async function upload(revision) {
    const snapshot = JSON.stringify(state);
    const result = await api('course', { revision, state: JSON.parse(snapshot) }, 'PUT');
    meta = { user, revision: result.revision, base: snapshot, dirty: JSON.stringify(state) !== snapshot }; persist();
    pending = false; remote = null;
    status = meta.dirty ? 'Hay cambios locales pendientes de subir.' : 'Curso sincronizado.';
    if (meta.dirty) queueSync();
    if (typeof TaskReminders !== 'undefined') TaskReminders.queueSync();
  }
  async function synchronize() {
    if (!configured() || !user || pending) return;
    if (request) return request;
    request = (async () => {
      try {
        const data = await api('course', undefined, 'GET');
        if (!meta || meta.user?.id !== user.id) {
          if (hasData(state)) { review(data); return; }
          if (data.state) applyRemote(data); else await upload(null);
        } else if (data.revision !== meta.revision) {
          if (meta.dirty || JSON.stringify(state) !== meta.base || draft || document.querySelector('dialog[open]')) review(data);
          else if (data.state) applyRemote(data);
          else review(data);
        } else if (meta.dirty || JSON.stringify(state) !== meta.base) await upload(data.revision);
        status = pending ? 'Revisa las versiones del curso.' : 'Curso sincronizado.';
      } catch (error) {
        if (error.status === 409) { const latest = await api('course', undefined, 'GET'); review(latest); }
        else { if (error.status === 401) authenticated = false; status = error.message + ' Tus cambios siguen guardados en este navegador.'; }
      } finally { renderSettings(); }
    })();
    try { await request; } finally { request = null; }
  }
  function queueSync() {
    if (suppress || !user || !configured()) return;
    draft = false;
    if (meta?.user?.id === user.id) { meta.dirty = true; try { persist(); } catch (error) { status = 'Los cambios están guardados, pero no se pudo actualizar la preferencia de sincronización.'; } }
    clearTimeout(timer); timer = setTimeout(synchronize, 1500);
  }
  function poll() {
    clearTimeout(pollTimer);
    if (document.hidden || !configured()) return;
    if (authenticated) synchronize();
    pollTimer = setTimeout(poll, 30000);
  }
  function openAuth(mode = 'login') {
    formMode = mode;
    const registering = mode === 'register', recovering = mode === 'forgot', resetting = mode === 'reset';
    $('#account-dialog-title').textContent = registering ? 'Crea tu cuenta' : recovering ? 'Recupera tu acceso' : resetting ? 'Elige una contraseña nueva' : 'Entra en SalvaTuCurso';
    $('#auth-name-field').hidden = !registering; $('#auth-name').required = registering;
    $('#auth-email-field').hidden = resetting; $('#auth-email').required = !resetting;
    $('#auth-password-field').hidden = recovering; $('#auth-password').required = !recovering;
    $('#auth-password').minLength = mode === 'login' ? 1 : 12;
    $('#auth-password').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    $('#auth-password-help').hidden = mode === 'login' || recovering;
    $('#auth-password').value = '';
    $('#auth-google').hidden = recovering || resetting; $('#auth-google').disabled = !config().google;
    $('#auth-options').hidden = recovering || resetting;
    $('#auth-submit').textContent = registering ? 'Crear cuenta' : recovering ? 'Enviar enlace' : resetting ? 'Guardar contraseña' : 'Entrar';
    $('#auth-submit').disabled = !config().email;
    $('#auth-status').textContent = config().email ? '' : 'El acceso con correo todavía no está conectado.';
    $('#auth-mode-register').hidden = registering; $('#auth-mode-login').hidden = !registering;
    const dialog = $('#dialog-account'); if (!dialog.open) dialog.showModal();
    (resetting ? $('#auth-password') : registering ? $('#auth-name') : $('#auth-email')).focus();
  }
  async function refreshSession() {
    try {
      const data = await api('auth/get-session', undefined, 'GET');
      if (data?.user) {
        authenticated = true;
        if (!user) localStorage.setItem(GUEST, JSON.stringify(state));
        user = data.user;
        if (meta?.user?.id !== user.id) {
          const cachedMeta = JSON.parse(localStorage.getItem(META + '_' + user.id) || 'null');
          const cachedCourse = JSON.parse(localStorage.getItem('salvatucursoCursoCuenta_' + user.id) || 'null');
          if (cachedMeta?.user?.id === user.id && cachedCourse) {
            suppress = true; state = normalizeState(cachedCourse); saveState(); suppress = false;
            meta = cachedMeta; persist(); render();
          }
        }
        await synchronize();
      } else if (user) {
        authenticated = false;
        status = 'Tu sesión ha caducado. Inicia sesión para continuar. Los cambios locales se conservan.';
      }
    } catch (error) { status = 'Sin conexión con tu cuenta. Puedes seguir usando los datos de este navegador.'; }
    renderSettings();
  }
  async function submitAuth(event) {
    event.preventDefault(); if (busy) return;
    busy = true; $('#auth-submit').disabled = true; $('#auth-status').textContent = 'Conectando…';
    try {
      const email = $('#auth-email').value.trim(), password = $('#auth-password').value, callbackURL = location.origin + location.pathname;
      if (formMode === 'forgot') {
        await api('auth/request-password-reset', { email, redirectTo: callbackURL + '?restablecer=1' });
        $('#auth-status').textContent = 'Si el correo tiene una cuenta, recibirás un enlace para recuperar el acceso.';
      } else if (formMode === 'reset') {
        await api('auth/reset-password', { token: resetToken, newPassword: password }); resetToken = '';
        openAuth('login'); $('#auth-status').textContent = 'Contraseña actualizada. Ya puedes entrar.';
      } else if (formMode === 'register') {
        await api('auth/sign-up/email', { email, password, name: $('#auth-name').value.trim(), callbackURL });
        $('#auth-status').textContent = 'Revisa tu correo para confirmar la cuenta antes de entrar.';
      } else {
        await api('auth/sign-in/email', { email, password, callbackURL });
        $('#dialog-account').close(); await refreshSession();
      }
    } catch (error) { $('#auth-status').textContent = error.status === 403 ? 'Confirma tu correo antes de entrar. Revisa también la carpeta de correo no deseado.' : error.status === 401 && formMode === 'login' ? 'El correo o la contraseña no son correctos.' : error.message; }
    finally { $('#auth-password').value = ''; busy = false; $('#auth-submit').disabled = !config().email; renderSettings(); }
  }
  async function google() {
    if (busy || !config().google) return;
    busy = true; $('#auth-status').textContent = 'Abriendo Google…';
    try {
      const data = await api('auth/sign-in/social', { provider: 'google', callbackURL: location.origin + location.pathname });
      const target = new URL(data.url);
      if (target.protocol !== 'https:' || target.hostname !== 'accounts.google.com') throw new Error('No se ha podido abrir Google.');
      location.assign(target.href);
    } catch (error) { $('#auth-status').textContent = error.message; }
    finally { busy = false; }
  }
  async function logout() {
    if (busy) return;
    busy = true;
    try {
      if (typeof TaskReminders !== 'undefined' && !await TaskReminders.disableForLogout()) throw new Error('Conéctate para desactivar los avisos antes de salir.');
      if (meta?.dirty || pending) { exportJSON(); throw new Error('Se ha descargado una copia de tus cambios. Sincroniza o revisa las versiones antes de salir.'); }
      await api('auth/sign-out', {});
      localStorage.setItem('salvatucursoCursoCuenta_' + user.id, JSON.stringify(state));
      const guest = JSON.parse(localStorage.getItem(GUEST) || 'null');
      user = null; meta = null; authenticated = false; localStorage.removeItem(META); suppress = true;
      state = normalizeState(guest || JSON.parse(JSON.stringify(DEFAULT_STATE))); saveState(); suppress = false;
      UndoManager.clear(); status = 'Has salido de tu cuenta. Se muestran los datos locales de invitado.'; render();
    } catch (error) { status = error.message; }
    finally { suppress = false; busy = false; renderSettings(); }
  }
  async function chooseVersion(useCloud) {
    if (busy || !remote) return;
    busy = true; $('#sync-use-local').disabled = true; $('#sync-use-cloud').disabled = true;
    try {
      backup();
      if (useCloud) {
        const latest = await api('course', undefined, 'GET');
        if (latest.revision !== remote.revision) { review(latest); throw new Error('La cuenta volvió a cambiar. Revisa otra vez el resumen.'); }
        applyRemote(remote);
      } else await upload(remote.revision);
      $('#dialog-sync').close();
    } catch (error) {
      if (error.status === 409) review(await api('course', undefined, 'GET'));
      $('#sync-review-status').textContent = error.message;
    } finally { busy = false; $('#sync-use-local').disabled = false; $('#sync-use-cloud').disabled = !remote?.state; renderSettings(); }
  }
  function bind() {
    if (bound) return; bound = true;
    $('#account-login').addEventListener('click', () => openAuth());
    $('#account-logout').addEventListener('click', logout);
    $('#account-sync').addEventListener('click', () => pending && remote ? review(remote) : synchronize());
    $('#auth-form').addEventListener('submit', submitAuth);
    $('#auth-google').addEventListener('click', google);
    $('#auth-mode-register').addEventListener('click', () => openAuth('register'));
    $('#auth-mode-login').addEventListener('click', () => openAuth('login'));
    $('#auth-forgot').addEventListener('click', () => openAuth('forgot'));
    ['#auth-close', '#auth-cancel'].forEach(selector => $(selector).addEventListener('click', () => $('#dialog-account').close()));
    $('#dialog-account').addEventListener('close', () => { $('#auth-password').value = ''; });
    ['#sync-close', '#sync-cancel'].forEach(selector => $(selector).addEventListener('click', () => $('#dialog-sync').close()));
    $('#sync-use-local').addEventListener('click', () => chooseVersion(false));
    $('#sync-use-cloud').addEventListener('click', () => chooseVersion(true));
    $('#account-export').addEventListener('click', exportJSON);
    $('#account-import').addEventListener('click', () => $('#import-file').click());
    $('#import-file').addEventListener('change', event => { if (event.target.files[0]) importJSON(event.target.files[0]); event.target.value = ''; });
    document.addEventListener('input', event => { if (event.target.closest('main,dialog') && !event.target.closest('#dialog-account,#dialog-sync')) draft = true; });
    window.addEventListener('online', () => { if (configured()) refreshSession(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && configured()) refreshSession(); poll(); });
    const params = new URLSearchParams(location.search);
    if (params.get('restablecer') === '1' && params.has('token')) {
      resetToken = params.get('token'); params.delete('token'); params.delete('restablecer');
      history.replaceState(null, '', location.pathname + (params.size ? '?' + params.toString() : '')); openAuth('reset');
    }
    renderSettings(); if (configured()) { initialization = refreshSession(); poll(); }
  }
  return { bind, renderSettings, queueSync, sync: synchronize, api, user: () => user,
    started: () => initialization || Promise.resolve(),
    ready: () => authenticated && !!user && !!meta && meta.user?.id === user.id && !pending && !meta.dirty };
})();
