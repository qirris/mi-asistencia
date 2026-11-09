/* ============================================================
   Mi Asistencia — schedule.js
   Horario escolar semanal: configuración de franjas, cuadrícula
   interactiva, vista móvil por días y resumen real de horas.
   ============================================================ */

const DIAS = [
  { key: 'lunes', label: 'Lunes', short: 'Lun' },
  { key: 'martes', label: 'Martes', short: 'Mar' },
  { key: 'miercoles', label: 'Miércoles', short: 'Mié' },
  { key: 'jueves', label: 'Jueves', short: 'Jue' },
  { key: 'viernes', label: 'Viernes', short: 'Vie' },
  { key: 'sabado', label: 'Sábado', short: 'Sáb' },
  { key: 'domingo', label: 'Domingo', short: 'Dom' }
];

const DIAS_LECTIVOS_DEFAULT = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

const PALETA = ['azul', 'verde', 'morado', 'naranja', 'rosa', 'turquesa', 'amarillo', 'gris'];

const PALETA_LABEL = {
  azul: 'Azul claro',
  verde: 'Verde suave',
  morado: 'Morado',
  naranja: 'Naranja',
  rosa: 'Rosa',
  turquesa: 'Turquesa',
  amarillo: 'Amarillo',
  gris: 'Gris'
};

const HORARIO_DEFAULT = {
  entrada: '08:15',
  salida: '14:00',
  duracionClase: 60,
  duracionRecreo: 30,
  recreoTras: 3,
  numRecreos: 1,
  dias: DIAS_LECTIVOS_DEFAULT.slice(),
  diasSalida: {},
  franjas: [],
  casillas: {}
};

let scheduleMobileDay = null;
let editingFranjaId = null;
let editingCellKey = null;

