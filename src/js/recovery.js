/* Recuperación breve de tareas y faltas; separada de los datos académicos. */
var UndoManager = (function recoveryController() {
  const KEY = 'salvatucursoDeshacer';
  const WINDOW_MS = 10000;
  let batch = null, timer = null, bound = false;
  const pauses = new Set();
  const clone = value => JSON.parse(JSON.stringify(value));
  function read() { return JSON.parse(localStorage.getItem(KEY) || 'null'); }
  function stopTimer() { if (timer !== null) clearTimeout(timer); timer = null; }
  function clear(removePersisted = true) {
    stopTimer();
    if (removePersisted) { try { localStorage.removeItem(KEY); } catch (error) {} }
    batch = null;
    pauses.clear();
    const notice = $('#undo-notice');
    if (notice) notice.hidden = true;
    if (document.body.classList) document.body.classList.remove('has-undo');
  }
  function expire() {
    if (!batch || pauses.size) return;
    if (Date.now() < batch.expiresAt) { arm(); return; }
    let own = false;
    try { own = read()?.token === batch.token; } catch (error) {}
    clear(own);
  }
  function arm() {
    stopTimer();
    if (!batch || pauses.size) return;
    const delay = batch.expiresAt - Date.now();
    if (delay <= 0) { expire(); return; }
    timer = setTimeout(expire, delay);
  }
  function show() {
    if (!batch) return;
    const count = batch.entries.length;
    const entry = batch.entries[0];
    $('#undo-message').textContent = count > 1 ? count + ' registros eliminados.' :
      entry.collection === 'faltas' ? 'Falta eliminada.' : entry.item.tipo === 'nota' ? 'Nota eliminada.' : 'Tarea eliminada.';
    $('#undo-notice').hidden = false;
    if (document.body.classList) document.body.classList.add('has-undo');
    arm();
  }
  function pause(reason) { if (!batch) return; pauses.add(reason); stopTimer(); }
  function resume(reason) {
    pauses.delete(reason);
    if (!batch || pauses.size) return;
    batch.expiresAt = Date.now() + WINDOW_MS;
    try { if (read()?.token === batch.token) localStorage.setItem(KEY, JSON.stringify(batch)); } catch (error) {}
    arm();
  }
  function validEntry(entry) {
    return entry && ['tareas', 'faltas'].includes(entry.collection) && entry.item &&
      typeof entry.item.id === 'string' && entry.item.id.length > 0 &&
      typeof entry.item.asignaturaId === 'string' && Number.isInteger(entry.index) && entry.index >= 0;
  }
  function remove(collection, id, originDialog = null) {
    if (!['tareas', 'faltas'].includes(collection)) return false;
    const index = state[collection].findIndex(item => item.id === id);
    if (index < 0) return false;
    if (batch && !pauses.size && Date.now() >= batch.expiresAt) expire();
    const previous = state[collection];
    const next = {
      token: batch ? batch.token : uid(),
      expiresAt: Date.now() + WINDOW_MS,
      entries: (batch ? batch.entries : []).concat({ collection, index, item: clone(previous[index]) })
    };
    let previousRaw;
    try {
      previousRaw = localStorage.getItem(KEY);
      localStorage.setItem(KEY, JSON.stringify(next));
      state[collection] = previous.filter((item, i) => i !== index);
      saveState();
    } catch (error) {
      state[collection] = previous;
      try {
        if (previousRaw === null) localStorage.removeItem(KEY);
        else if (typeof previousRaw === 'string') localStorage.setItem(KEY, previousRaw);
      } catch (rollbackError) {}
      toast('No se ha podido guardar el cambio. El registro no se ha eliminado.');
      return false;
    }
    batch = next;
    if (originDialog && originDialog.open) originDialog.close();
    render();
    show();
    return true;
  }
  function restoredItem(entry) {
    const item = clone(entry.item);
    if (entry.collection === 'tareas' && item.slotKey) {
      const [day, fid] = item.slotKey.split('|');
      const slot = state.horario.franjas.find(f => f.id === fid);
      const cell = getCasilla(state.horario, day, fid);
      if (!slot || slot.tipo !== 'clase' || !franjaActivaEnDia(state.horario, slot, day) || !cell || cell.recreo || cell.asignaturaId !== item.asignaturaId) {
        item.slotKey = item.dia = item.horaInicio = item.horaFin = '';
      } else {
        item.dia = day; item.horaInicio = slot.inicio; item.horaFin = slot.fin;
      }
    }
    return item;
  }
  function restore() {
    if (!batch) return false;
    if (!pauses.size && Date.now() >= batch.expiresAt) { expire(); return false; }
    try {
      if (read()?.token !== batch.token) { clear(false); return false; }
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved !== JSON.stringify(state)) {
        clear(false);
        toast('Los datos han cambiado en otra pestaña. Recarga antes de deshacer.');
        return false;
      }
    } catch (error) { toast('No se han podido guardar los cambios. Inténtalo de nuevo.'); return false; }
    const before = { tareas: state.tareas, faltas: state.faltas };
    const next = { tareas: state.tareas.slice(), faltas: state.faltas.slice() };
    let count = 0;
    batch.entries.slice().reverse().forEach(entry => {
      if (next[entry.collection].some(item => item.id === entry.item.id)) return;
      if (!state.asignaturas.some(a => a.id === entry.item.asignaturaId)) return;
      next[entry.collection].splice(Math.min(entry.index, next[entry.collection].length), 0, restoredItem(entry));
      count++;
    });
    state.tareas = next.tareas; state.faltas = next.faltas;
    try { saveState(); } catch (error) {
      state.tareas = before.tareas; state.faltas = before.faltas;
      toast('No se ha podido guardar la recuperación. Inténtalo de nuevo.');
      return false;
    }
    clear();
    render();
    toast(count === 1 ? 'Registro restaurado' : count ? 'Registros restaurados' : 'No hay registros que se puedan restaurar.');
    return count > 0;
  }
  function bind() {
    if (bound) return;
    bound = true;
    const notice = $('#undo-notice');
    $('#btn-undo-delete').addEventListener('click', restore);
    notice.addEventListener('mouseenter', () => pause('pointer'));
    notice.addEventListener('mouseleave', () => resume('pointer'));
    notice.addEventListener('focusin', () => pause('focus'));
    notice.addEventListener('focusout', event => { if (!notice.contains(event.relatedTarget)) resume('focus'); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pause('hidden'); else resume('hidden');
    });
    window.addEventListener('storage', event => {
      if (event.key === KEY || event.key === STORAGE_KEY || event.key === null) clear(false);
    });
    try {
      const saved = read();
      if (!saved || typeof saved.token !== 'string' || !Number.isFinite(saved.expiresAt) || saved.expiresAt <= Date.now() || !Array.isArray(saved.entries)) {
        clear(); return;
      }
      saved.entries = saved.entries.filter(entry => validEntry(entry) &&
        !state[entry.collection].some(item => item.id === entry.item.id) &&
        state.asignaturas.some(a => a.id === entry.item.asignaturaId));
      if (!saved.entries.length) { clear(); return; }
      batch = saved;
      if (document.hidden) pauses.add('hidden');
      show();
    } catch (error) { clear(); }
  }
  return { remove, restore, clear, bind };
})();
