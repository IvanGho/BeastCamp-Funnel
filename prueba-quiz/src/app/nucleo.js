/* Lógica pura de la app del comprador (sin DOM ni red): fechas, racha, puntos, ranking virtual, fusión de progreso y pasos del reproductor.
   Se prueba en Node (tests/app-logica.test.ts) y en el navegador queda como la constante global NUCLEO. */
const NUCLEO = (() => {
  const DIA = 864e5;

  /* Muñecos 3D (de /img/) que usa la propia app: se precargan en el service worker. Los de cada ejercicio llegan con el plan. */
  const MUNECOS_APP = ['t1', 't2', 't3', 't4', 'm_golpes', 'f_tiempo', 'f_ayuda', 'o_competir', 'n_anios', 'm_const', 'n_mas', 'c_guardia', 'e_guardia', 'l_casa', 'o_sparring', 'e_resp', 'o_tecnica'];

  /* ---------- fechas: el «día» es el día calendario del celu (índice entero, consecutivos) ---------- */
  const idxDia = (ms) => { const d = new Date(ms); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DIA; };
  const fechaDeIdx = (i) => new Date(i * DIA);                     // usar getUTC*: es la fecha local de ese día
  const diaSemana = (i) => (fechaDeIdx(i).getUTCDay() + 6) % 7;     // 0 = lunes
  const LETRAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const NOMBRES_DIA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

  const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

  /* ---------- progreso (formato versión 1 del contrato) ---------- */
  const progVacio = (nivel, ahora, apodo = '') => ({ v: 1, apodo, nivel, inicio: ahora, sesiones: {}, drills: {}, ajustes: { sonido: true, voz: true, vibracion: true }, actualizado: ahora });

  const APODO_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9 _.\-]{0,20}$/;
  const limpiarApodo = (s) => String(s ?? '').replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9 _.\-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
  const apodoValido = (s) => APODO_RE.test(String(s ?? ''));

  /* Valida lo que viene del almacenamiento o del servidor, para no romper con datos viejos o rotos. */
  function normalizarProg(p) {
    if (!p || typeof p !== 'object' || p.v !== 1) return null;
    const num = (x) => (Number.isFinite(x) ? x : 0);
    const out = { v: 1, apodo: apodoValido(p.apodo) ? p.apodo : limpiarApodo(p.apodo), nivel: /^t[1-4]$/.test(p.nivel) ? p.nivel : 't1', inicio: num(p.inicio), sesiones: {}, drills: {}, ajustes: { sonido: true, voz: true, vibracion: true }, actualizado: num(p.actualizado) };
    for (const [k, s] of Object.entries(p.sesiones || {})) if (s && typeof s === 'object') out.sesiones[k] = { fin: num(s.fin), min: num(s.min), pts: num(s.pts) };
    for (const [k, d] of Object.entries(p.drills || {})) if (d && typeof d === 'object') out.drills[k] = { veces: num(d.veces), ultimo: num(d.ultimo), pts: num(d.pts) };
    for (const k of ['sonido', 'voz', 'vibracion']) if (p.ajustes && typeof p.ajustes[k] === 'boolean') out.ajustes[k] = p.ajustes[k];
    return out;
  }

  /* Fusión con lo del servidor: unión de sesiones y drills; para el resto gana el `actualizado` más nuevo. */
  function fusionar(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    const nuevo = (b.actualizado || 0) > (a.actualizado || 0) ? b : a;
    const sesiones = { ...a.sesiones };
    for (const [k, s] of Object.entries(b.sesiones)) if (!sesiones[k] || s.fin < sesiones[k].fin) sesiones[k] = s;   // queda la primera vez que se hizo
    const drills = { ...a.drills };
    for (const [k, d] of Object.entries(b.drills)) {
      const x = drills[k];
      drills[k] = x ? { veces: Math.max(x.veces, d.veces), ultimo: Math.max(x.ultimo, d.ultimo), pts: Math.max(x.pts, d.pts) } : d;
    }
    const ini = [a.inicio, b.inicio].filter((x) => x > 0);
    return { v: 1, apodo: nuevo.apodo, nivel: nuevo.nivel, inicio: ini.length ? Math.min(...ini) : 0, sesiones, drills, ajustes: { ...nuevo.ajustes }, actualizado: Math.max(a.actualizado || 0, b.actualizado || 0) };
  }

  /* ---------- racha, puntos y bonus ---------- */
  function diasActivos(prog) {
    const s = new Set();
    Object.values(prog.sesiones).forEach((x) => x.fin && s.add(idxDia(x.fin)));
    Object.values(prog.drills).forEach((x) => x.ultimo && s.add(idxDia(x.ultimo)));
    return s;
  }
  /* Días seguidos con alguna sesión o drill. Sigue viva si ayer entrenaste aunque hoy todavía no. */
  function racha(prog, ahora) {
    const act = diasActivos(prog), hoy = idxDia(ahora);
    let d = act.has(hoy) ? hoy : hoy - 1, n = 0;
    while (act.has(d)) { n++; d--; }
    let mejor = 0, cur = 0, prev = null;
    [...act].sort((x, y) => x - y).forEach((x) => { cur = prev !== null && x === prev + 1 ? cur + 1 : 1; prev = x; if (cur > mejor) mejor = cur; });
    return { dias: n, hoy: act.has(hoy), mejor: Math.max(mejor, n) };
  }
  /* Bonus de racha: 10 puntos por cada día seguido después del primero, hasta 60 (día 7 en adelante). Una vez por día. */
  const bonusRacha = (dias) => Math.min(Math.max(dias - 1, 0), 6) * 10;

  /* Registra una sesión terminada. Si ya estaba hecha no suma de nuevo. `min` son los minutos que entrenó de verdad. */
  function completarSesion(prog, ses, ahora, min) {
    if (prog.sesiones[ses.id]) return { repetida: true, base: 0, bonus: 0, pts: 0, racha: racha(prog, ahora) };
    const antes = racha(prog, ahora);
    const bonus = antes.hoy ? 0 : bonusRacha(antes.dias + 1);
    const base = Math.max(0, ses.puntos | 0), pts = base + bonus;
    prog.sesiones[ses.id] = { fin: ahora, min: Math.max(1, Math.round(min)), pts };
    prog.actualizado = ahora;
    return { repetida: false, base, bonus, pts, racha: racha(prog, ahora) };
  }
  /* Un drill suma sus puntos una vez por día (se puede repetir las veces que quieras). */
  function completarDrill(prog, dr, ahora) {
    const prev = prog.drills[dr.id];
    const yaHoy = prev && idxDia(prev.ultimo) === idxDia(ahora);
    const pts = yaHoy ? 0 : Math.max(0, dr.puntos | 0);
    prog.drills[dr.id] = { veces: (prev ? prev.veces : 0) + 1, ultimo: ahora, pts: (prev ? prev.pts : 0) + pts };
    prog.actualizado = ahora;
    return { repetida: !!yaHoy, base: pts, bonus: 0, pts, racha: racha(prog, ahora) };
  }
  function totales(prog) {
    const s = Object.values(prog.sesiones), d = Object.values(prog.drills);
    return { sesiones: s.length, minutos: s.reduce((a, x) => a + x.min, 0), puntos: s.reduce((a, x) => a + x.pts, 0) + d.reduce((a, x) => a + x.pts, 0), drills: d.reduce((a, x) => a + x.veces, 0) };
  }

  /* ---------- tira de la semana (lunes a domingo) y calendario de 28 días ---------- */
  function semanaDe(prog, ahora) {
    const act = diasActivos(prog), hoy = idxDia(ahora), lunes = hoy - diaSemana(hoy);
    return LETRAS.map((letra, i) => ({ idx: lunes + i, letra, nombre: NOMBRES_DIA[i], n: fechaDeIdx(lunes + i).getUTCDate(), hecho: act.has(lunes + i), hoy: lunes + i === hoy, futuro: lunes + i > hoy }));
  }
  function calendario(prog, ahora) {
    const act = diasActivos(prog), hoy = idxDia(ahora), ini = prog.inicio ? idxDia(prog.inicio) : hoy;
    const desde = hoy - ini >= 28 ? hoy - 27 : ini;
    return Array.from({ length: 28 }, (_, i) => ({ idx: desde + i, n: fechaDeIdx(desde + i).getUTCDate(), num: desde + i - ini + 1, hecho: act.has(desde + i), hoy: desde + i === hoy, futuro: desde + i > hoy }));
  }
  const numeroDeDia = (prog, ahora) => (prog.inicio ? idxDia(ahora) - idxDia(prog.inicio) + 1 : 1);

  /* ---------- plan ---------- */
  const nivelDe = (plan, id) => (plan.niveles || []).find((n) => n.id === id) || (plan.niveles || [])[0] || null;
  /* Todas las sesiones del nivel en orden, cada una con su semana. */
  function sesionesDe(nivel) {
    const out = [];
    (nivel ? nivel.semanas : []).forEach((sem) => (sem.sesiones || []).forEach((s) => out.push({ ...s, semana: sem.n, tituloSemana: sem.titulo })));
    return out;
  }
  const siguienteSesion = (nivel, prog) => sesionesDe(nivel).find((s) => !prog.sesiones[s.id]) || null;
  function buscarSesion(plan, id) {
    for (const nv of plan.niveles || []) { const s = sesionesDe(nv).find((x) => x.id === id); if (s) return { ...s, nivelId: nv.id }; }
    return null;
  }
  const buscarDrill = (plan, id) => (plan.drills || []).find((d) => d.id === id) || null;
  const nombreTipo = (t) => ({ tecnica: 'Técnica', cardio: 'Cardio', mixta: 'Mixta', suave: 'Suave' }[t] || 'Sesión');
  const ejercicio = (plan, id) => (plan.ejercicios && plan.ejercicios[id]) || { nombre: String(id || 'Ejercicio').replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase()), como: [], cuidado: '', muneco: 'm_golpes', video: '' };

  /* El muñeco que representa una sesión o un drill: el del primer ejercicio de técnica (o el primero que haya). */
  function munecoDe(plan, item) {
    if (item.muneco) return item.muneco;
    const bloques = item.bloques || [{ tipo: 'tecnica', pasos: item.pasos || [] }];
    const b = bloques.find((x) => x.tipo === 'tecnica' || x.tipo === 'rounds') || bloques[0];
    const p = b && b.pasos && b.pasos[0];
    return p ? ejercicio(plan, p.ej).muneco : 'm_golpes';
  }
  /* Claves de muñeco y rutas de video de todo el plan, para guardarlos y verlos sin conexión. */
  function munecosDelPlan(plan) {
    return [...new Set(Object.values(plan.ejercicios || {}).map((e) => e.muneco).concat((plan.guia && plan.guia.secciones || []).map((s) => s.muneco), (plan.drills || []).map((d) => d.muneco)).filter(Boolean))].sort();
  }

  /* Lista plana de pasos del reproductor: un paso de «trabajo» por cada ronda y un «descanso» entre ellos.
     Un paso con `seg` corre solo; un paso con `reps` espera el «Hecho». Regla del plan: un paso dura rondas × (seg + descanso), el descanso de la última ronda también cuenta (así salen los `minutos` de cada sesión). */
  const SEG_POR_REP = 3;
  function pasosDe(item, plan) {
    const bloques = item.bloques || [{ tipo: 'tecnica', titulo: item.titulo, pasos: item.pasos || [] }];
    const out = [];
    bloques.forEach((b, bi) => (b.pasos || []).forEach((p) => {
      const rondas = Math.max(1, p.rondas | 0 || 1), ej = ejercicio(plan, p.ej);
      for (let r = 1; r <= rondas; r++) {
        out.push({ t: 'trabajo', ej: p.ej, nombre: ej.nombre, seg: p.seg > 0 ? p.seg : 0, reps: p.seg > 0 ? 0 : (p.reps | 0 || 10), ronda: r, rondas, combo: p.combo || '', nota: p.nota || '', bloque: b.titulo || '', bloqueTipo: b.tipo || '', bi });
        if (p.descanso > 0) out.push({ t: 'descanso', ej: p.ej, seg: p.descanso, ronda: r, rondas, bloque: b.titulo || '', bi });
      }
    }));
    return out;
  }
  const segDe = (p) => (p.seg > 0 ? p.seg : p.reps * SEG_POR_REP);
  const segTotales = (pasos) => pasos.reduce((a, p) => a + segDe(p), 0);
  /* Paso de trabajo que viene después de i (saltando descansos). */
  const proximoTrabajo = (pasos, i) => { for (let k = i + 1; k < pasos.length; k++) if (pasos[k].t === 'trabajo') return pasos[k]; return null; };
  const minutosDe = (pasos) => Math.max(1, Math.round(segTotales(pasos) / 60));

  /* ---------- ranking con rivales virtuales (determinista a partir del acceso y la fecha) ---------- */
  const hash32 = (s) => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
  const semilla = (a) => () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const ALIAS = ['Rayo_Sur', 'Guardia Alta', 'Jab.Veloz', 'Pie Ligero', 'Sombra 07', 'Gancho_Zurdo', 'Ritmo Fino', 'Cinta Verde', 'Doble Jab', 'Paso Corto', 'Fuerza Tranquila', 'Round Final', 'Pivot_9', 'Esquiva Norte', 'Codo Firme', 'Cadencia'];
  /* Puntos por día que suma alguien que sigue el plan al ritmo previsto (promedio de todos los niveles). */
  function ritmoRef(plan) {
    const r = (plan.niveles || []).map((n) => {
      const ss = sesionesDe(n); if (!ss.length) return 0;
      return ((n.sesionesPorSemana || 3) * ss.reduce((a, s) => a + (s.puntos || 0), 0) / ss.length) / 7;
    }).filter((x) => x > 0);
    return r.length ? r.reduce((a, b) => a + b, 0) / r.length : 45;
  }
  /* 7 rivales virtuales. Cada uno tiene su ritmo y sus días de descanso; los puntos de hoy son la suma de lo que «hizo» desde el día 1 del comprador. */
  function rivales(acceso, hoy, ini, ritmo) {
    const rnd = semilla(hash32('r:' + acceso));
    const nombres = ALIAS.map((n) => [rnd(), n]).sort((a, b) => a[0] - b[0]).slice(0, 7).map((x) => x[1]);
    const dias = Math.min(90, Math.max(1, hoy - ini + 1));
    return nombres.map((nombre, i) => {
      const factor = 0.4 + rnd() * 0.9;
      let pts = 0;
      for (let d = 0; d < dias; d++) {
        const r = semilla(hash32(acceso + ':' + i + ':' + (ini + d)));
        if (r() > 0.24) pts += ritmo * factor * (0.6 + r() * 0.8);
      }
      return { nombre, pts: Math.round(pts / 5) * 5, virtual: true };
    });
  }
  /* Ranking completo: los 7 virtuales y el comprador con su apodo; ordenado por puntos (a igualdad, primero el comprador). */
  function ranking(acceso, plan, prog, nombre, ahora) {
    const yo = { nombre: prog.apodo || nombre || 'Vos', pts: totales(prog).puntos, virtual: false };
    const lista = rivales(acceso, idxDia(ahora), idxDia(prog.inicio || ahora), ritmoRef(plan)).concat(yo);
    lista.sort((a, b) => b.pts - a.pts || (a.virtual ? 1 : 0) - (b.virtual ? 1 : 0) || (a.nombre < b.nombre ? -1 : 1));
    return lista.map((x, i) => ({ ...x, pos: i + 1 }));
  }

  return { MUNECOS_APP, DIA, idxDia, fechaDeIdx, diaSemana, LETRAS, NOMBRES_DIA, mmss, progVacio, limpiarApodo, apodoValido, normalizarProg, fusionar, diasActivos, racha, bonusRacha, completarSesion, completarDrill, totales, semanaDe, calendario, numeroDeDia, nivelDe, sesionesDe, siguienteSesion, buscarSesion, buscarDrill, nombreTipo, ejercicio, munecoDe, munecosDelPlan, pasosDe, segDe, segTotales, proximoTrabajo, minutosDe, hash32, ritmoRef, rivales, ranking };
})();