/* ---------- Utilidades de tiempo y color ---------- */
function horaValida(s) {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

function toMin(hhmm) {
  const parts = String(hhmm || '').split(':');
  const h = Number(parts[0]) || 0;
  const m = Number(parts[1]) || 0;
  return h * 60 + m;
}

function toHHMM(min) {
  const total = Math.max(0, Math.round(Number(min) || 0));
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function colorValido(c, i) {
  if (PALETA.indexOf(c) !== -1) return c;
  return PALETA[(Number(i) || 0) % PALETA.length];
}

function minutosFranja(f) {
  return Math.max(0, toMin(f.fin) - toMin(f.inicio));
}

function fmtHoras(min) {
  return fmt((Number(min) || 0) / 60) + ' h';
}

function diaLabel(key) {
  const d = DIAS.find(x => x.key === key);
  return d ? d.label : key;
}

function diaShort(key) {
  const d = DIAS.find(x => x.key === key);
  return d ? d.short : key;
}

/* ---------- Normalización del horario ---------- */
function normalizeHorario(input) {
  const h = Object.assign({}, HORARIO_DEFAULT, input || {});

  h.entrada = horaValida(h.entrada) ? h.entrada : HORARIO_DEFAULT.entrada;
  h.salida = horaValida(h.salida) ? h.salida : HORARIO_DEFAULT.salida;
  if (toMin(h.salida) <= toMin(h.entrada)) {
    h.salida = toHHMM(toMin(h.entrada) + 60);
  }

  h.duracionClase = clampInt(h.duracionClase, 20, 180, HORARIO_DEFAULT.duracionClase);
  h.duracionRecreo = clampInt(h.duracionRecreo, 0, 120, HORARIO_DEFAULT.duracionRecreo);
  h.recreoTras = clampInt(h.recreoTras, 1, 12, HORARIO_DEFAULT.recreoTras);
  h.numRecreos = clampInt(h.numRecreos, 0, 6, HORARIO_DEFAULT.numRecreos);

  h.dias = Array.isArray(h.dias)
    ? h.dias.filter(k => DIAS.some(d => d.key === k))
    : [];
  h.dias = Array.from(new Set(h.dias));
  if (!h.dias.length) h.dias = DIAS_LECTIVOS_DEFAULT.slice();
  h.dias.sort((a, b) => DIAS.findIndex(d => d.key === a) - DIAS.findIndex(d => d.key === b));

  h.diasSalida = (h.diasSalida && typeof h.diasSalida === 'object') ? h.diasSalida : {};
  const salidas = {};
  h.dias.forEach(k => {
    if (horaValida(h.diasSalida[k]) && toMin(h.diasSalida[k]) > toMin(h.entrada)) {
      salidas[k] = h.diasSalida[k];
    }
  });
  h.diasSalida = salidas;

  h.franjas = Array.isArray(h.franjas) ? h.franjas.filter(f => f && f.id).map(f => {
    const inicio = horaValida(f.inicio) ? f.inicio : h.entrada;
    let fin = horaValida(f.fin) ? f.fin : toHHMM(toMin(inicio) + h.duracionClase);
    if (toMin(fin) <= toMin(inicio)) fin = toHHMM(toMin(inicio) + h.duracionClase);
    return {
      id: String(f.id),
      inicio,
      fin,
      tipo: f.tipo === 'recreo' ? 'recreo' : 'clase'
    };
  }) : [];

  h.franjas.sort((a, b) => toMin(a.inicio) - toMin(b.inicio));
  if (!h.franjas.length) h.franjas = generarFranjas(h);

  const ids = new Set(h.franjas.map(f => f.id));
  h.casillas = (h.casillas && typeof h.casillas === 'object') ? h.casillas : {};
  const casillas = {};
  Object.keys(h.casillas).forEach(k => {
    const parts = k.split('|');
    const day = parts[0];
    const fid = parts[1];
    if (!h.dias.includes(day) || !ids.has(fid)) return;
    const v = h.casillas[k];
    if (!v || typeof v !== 'object') return;
    if (v.recreo) {
      casillas[k] = { recreo: true };
    } else if (v.asignaturaId) {
      casillas[k] = { asignaturaId: String(v.asignaturaId) };
    }
  });
  h.casillas = casillas;

  return h;
}

/* ---------- Generación automática de franjas ---------- */
function generarFranjas(h) {
  const start = toMin(h.entrada);
  const end = toMin(h.salida);
  const dur = Math.max(20, Number(h.duracionClase) || 60);
  const rec = Math.max(0, Number(h.duracionRecreo) || 0);
  const tras = Math.max(1, Number(h.recreoTras) || 3);
  const maxRec = Math.max(0, Number(h.numRecreos) || 0);

  const out = [];
  let t = start;
  let clases = 0;
  let recreos = 0;
  let guard = 0;

  while (t < end && guard < 60) {
    guard += 1;
    const tocaRecreo = rec > 0 && recreos < maxRec && clases > 0 && clases % tras === 0;
    if (tocaRecreo && t + rec < end) {
      out.push({ id: uid(), inicio: toHHMM(t), fin: toHHMM(t + rec), tipo: 'recreo' });
      t += rec;
      recreos += 1;
      continue;
    }
    const fin = Math.min(t + dur, end);
    if (fin - t < 10) break;
    out.push({ id: uid(), inicio: toHHMM(t), fin: toHHMM(fin), tipo: 'clase' });
    t = fin;
    clases += 1;
  }
  return out;
}

function regenerarFranjasConservando() {
  const h = state.horario;
  const viejas = h.franjas.slice();
  const nuevas = generarFranjas(h);
  const casillas = {};

  h.dias.forEach(day => {
    nuevas.forEach((nf, i) => {
      if (nf.tipo !== 'clase') return;
      const of = viejas[i];
      if (!of || of.tipo !== 'clase') return;
      const c = getCasilla(h, day, of.id);
      if (c) casillas[day + '|' + nf.id] = c;
    });
  });

  h.franjas = nuevas;
  h.casillas = casillas;
}

/* ---------- Acceso a días, franjas y casillas ---------- */
function salidaDia(h, day) {
  return h.diasSalida[day] || h.salida;
}

function franjaActivaEnDia(h, f, day) {
  if (!h.dias.includes(day)) return false;
  return toMin(f.fin) <= toMin(salidaDia(h, day));
}

function getCasilla(h, day, fid) {
  return h.casillas[day + '|' + fid] || null;
}

function setCasilla(h, day, fid, valor) {
  const key = day + '|' + fid;
  if (valor) h.casillas[key] = valor;
  else delete h.casillas[key];
}

function asignaturaPorId(id) {
  return state.asignaturas.find(a => a.id === id) || null;
}

function casillasDeAsignatura(id) {
  const h = state.horario;
  return Object.keys(h.casillas).filter(k => {
    const c = h.casillas[k];
    return c && c.asignaturaId === id;
  }).length;
}

function limpiarCasillasAsignatura(id) {
  const h = state.horario;
  Object.keys(h.casillas).forEach(k => {
    const c = h.casillas[k];
    if (c && c.asignaturaId === id) delete h.casillas[k];
  });
}

/* ---------- Resumen real de horas ---------- */
function calcularResumenHorario(h) {
  h = h || state.horario;
  const porAsig = {};
  let totalMin = 0;
  let totalClases = 0;

  (h.franjas || []).forEach(f => {
    if (f.tipo === 'recreo') return;
    const dur = minutosFranja(f);
    (h.dias || []).forEach(day => {
      if (!franjaActivaEnDia(h, f, day)) return;
      const c = getCasilla(h, day, f.id);
      if (!c || !c.asignaturaId || c.recreo) return;
      const id = c.asignaturaId;
      if (!porAsig[id]) porAsig[id] = { min: 0, clases: 0 };
      porAsig[id].min += dur;
      porAsig[id].clases += 1;
      totalMin += dur;
      totalClases += 1;
    });
  });

  return { porAsig, totalMin, totalClases };
}

/* ---------- Render: configuración ---------- */
function renderHorario() {
  if (!state) return;
  if (!state.horario) state.horario = normalizeHorario(null);

  const h = state.horario;

  const entrada = $('#schedule-entrada');
  if (entrada) entrada.value = h.entrada;
  const salida = $('#schedule-salida');
  if (salida) salida.value = h.salida;
  const durClase = $('#schedule-duracion-clase');
  if (durClase) durClase.value = h.duracionClase;
  const durRecreo = $('#schedule-duracion-recreo');
  if (durRecreo) durRecreo.value = h.duracionRecreo;
  const tras = $('#schedule-recreo-tras');
  if (tras) tras.value = h.recreoTras;
  const numRec = $('#schedule-num-recreos');
  if (numRec) numRec.value = h.numRecreos;

  const count = $('#schedule-count');
  if (count) count.textContent = h.franjas.length + ' franja' + (h.franjas.length === 1 ? '' : 's');

  const diasCont = $('#schedule-dias');
  if (diasCont) {
    diasCont.innerHTML = DIAS.map(d => `
      <label class="day-check">
        <input type="checkbox" data-day="${d.key}" ${h.dias.includes(d.key) ? 'checked' : ''}>
        <span>${d.label}</span>
      </label>
    `).join('');
  }

  const salidasCont = $('#schedule-dias-salida');
  if (salidasCont) {
    salidasCont.innerHTML = h.dias.map(d => `
      <div class="field">
        <label for="salida-${d}">${diaLabel(d)}</label>
        <input type="time" id="salida-${d}" data-salida-dia="${d}" value="${salidaDia(h, d)}">
      </div>
    `).join('');
  }

  renderFranjas();
  renderGrid();
  renderMobileHorario();
  renderResumenHorario();
}

function renderFranjas() {
  const cont = $('#schedule-franjas');
  if (!cont) return;
  const h = state.horario;
  if (!h.franjas.length) {
    cont.innerHTML = `<div class="empty" style="padding:1.25rem"><strong>Sin franjas</strong>Configura las horas y pulsa «Generar franjas», o añade una a mano.</div>`;
    return;
  }
  cont.innerHTML = h.franjas.map(f => `
    <div class="franja-item ${f.tipo === 'recreo' ? 'recreo' : ''}">
      <span class="fi-time">${f.inicio}–${f.fin}</span>
      <span class="fi-type">${f.tipo === 'recreo' ? 'Recreo' : 'Clase'} · ${minutosFranja(f)} min</span>
      <button class="btn btn-ghost btn-sm" type="button" data-editfranja="${f.id}">Editar</button>
      <button class="btn btn-danger btn-sm" type="button" data-delfranja="${f.id}" aria-label="Eliminar franja">×</button>
    </div>
  `).join('');
}

function renderGrid() {
  const cont = $('#horario-grid');
  if (!cont) return;
  const h = state.horario;
  const dias = h.dias;

  if (!dias.length) {
    cont.innerHTML = `<div class="empty"><strong>Sin días lectivos</strong>Selecciona al menos un día en la configuración.</div>`;
    return;
  }

  cont.style.gridTemplateColumns = '92px repeat(' + dias.length + ', minmax(0, 1fr))';

  const visibles = h.franjas.filter(f => dias.some(d => franjaActivaEnDia(h, f, d)));
  if (!visibles.length) {
    cont.innerHTML = `<div class="empty" style="grid-column:1/-1"><strong>Sin franjas visibles</strong>Revisa la hora de salida de cada día o genera las franjas.</div>`;
    return;
  }

  let html = `<div class="sg-head sg-time">Hora</div>`;
  dias.forEach(d => {
    html += `<div class="sg-head">${diaLabel(d)}</div>`;
  });

  visibles.forEach(f => {
    html += `<div class="sg-time">
      <span>${f.inicio}–${f.fin}</span>
      <button class="sg-edit" type="button" data-editfranja="${f.id}" aria-label="Editar franja ${f.inicio}–${f.fin}">✎</button>
    </div>`;

    if (f.tipo === 'recreo') {
      html += `<div class="sg-break" style="grid-column: span ${dias.length}">Recreo · ${f.inicio}–${f.fin}</div>`;
      return;
    }

    dias.forEach(day => {
      if (!franjaActivaEnDia(h, f, day)) {
        html += `<div class="sg-cell sg-off" aria-hidden="true">—</div>`;
        return;
      }
      const c = getCasilla(h, day, f.id);
      const key = day + '|' + f.id;
      const label = diaLabel(day) + ' ' + f.inicio + '–' + f.fin;

      if (c && c.recreo) {
        html += `<button class="sg-cell sg-recreo" type="button" data-cell="${key}" aria-label="${label}: recreo">Recreo</button>`;
        return;
      }
      if (c && c.asignaturaId) {
        const a = asignaturaPorId(c.asignaturaId);
        const count = countTareasPendientesSlot(key);
        if (a) {
          html += `<button class="sg-cell sc-${a.color}" type="button" data-cell="${key}" aria-label="${label}: ${esc(a.nombre)}"><span class="sg-name">${esc(a.nombre)}</span>${count > 0 ? `<span class="badge red task-badge">${count}</span>` : ''}</button>`;
        } else {
          html += `<button class="sg-cell sg-orphan" type="button" data-cell="${key}" aria-label="${label}: asignatura eliminada">Asignatura eliminada</button>`;
        }
        return;
      }
      html += `<button class="sg-cell sg-empty" type="button" data-cell="${key}" aria-label="${label}: vacía, añadir asignatura"><span>+</span></button>`;
    });
  });

  cont.innerHTML = html;
}

function renderMobileHorario() {
  const cont = $('#horario-mobile');
  if (!cont) return;
  const h = state.horario;

  if (!h.dias.length) {
    cont.innerHTML = `<div class="empty"><strong>Sin días lectivos</strong>Selecciona al menos un día en la configuración.</div>`;
    return;
  }

  if (!scheduleMobileDay || !h.dias.includes(scheduleMobileDay)) {
    const jsDay = new Date().getDay();
    const hoy = jsDay >= 1 && jsDay <= 5 ? DIAS[jsDay - 1].key : null;
    scheduleMobileDay = hoy && h.dias.includes(hoy) ? hoy : h.dias[0];
  }

  let html = `<div class="day-tabs" role="tablist" aria-label="Días del horario">`;
  h.dias.forEach(d => {
    html += `<button class="day-tab ${d === scheduleMobileDay ? 'active' : ''}" type="button" role="tab" aria-selected="${d === scheduleMobileDay}" data-day="${d}">${diaShort(d)}</button>`;
  });
  html += `</div>`;

  const day = scheduleMobileDay;
  const franjas = h.franjas.filter(f => franjaActivaEnDia(h, f, day));

  if (!franjas.length) {
    html += `<div class="empty" style="margin-top:.6rem"><strong>Sin clases este día</strong>Revisa la hora de salida del ${diaLabel(day).toLowerCase()}.</div>`;
  } else {
    html += `<div class="mobile-day-list" role="tabpanel" aria-label="${diaLabel(day)}">`;
    franjas.forEach(f => {
      if (f.tipo === 'recreo') {
        html += `<div class="mobile-break">Recreo · ${f.inicio}–${f.fin}</div>`;
        return;
      }
      const c = getCasilla(h, day, f.id);
      const a = c && c.asignaturaId ? asignaturaPorId(c.asignaturaId) : null;
      const key = day + '|' + f.id;
      let cls = 'sg-empty';
      let nombre = 'Vacía · toca para añadir';
      if (c && c.recreo) {
        cls = 'sg-recreo';
        nombre = 'Recreo';
      } else if (a) {
        cls = 'sc-' + a.color;
        nombre = a.nombre;
      } else if (c && c.asignaturaId) {
        cls = 'sg-orphan';
        nombre = 'Asignatura eliminada';
      }
      html += `<div class="mobile-class ${cls}" role="button" tabindex="0" data-cell="${key}" aria-label="${diaLabel(day)} ${f.inicio}–${f.fin}: ${esc(nombre)}">
        <span class="mc-time">${f.inicio}–${f.fin}</span>
        <span class="mc-name">${esc(nombre)}</span>
        <button class="mc-edit" type="button" data-editfranja="${f.id}" aria-label="Editar franja">✎</button>
      </div>`;
    });
    html += `</div>`;
  }

  cont.innerHTML = html;
}

function renderResumenHorario() {
  const cont = $('#horario-resumen');
  if (!cont) return;
  const h = state.horario;
  const r = calcularResumenHorario(h);

  const activas = state.asignaturas.filter(a => !a.archivada);
  const ids = activas.map(a => a.id);
  Object.keys(r.porAsig).forEach(id => {
    if (ids.indexOf(id) === -1) ids.push(id);
  });

  const filas = [];
  ids.forEach(id => {
    const a = asignaturaPorId(id);
    if (!a) return;
    const datos = r.porAsig[id] || { min: 0, clases: 0 };
    const esperado = a.horasSemanales == null || a.horasSemanales === '' ? null : Number(a.horasSemanales);
    if (datos.min === 0 && esperado == null) return;

    const colocado = datos.min / 60;
    let estado = { cls: 'none', txt: 'Sin horas esperadas' };
    if (esperado != null) {
      const diff = colocado - esperado;
      if (Math.abs(diff) < 1 / 60) estado = { cls: 'ok', txt: 'Coincide' };
      else if (diff < 0) estado = { cls: 'miss', txt: 'Faltan ' + fmt(-diff) + ' h' };
      else estado = { cls: 'over', txt: 'Sobran ' + fmt(diff) + ' h' };
    }

    filas.push(`<div class="summary-row sc-${a.color}">
      <span class="color-dot"></span>
      <span class="sr-name">${esc(a.nombre)}</span>
      <span class="sr-data">${datos.clases} clase${datos.clases === 1 ? '' : 's'} · ${fmtHoras(datos.min)}${esperado == null ? '' : ' de ' + fmt(esperado) + ' h'}</span>
      <span class="summary-status ${estado.cls}">${estado.txt}</span>
    </div>`);
  });

  const totalHtml = `<div class="summary-total">
    <div class="summary-stat"><span class="label">Total en horario</span><span class="value">${fmtHoras(r.totalMin)}</span></div>
    <div class="summary-stat"><span class="label">Clases semanales</span><span class="value">${r.totalClases}</span></div>
    <div class="summary-stat"><span class="label">Asignaturas</span><span class="value">${Object.keys(r.porAsig).length}</span></div>
  </div>`;

  if (!filas.length) {
    cont.innerHTML = totalHtml + `
      <div class="empty-state-card" style="margin-top:1rem">
        <div class="esc-icon">📅</div>
        <h3>Sin asignaturas en el horario</h3>
        <p>Toca una casilla de la semana para colocar tu primera asignatura y calcular automáticamente tus horas semanales.</p>
      </div>
    `;
    return;
  }
  cont.innerHTML = totalHtml + filas.join('');
}

/* ---------- Selector de color reutilizable ---------- */
function initColorPicker(containerSel, inputSel) {
  const cont = $(containerSel);
  const input = $(inputSel);
  if (!cont || !input) return;

  cont.innerHTML = PALETA.map(c => `
    <button type="button" class="color-swatch sc-${c}" data-color="${c}" role="radio" aria-checked="false" aria-label="${PALETA_LABEL[c]}" title="${PALETA_LABEL[c]}"></button>
  `).join('');

  cont.addEventListener('click', (e) => {
    const b = e.target.closest('[data-color]');
    if (!b) return;
    input.value = b.dataset.color;
    updateColorPicker(containerSel, inputSel);
  });

  updateColorPicker(containerSel, inputSel);
}

function updateColorPicker(containerSel, inputSel) {
  const cont = $(containerSel);
  const input = $(inputSel);
  if (!cont || !input) return;
  Array.from(cont.querySelectorAll('[data-color]')).forEach(b => {
    const on = b.dataset.color === input.value;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
}

function setColorPicker(containerSel, inputSel, color) {
  const input = $(inputSel);
  if (input) input.value = colorValido(color);
  updateColorPicker(containerSel, inputSel);
}

/* ---------- Configuración ---------- */
function leerConfigHorario() {
  const h = state.horario;
  const entrada = $('#schedule-entrada').value;
  const salida = $('#schedule-salida').value;

  if (horaValida(entrada)) h.entrada = entrada;
  if (horaValida(salida) && toMin(salida) > toMin(h.entrada)) h.salida = salida;

  h.duracionClase = clampInt($('#schedule-duracion-clase').value, 20, 180, h.duracionClase);
  h.duracionRecreo = clampInt($('#schedule-duracion-recreo').value, 0, 120, h.duracionRecreo);
  h.recreoTras = clampInt($('#schedule-recreo-tras').value, 1, 12, h.recreoTras);
  h.numRecreos = clampInt($('#schedule-num-recreos').value, 0, 6, h.numRecreos);
}

/* ---------- Diálogo de casilla ---------- */
function openCellDialog(key) {
  const parts = String(key).split('|');
  const day = parts[0];
  const fid = parts[1];
  const f = state.horario.franjas.find(x => x.id === fid);
  if (!f) return;

  const c = getCasilla(state.horario, day, fid);
  if (c && c.asignaturaId) {
    openClassDetail(day, fid);
    return;
  }

  editingCellKey = key;
  $('#dlg-cell-title').textContent = diaLabel(day);
  $('#dlg-cell-subtitle').textContent = f.inicio + '–' + f.fin + (f.tipo === 'recreo' ? ' · Recreo' : '');
  renderCellSubjects();
  $('#dialog-cell').showModal();
}

function renderCellSubjects() {
  const cont = $('#dlg-cell-subjects');
  if (!cont || !editingCellKey) return;
  const parts = editingCellKey.split('|');
  const c = getCasilla(state.horario, parts[0], parts[1]);
  const actual = c && c.asignaturaId ? c.asignaturaId : null;
  const activas = state.asignaturas.filter(a => !a.archivada);

  if (!activas.length) {
    cont.innerHTML = `<div class="empty" style="padding:1rem"><strong>Sin asignaturas</strong>Crea primero tus materias en «Asignaturas».</div>`;
    return;
  }

  cont.innerHTML = activas.map(a => `
    <button type="button" class="cell-subject sc-${a.color} ${actual === a.id ? 'active' : ''}" data-pick="${a.id}">
      <span class="color-dot"></span>
      <span>${esc(a.nombre)}</span>
    </button>
  `).join('');
}

function aplicarAsignatura(id) {
  if (!editingCellKey) return;
  const parts = editingCellKey.split('|');
  setCasilla(state.horario, parts[0], parts[1], { asignaturaId: id });
  saveState();
  $('#dialog-cell').close();
  toast('Asignatura colocada');
  render();
}

function vaciarCasilla() {
  if (!editingCellKey) return;
  const parts = editingCellKey.split('|');
  setCasilla(state.horario, parts[0], parts[1], null);
  saveState();
  $('#dialog-cell').close();
  toast('Casilla vaciada');
  render();
}

function marcarRecreo() {
  if (!editingCellKey) return;
  const parts = editingCellKey.split('|');
  setCasilla(state.horario, parts[0], parts[1], { recreo: true });
  saveState();
  $('#dialog-cell').close();
  toast('Casilla marcada como recreo');
  render();
}

/* ---------- Diálogo de franja ---------- */
function abrirNuevaFranja() {
  editingFranjaId = null;
  const h = state.horario;
  const last = h.franjas[h.franjas.length - 1];
  const inicio = last ? last.fin : h.entrada;

  $('#dlg-franja-title').textContent = 'Añadir franja';
  $('#dlg-franja-inicio').value = inicio;
  $('#dlg-franja-fin').value = toHHMM(toMin(inicio) + h.duracionClase);
  $('#dlg-franja-tipo').value = 'clase';
  $('#dlg-franja-delete').classList.add('hidden');
  $('#dialog-franja').showModal();
}

function openFranjaDialog(id) {
  const f = state.horario.franjas.find(x => x.id === id);
  if (!f) return;
  editingFranjaId = id;
  $('#dlg-franja-title').textContent = 'Editar franja';
  $('#dlg-franja-inicio').value = f.inicio;
  $('#dlg-franja-fin').value = f.fin;
  $('#dlg-franja-tipo').value = f.tipo;
  $('#dlg-franja-delete').classList.remove('hidden');
  $('#dialog-franja').showModal();
}

function guardarFranja() {
  const h = state.horario;
  const inicio = $('#dlg-franja-inicio').value;
  const fin = $('#dlg-franja-fin').value;
  const tipo = $('#dlg-franja-tipo').value === 'recreo' ? 'recreo' : 'clase';

  if (!horaValida(inicio) || !horaValida(fin)) return toast('Indica un inicio y un fin válidos');
  if (toMin(fin) <= toMin(inicio)) return toast('La hora de fin debe ser posterior al inicio');

  if (editingFranjaId) {
    const f = h.franjas.find(x => x.id === editingFranjaId);
    if (!f) return;
    f.inicio = inicio;
    f.fin = fin;
    f.tipo = tipo;
    if (tipo === 'recreo') {
      Object.keys(h.casillas).forEach(k => {
        if (k.split('|')[1] === f.id) delete h.casillas[k];
      });
    }
  } else {
    h.franjas.push({ id: uid(), inicio, fin, tipo });
  }

  h.franjas.sort((a, b) => toMin(a.inicio) - toMin(b.inicio));
  saveState();
  $('#dialog-franja').close();
  toast('Franja guardada');
  render();
}

function eliminarFranja(id) {
  const h = state.horario;
  const f = h.franjas.find(x => x.id === id);
  if (!f) return;
  if (!confirm('¿Eliminar la franja ' + f.inicio + '–' + f.fin + ' y las asignaturas colocadas en ella?')) return;

  h.franjas = h.franjas.filter(x => x.id !== id);
  Object.keys(h.casillas).forEach(k => {
    if (k.split('|')[1] === id) delete h.casillas[k];
  });
  saveState();
  if (editingFranjaId === id) {
    editingFranjaId = null;
    const dlg = $('#dialog-franja');
    if (dlg) dlg.close();
  }
  toast('Franja eliminada');
  render();
}

function irAVista(view) {
  const btn = document.querySelector('.nav-btn[data-view="' + view + '"]');
  if (btn) btn.click();
}

/* ---------- Eventos del horario ---------- */
function bindSchedule() {
  ['#schedule-entrada', '#schedule-salida', '#schedule-duracion-clase',
   '#schedule-duracion-recreo', '#schedule-recreo-tras', '#schedule-num-recreos'].forEach(sel => {
    const el = $(sel);
    if (!el) return;
    el.addEventListener('change', () => {
      leerConfigHorario();
      saveState();
      renderHorario();
    });
  });

  const btnGenerar = $('#btn-generar-franjas');
  if (btnGenerar) {
    btnGenerar.addEventListener('click', () => {
      leerConfigHorario();
      const hayCasillas = Object.keys(state.horario.casillas).length > 0;
      if (hayCasillas && !confirm('Se regenerarán las franjas. Las asignaturas colocadas se conservarán por orden. ¿Continuar?')) return;
      regenerarFranjasConservando();
      saveState();
      toast('Franjas generadas');
      render();
    });
  }

  const btnAdd = $('#btn-add-franja');
  if (btnAdd) btnAdd.addEventListener('click', abrirNuevaFranja);

  const diasCont = $('#schedule-dias');
  if (diasCont) {
    diasCont.addEventListener('change', (e) => {
      const cb = e.target.closest('input[data-day]');
      if (!cb) return;
      const h = state.horario;
      if (cb.checked) {
        if (!h.dias.includes(cb.dataset.day)) h.dias.push(cb.dataset.day);
      } else {
        h.dias = h.dias.filter(d => d !== cb.dataset.day);
      }
      if (!h.dias.length) {
        h.dias = DIAS_LECTIVOS_DEFAULT.slice();
        toast('Selecciona al menos un día');
      }
      h.dias.sort((a, b) => DIAS.findIndex(d => d.key === a) - DIAS.findIndex(d => d.key === b));
      saveState();
      render();
    });
  }

  const salidasCont = $('#schedule-dias-salida');
  if (salidasCont) {
    salidasCont.addEventListener('change', (e) => {
      const input = e.target.closest('input[data-salida-dia]');
      if (!input) return;
      const h = state.horario;
      const day = input.dataset.salidaDia;
      const v = input.value;
      if (horaValida(v) && toMin(v) > toMin(h.entrada)) h.diasSalida[day] = v;
      else delete h.diasSalida[day];
      saveState();
      renderHorario();
    });
  }

  const view = $('#view-horario');
  if (view) {
    view.addEventListener('click', (e) => {
      const editF = e.target.closest('[data-editfranja]');
      if (editF) {
        openFranjaDialog(editF.dataset.editfranja);
        return;
      }
      const delF = e.target.closest('[data-delfranja]');
      if (delF) {
        eliminarFranja(delF.dataset.delfranja);
        return;
      }
      const dayBtn = e.target.closest('[data-day]');
      if (dayBtn) {
        scheduleMobileDay = dayBtn.dataset.day;
        renderMobileHorario();
        return;
      }
      const cell = e.target.closest('[data-cell]');
      if (cell) openCellDialog(cell.dataset.cell);
    });
  }

  const closeCell = $('#dlg-cell-close');
  if (closeCell) closeCell.addEventListener('click', () => $('#dialog-cell').close());

  const subjectsCont = $('#dlg-cell-subjects');
  if (subjectsCont) {
    subjectsCont.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pick]');
      if (b) aplicarAsignatura(b.dataset.pick);
    });
  }

  const clearBtn = $('#dlg-cell-clear');
  if (clearBtn) clearBtn.addEventListener('click', vaciarCasilla);
  const breakBtn = $('#dlg-cell-break');
  if (breakBtn) breakBtn.addEventListener('click', marcarRecreo);

  const editFromCell = $('#dlg-cell-editfranja');
  if (editFromCell) {
    editFromCell.addEventListener('click', () => {
      if (!editingCellKey) return;
      const fid = editingCellKey.split('|')[1];
      $('#dialog-cell').close();
      openFranjaDialog(fid);
    });
  }

  const addAsig = $('#dlg-cell-addasig');
  if (addAsig) {
    addAsig.addEventListener('click', () => {
      $('#dialog-cell').close();
      irAVista('asignaturas');
    });
  }

  const closeF = $('#dlg-franja-close');
  if (closeF) closeF.addEventListener('click', () => $('#dialog-franja').close());
  const cancelF = $('#dlg-franja-cancel');
  if (cancelF) cancelF.addEventListener('click', () => $('#dialog-franja').close());
  const saveF = $('#dlg-franja-save');
  if (saveF) saveF.addEventListener('click', guardarFranja);
  const delF = $('#dlg-franja-delete');
  if (delF) {
    delF.addEventListener('click', () => {
      if (editingFranjaId) eliminarFranja(editingFranjaId);
    });
  }

  if (typeof setInterval === 'function') {
    setInterval(renderDashboardClassesToday, 60000);
  }
}
