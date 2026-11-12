/* ============================================================
   Mi Asistencia — attendance.js
   Etapas educativas y cálculos de asistencia y riesgo.
   ============================================================ */

const ETAPAS = {
  eso: { label: 'ESO', tipo: 'secundaria' },
  bachillerato: { label: 'Bachillerato', tipo: 'secundaria' },
  fp_basico: { label: 'FP Grado Básico', tipo: 'fp' },
  fp_medio: { label: 'FP Grado Medio', tipo: 'fp' },
  fp_superior: { label: 'FP Grado Superior', tipo: 'fp' }
};

/* ---------- Cálculos ---------- */
function calcAsignatura(a) {
  const horasPlanificadas = Number(a.horasTotales) || 0;
  const faltas = state.faltas.filter(f => f.asignaturaId === a.id);
  const horasAusencia = faltas.reduce((s, f) => s + (Number(f.horas) || 0), 0);
  const horasAsistidas = Math.max(0, horasPlanificadas - horasAusencia);
  const pct = horasPlanificadas > 0 ? (horasAsistidas / horasPlanificadas) * 100 : null;
  const pctAusencia = horasPlanificadas > 0 ? (horasAusencia / horasPlanificadas) * 100 : null;
  return { horasPlanificadas, horasAusencia, horasAsistidas, pct, pctAusencia };
}

function estadoAsignatura(a, c) {
  const tipo = ETAPAS[state.etapa] ? ETAPAS[state.etapa].tipo : 'fp';
  if (!c.horasPlanificadas) {
    return { tone: 'gray', label: 'Faltan datos' };
  }
  if (tipo === 'fp') {
    if (c.pctAusencia > 20) return { tone: 'red', label: 'Límite superado (80%)' };
    if (c.pctAusencia >= 15) return { tone: 'yellow', label: 'Cerca del límite' };
    return { tone: 'green', label: 'Sin riesgo' };
  }
  const crit = state.config.criterio || {};
  if (!crit.tipo || crit.valor == null || crit.valor === '') {
    return { tone: 'gray', label: 'Falta criterio del centro' };
  }
  const valor = Number(crit.valor);
  if (crit.tipo === 'porcentaje') {
    if (c.pctAusencia > valor) return { tone: 'red', label: 'Límite superado' };
    if (c.pctAusencia >= valor * 0.75) return { tone: 'yellow', label: 'Cerca del límite' };
    return { tone: 'green', label: 'Sin riesgo' };
  }
  if (c.horasAusencia > valor) return { tone: 'red', label: 'Límite superado' };
  if (c.horasAusencia >= valor * 0.75) return { tone: 'yellow', label: 'Cerca del límite' };
  return { tone: 'green', label: 'Sin riesgo' };
}

function calcGlobal() {
  const activas = state.asignaturas.filter(a => !a.archivada && Number(a.horasTotales) > 0);
  const totalPlan = activas.reduce((s, a) => s + Number(a.horasTotales), 0);
  const totalAsist = activas.reduce((s, a) => s + calcAsignatura(a).horasAsistidas, 0);
  const pct = totalPlan > 0 ? (totalAsist / totalPlan) * 100 : null;
  return { totalPlan, totalAsist, pct, activas };
}
