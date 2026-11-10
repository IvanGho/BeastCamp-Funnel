/* Reproductor de sesiones y drills: timer por fases, pitidos (Web Audio), vibración, voz, pantalla prendida y celebración final.
   El tiempo se calcula contra el reloj (no contando ticks): anda igual con la pantalla apagada o la pestaña en segundo plano. */
let R = null;   // reproductor activo
const CIRC = 2 * Math.PI * 88;
const PREP_SEG = 5;

/* ---------- sonido, voz, vibración, pantalla prendida ---------- */
let AC = null;
function audioDesbloquear() {
  try { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; AC = AC || new C(); if (AC.state === 'suspended') AC.resume(); } catch (e) {}
}
function tono(f, dur = 0.18, vol = 0.25, t0 = 0) {
  if (!AC || !AJ().sonido) return;
  try {
    const t = AC.currentTime + t0, o = AC.createOscillator(), g = AC.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch (e) {}
}
const SON = {
  cuenta: () => tono(880, 0.12),
  trabajo: () => { tono(988, 0.14); tono(1319, 0.3, 0.25, 0.16); },
  descanso: () => { tono(587, 0.2); tono(440, 0.35, 0.22, 0.2); },
  aviso: () => { tono(740, 0.1); tono(740, 0.1, 0.25, 0.17); },
  fin: () => [523, 659, 784, 1047].forEach((f, i) => tono(f, 0.3, 0.25, i * 0.18)),
};
function hablar(t) {
  if (!AJ().voz || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t), vs = speechSynthesis.getVoices();
    u.lang = 'es-AR'; u.rate = 1.05;
    const v = vs.find((x) => /^es[-_]AR/i.test(x.lang)) || vs.find((x) => /^es/i.test(x.lang));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) {}
}
let wake = null;
async function pedirWake() {
  try { if (navigator.wakeLock && document.visibilityState === 'visible') { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) { wake = null; }
}
function soltarWake() { try { if (wake) wake.release(); } catch (e) {} wake = null; }
document.addEventListener('visibilitychange', () => { if (R && document.visibilityState === 'visible' && !wake) pedirWake(); });

/* ---------- armado ---------- */
function iniciarReproductor(item, kind, desde = 0) {
  const pasos = [{ t: 'prep', seg: PREP_SEG, ej: '' }].concat(NUCLEO.pasosDe(item, PLAN));
  if (pasos.length < 2) { toast('Esta sesión no tiene ejercicios'); return; }
  detenerReproductor(false);
  audioDesbloquear();
  const ahora = Date.now();
  R = { item, kind, pasos, i: -1, corriendo: true, finMs: ahora, restanteMs: 0, total: 0, t0: ahora, activoMs: 0, ultimoSeg: null, aviso10: false, raf: 0, intv: 0, claveZona: '', fin: false, totTrab: pasos.filter((p) => p.t === 'trabajo').length, sigueCombo: -1 };
  pedirWake();
  pintarReproductor();
  entrar(desde > 0 && desde < pasos.length ? desde : 0, false);
  R.intv = setInterval(tick, 250);
  const raf = () => { if (!R) return; tick(); R.raf = requestAnimationFrame(raf); };
  R.raf = requestAnimationFrame(raf);
}
function detenerReproductor(guardarCurso = true) {
  if (!R) return;
  if (guardarCurso && !R.fin) guardarCursoActual();
  clearInterval(R.intv); cancelAnimationFrame(R.raf);
  soltarWake();
  try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) {}
  const v = document.querySelector('#p-zona video'); if (v) v.pause();
  document.body.classList.remove('jugando');
  R = null;
}
function guardarCursoActual() {
  if (!R) return;
  if (R.i <= 0) { ls.del(K.curso); return; }
  ls.set(K.curso, { k: R.kind, id: R.item.id, idx: R.i, ts: Date.now() });
}

const restanteMs = () => (R.corriendo ? Math.max(0, R.finMs - Date.now()) : R.restanteMs);
const esUltimo = () => !R.pasos.slice(R.i + 1).some((p) => p.t === 'trabajo');

/* Tiempo que de verdad se entrenó en el paso actual (para los minutos del progreso). */
function sumarActivo(auto) {
  const p = R.pasos[R.i];
  if (!p || p.t === 'prep') return;
  const tot = N.segDe(p) * 1000;
  const usado = auto ? tot : p.seg > 0 ? tot - restanteMs() : Math.min(tot, Date.now() - R.t0);
  R.activoMs += Math.max(0, Math.min(tot, usado));
}
/* Entra a un paso. `auto`: terminó solo el anterior, el tiempo sigue contando desde donde debía (aunque la pantalla estuviera apagada). */
function entrar(i, auto) {
  const ahora = Date.now();
  if (R.i >= 0) sumarActivo(auto);
  R.i = i;
  const p = R.pasos[i], base = auto && R.corriendo ? R.finMs : ahora;
  R.ultimoSeg = null; R.aviso10 = false; R.t0 = base;
  if (p.seg > 0) { R.total = p.seg * 1000; R.restanteMs = R.total; R.finMs = base + R.total; } else { R.total = 0; R.restanteMs = 0; }
  const reciente = ahora - base < 1500;   // si se atrasó mucho (pantalla apagada) no suena ni habla cada paso salteado
  pintarPaso();
  if (p.t !== 'prep') guardarCursoActual();
  if (reciente || !auto) efectosDePaso(p);
  tick();
}
function efectosDePaso(p) {
  if (p.t === 'trabajo') {
    SON.trabajo(); vibrar([120, 60, 120]);
    hablar(p.seg > 0 ? `${p.nombre}. ${p.seg} segundos.` : `${p.nombre}. ${p.reps} repeticiones.`);
    anunciar(`Trabajo. ${p.nombre}. ${p.seg > 0 ? p.seg + ' segundos' : p.reps + ' repeticiones'}.${p.rondas > 1 ? ` Ronda ${p.ronda} de ${p.rondas}.` : ''}`);
  } else if (p.t === 'descanso') {
    SON.descanso(); vibrar(220);
    const sig = N.proximoTrabajo(R.pasos, R.i);
    hablar(`Descanso. ${p.seg} segundos.`);
    anunciar(`Descanso. ${p.seg} segundos.${sig ? ' Sigue: ' + sig.nombre + '.' : ''}`);
  } else {
    SON.cuenta(); hablar('Preparate'); anunciar(`Preparate. Empezamos en ${p.seg} segundos.`);
  }
}
function siguiente(auto = false) {
  if (!R || R.fin) return;
  if (R.i >= R.pasos.length - 1) { sumarActivo(auto); terminarSesion(); return; }
  entrar(R.i + 1, auto);
}
function atras() {
  if (!R) return;
  const enPaso = R.total ? R.total - restanteMs() : Date.now() - R.t0;
  entrar(enPaso > 3000 ? R.i : Math.max(0, R.i - 1), false);   // si ya avanzó, vuelve al inicio del paso; si recién empezó, al anterior
}
function pausaPlay() {
  if (!R) return;
  const p = R.pasos[R.i];
  if (p.t === 'trabajo' && !(p.seg > 0)) return hecho();
  if (R.corriendo) { R.restanteMs = Math.max(0, R.finMs - Date.now()); R.corriendo = false; try { speechSynthesis.cancel(); } catch (e) {} anunciar('En pausa'); }
  else { R.finMs = Date.now() + R.restanteMs; R.corriendo = true; pedirWake(); audioDesbloquear(); anunciar('Seguimos'); }
  pintarControles(); tick();
}
function hecho() { if (R) siguiente(false); }

/* ---------- reloj ---------- */
let ultimoPintado = '';
function tick() {
  if (!R || R.fin) return;
  const p = R.pasos[R.i];
  if (!p) return;
  if (R.corriendo && p.seg > 0) {
    let guarda = 0;
    while (R && !R.fin && R.corriendo && R.pasos[R.i].seg > 0 && R.finMs <= Date.now() && guarda++ < 400) siguiente(true);
    if (!R || R.fin) return;
  }
  const q = R.pasos[R.i];
  const resto = q.seg > 0 ? restanteMs() : 0, s = Math.ceil(resto / 1000);
  if (q.seg > 0) {
    const tt = document.getElementById('p-t');
    if (tt) {
      const txt = N.mmss(s);
      if (txt !== ultimoPintado) { tt.textContent = txt; ultimoPintado = txt; }
      tt.dataset.restante = s;
    }
    const aro = document.getElementById('p-aro');
    if (aro && !document.hidden) {
      const frac = movimientoReducido() ? s * 1000 / R.total : resto / R.total;
      aro.style.strokeDashoffset = CIRC * (1 - Math.min(1, Math.max(0, frac)));
    }
    if (R.corriendo) avisos(q, s);
    combo(q);
  }
}
/* Cuenta de 3, 2, 1 y aviso 10 segundos antes del final (de la fase, o de la sesión si es el último ejercicio). */
function avisos(p, s) {
  if (s !== R.ultimoSeg) {
    R.ultimoSeg = s;
    if (s >= 1 && s <= 3 && p.seg > 4) { SON.cuenta(); vibrar(25); }
  }
  if (!R.aviso10 && s <= 10 && s > 3 && p.seg >= 25) {
    R.aviso10 = true;
    const ult = p.t === 'trabajo' && esUltimo();
    SON.aviso();
    hablar(ult ? 'Diez segundos para terminar' : 'Diez segundos');
    anunciar(ult ? 'Diez segundos para terminar la sesión' : 'Diez segundos para el final de esta fase');
    const w = document.getElementById('anillo-w'); if (w) w.classList.add('alerta');
  }
}
/* El combo se «marca» golpe a golpe a ritmo parejo (solo informativo: ayuda a llevar la cadencia). */
function combo(p) {
  const c = document.getElementById('p-combo');
  if (!c || p.t !== 'trabajo' || !p.combo || movimientoReducido()) return;
  const k = Math.floor((Date.now() - R.t0) / 800) % p.combo.split('-').length;
  if (k !== R.sigueCombo) { R.sigueCombo = k; [...c.children].forEach((e, i) => e.classList.toggle('on', i === k)); }
}

/* ---------- pantalla ---------- */
function pintarReproductor() {
  document.body.classList.add('jugando');
  $('nav').hidden = true;
  const m = $('vista');
  m.className = 'ap';
  m.innerHTML = `<div class="pg play" id="play"><div class="prog" aria-hidden="true"><i id="barra"></i></div>
    <header class="ptop"><button class="bt" data-a="p-salir" aria-label="Salir de la sesión">${ico('cerrar')}</button>
      <div class="ptit"><b>${esc(R.item.titulo)}</b><small id="p-cont" aria-live="off"></small></div>
      <button class="bt" data-a="p-sonido" aria-label="Sonido" aria-pressed="${!!AJ().sonido}"></button><button class="bt" data-a="p-voz" aria-label="Voz" aria-pressed="${!!AJ().voz}"></button></header>
    <div class="zona" id="p-zona"></div>
    <div class="fase"><span class="faset" id="p-ftag"></span><span class="ronda" id="p-ronda"></span></div>
    <h1 class="pnom" id="p-nom" tabindex="-1"></h1>
    <div class="combo" id="p-combo" hidden></div>
    <p class="nota-p" id="p-nota"></p>
    <div class="anillo-w" id="anillo-w"><svg class="anillo" viewBox="0 0 200 200" aria-hidden="true"><defs><linearGradient id="gr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4ade80"/><stop offset="1" stop-color="#16A34A"/></linearGradient></defs><circle class="pista" cx="100" cy="100" r="88"/><circle class="aro" id="p-aro" cx="100" cy="100" r="88" style="stroke-dasharray:${CIRC};stroke-dashoffset:0"/></svg>
      <div class="anillo-c"><b id="p-t" role="timer" aria-live="off">00:00</b><small id="p-ts"></small></div></div>
    <div class="sigue" id="p-sigue"></div>
    <div class="ctl"><button class="bt ctl-b" data-a="p-atras" aria-label="Paso anterior">${ico('anterior')}<small>Atrás</small></button>
      <button class="bt ctl-pp" id="p-pp" data-a="p-pp" aria-label="Pausar"></button>
      <button class="bt ctl-b" data-a="p-sig" aria-label="Saltar este paso">${ico('siguiente')}<small>Saltar</small></button></div></div>`;
  pintarAjustesTop();
  scrollTo(0, 0);
}
function pintarAjustesTop() {
  const s = document.querySelector('[data-a="p-sonido"]'), v = document.querySelector('[data-a="p-voz"]');
  if (s) { s.innerHTML = ico(AJ().sonido ? 'sonido' : 'silencio'); s.setAttribute('aria-pressed', !!AJ().sonido); s.setAttribute('aria-label', AJ().sonido ? 'Sonido activado' : 'Sonido apagado'); }
  if (v) { v.innerHTML = ico('voz'); v.classList.toggle('apagado', !AJ().voz); v.setAttribute('aria-pressed', !!AJ().voz); v.setAttribute('aria-label', AJ().voz ? 'Voz activada' : 'Voz apagada'); }
}
function pintarControles() {
  const b = document.getElementById('p-pp'), p = R.pasos[R.i];
  if (!b) return;
  const reps = p.t === 'trabajo' && !(p.seg > 0);
  b.innerHTML = reps ? ico('tilde') : ico(R.corriendo ? 'pausa' : 'play');
  b.setAttribute('aria-label', reps ? 'Hecho' : R.corriendo ? 'Pausar' : 'Seguir');
  b.classList.toggle('en-pausa', !R.corriendo && !reps);
  const play = document.getElementById('play'); if (play) play.classList.toggle('pausado', !R.corriendo && !reps);
}
function zonaDe(ej, mostrarVideo) {
  const como = ej.como || [];
  if (mostrarVideo && ej.video) return `<video class="zv" src="${esc(ej.video)}" muted loop playsinline preload="metadata"></video>`;
  return `<div class="zona-m">${mun(ej.muneco || 'm_golpes')}</div><div class="zona-x" tabindex="0" role="region" aria-label="Cómo se hace ${esc(ej.nombre || 'el ejercicio')}"><span class="zona-et">${ico('guante')} Cómo se hace</span><ul>${como.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>${ej.cuidado ? `<p class="cuid"><b>Cuidado:</b> ${esc(ej.cuidado)}</p>` : ''}</div>`;
}
function pintarPaso() {
  const p = R.pasos[R.i], pl = PLAN;
  const sig = N.proximoTrabajo(R.pasos, R.i), actual = p.t === 'prep' ? sig : p.t === 'descanso' ? (sig || p) : p;
  const ej = actual ? N.ejercicio(pl, actual.ej) : { como: [], muneco: 'm_golpes' };
  const play = document.getElementById('play');
  play.dataset.fase = p.t;
  play.classList.remove('alerta');
  const aw = document.getElementById('anillo-w'); if (aw) aw.classList.remove('alerta');
  // zona de video o muñeco con indicaciones: solo se rearma si cambió el ejercicio o el tipo de fase
  const clave = (p.t === 'trabajo' ? 'T' : 'D') + (actual ? actual.ej : '');
  const zona = document.getElementById('p-zona');
  if (clave !== R.claveZona) {
    R.claveZona = clave;
    zona.className = 'zona ' + (p.t === 'trabajo' && ej.video ? 'convideo' : 'sinvideo');
    zona.innerHTML = zonaDe(ej, p.t === 'trabajo');
    const v = zona.querySelector('video'); if (v) { const j = v.play(); if (j && j.catch) j.catch(() => {}); }
    avisoDeScroll();
  } else { const v = zona.querySelector('video'); if (v && R.corriendo) { const j = v.play(); if (j && j.catch) j.catch(() => {}); } }
  const trabHechos = R.pasos.slice(0, R.i + (p.t === 'trabajo' ? 1 : 0)).filter((x) => x.t === 'trabajo').length;
  document.getElementById('p-cont').textContent = p.t === 'prep' ? `${R.totTrab} pasos` : `Paso ${Math.max(1, trabHechos)} de ${R.totTrab}`;
  document.getElementById('p-ftag').textContent = p.t === 'trabajo' ? 'Trabajo' : p.t === 'descanso' ? 'Descanso' : 'Preparate';
  document.getElementById('p-ronda').textContent = p.t !== 'prep' && p.rondas > 1 ? `Ronda ${p.ronda} de ${p.rondas}` : '';
  const nom = document.getElementById('p-nom');
  nom.textContent = p.t === 'trabajo' ? p.nombre : p.t === 'descanso' ? 'Respirá y soltá' : (sig ? `Primero: ${sig.nombre}` : 'Preparate');
  const c = document.getElementById('p-combo');
  if (p.t === 'trabajo' && p.combo) {
    const toks = p.combo.split('-');
    c.hidden = false; c.setAttribute('aria-label', 'Combo: ' + toks.join(', '));
    c.innerHTML = toks.map((t) => `<i>${esc(t)}</i>`).join('<u aria-hidden="true"></u>');
    R.sigueCombo = -1;
  } else { c.hidden = true; c.innerHTML = ''; }
  document.getElementById('p-nota').textContent = p.t === 'trabajo' ? p.nota || '' : p.t === 'descanso' ? 'Tomá aire por la nariz y soltalo despacio.' : 'Ponete en guardia. Arrancamos enseguida.';
  const tt = document.getElementById('p-t'), ts = document.getElementById('p-ts');
  if (p.seg > 0) { ts.textContent = 'segundos'; tt.classList.remove('reps'); }
  else { tt.textContent = p.reps; ts.textContent = 'repeticiones'; tt.classList.add('reps'); ultimoPintado = ''; document.getElementById('p-aro').style.strokeDashoffset = 0; }
  // qué sigue
  const prox = R.pasos[R.i + 1], sg = document.getElementById('p-sigue');
  if (!prox) sg.innerHTML = `<span class="sg-t">${ico('tilde')}<b>Último paso. ¡Casi está!</b></span>`;
  else {
    const t = p.t === 'descanso' || p.t === 'prep' ? prox : (prox.t === 'descanso' ? N.proximoTrabajo(R.pasos, R.i) : prox);
    const m2 = N.ejercicio(pl, t ? t.ej : '').muneco;
    sg.innerHTML = t ? `<span class="sg-im">${mun(m2, 'im3d mini', 120, 160)}</span><span class="sg-x"><small>${p.t === 'descanso' || p.t === 'prep' ? 'Sigue' : prox.t === 'descanso' ? `Descanso de ${prox.seg} s y sigue` : 'Sigue'}</small><b>${esc(t.nombre)}</b><small>${t.seg > 0 ? t.seg + ' s' : t.reps + ' repeticiones'}${t.combo ? ' · combo ' + esc(t.combo) : ''}</small></span>` : `<span class="sg-t">${ico('tilde')}<b>Último paso. ¡Casi está!</b></span>`;
  }
  pintarControles();
  // barra de avance de toda la sesión, por tiempo
  const tot = N.segTotales(R.pasos.slice(1)) || 1, hechoS = N.segTotales(R.pasos.slice(1, Math.max(1, R.i)));
  const b = document.getElementById('barra'); if (b) b.style.width = Math.min(100, (hechoS / tot) * 100) + '%';
}

/* Si las indicaciones no entran en el cuadro, se desplazan; un degradado abajo avisa que hay más y se va al llegar al final. */
function avisoDeScroll() {
  const x = document.querySelector('#p-zona .zona-x');
  if (!x) return;
  const f = () => x.classList.toggle('mas', x.scrollHeight > x.clientHeight + 2 && x.scrollTop + x.clientHeight < x.scrollHeight - 2);
  x.addEventListener('scroll', f, { passive: true });
  f(); requestAnimationFrame(f); setTimeout(f, 300);
}
addEventListener('resize', () => { if (R) avisoDeScroll(); });

/* ---------- final y celebración ---------- */
function terminarSesion() {
  if (!R || R.fin) return;
  R.fin = true;
  const { item, kind } = R, min = Math.min(R.activoMs / 60000, (item.minutos || 60) * 1.5);
  const ahora = Date.now();
  const res = kind === 's' ? N.completarSesion(PROG, item, ahora, min) : N.completarDrill(PROG, item, ahora);
  guardarProg();
  ls.del(K.curso);
  detenerReproductor(false);
  SON.fin(); vibrar([200, 80, 200, 80, 400]); hablar('Sesión completa. Muy bien.');
  pintarFiesta(res, item, kind, Math.max(1, Math.round(min)));
}
function pintarFiesta(res, item, kind, min) {
  $('nav').hidden = true;
  const nombre = ESTADO.nombre || PROG.apodo || 'campeón';
  const conf = Array.from({ length: 30 }, (_, i) => `<i style="left:${(i * 37 + 11) % 100}%;--d:${((i * 53) % 18) / 10}s;--t:${2.6 + ((i * 29) % 14) / 10}s;--c:${['#16A34A', '#4ade80', '#f5a623', '#0b0f0c', '#fde68a'][i % 5]};--x:${((i * 17) % 40) - 20}px;--r:${(i * 47) % 360}deg"></i>`).join('');
  const m = $('vista'); m.className = 'ap sinnav';
  m.innerHTML = `<div class="pg fiesta" role="region" aria-label="Sesión completa"><div class="confeti" aria-hidden="true">${conf}</div>
    <div class="check-w"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="c-pista" cx="60" cy="60" r="52"/><circle class="c-aro" cx="60" cy="60" r="52"/><path class="c-tilde" d="M37 62l15 15 31-33"/></svg></div>
    <p class="tag">${kind === 's' ? 'Sesión completa' : 'Drill completo'}</p>
    <h1 tabindex="-1">¡Muy bien, ${esc(nombre)}!</h1>
    <div class="pts-g"><b id="f-pts" aria-hidden="true">0</b><span>${res.pts ? 'puntos sumados' : 'puntos'}</span></div>
    <span class="sr">Sumaste ${res.pts} puntos.</span>
    <p class="sm cen">${res.repetida ? (kind === 's' ? 'Ya tenías esta sesión hecha: repetirla suma práctica, no puntos.' : 'Hoy ya habías sumado los puntos de este drill.') : (res.bonus ? `${fnum(res.base)} de la ${kind === 's' ? 'sesión' : 'práctica'} + ${res.bonus} de bonus por tu racha.` : `${fnum(res.base)} por completar ${kind === 's' ? 'la sesión' : 'el drill'}.`)}</p>
    <div class="chips"><span>${ico('flama')} Racha: ${plural(res.racha.dias, 'día', 'días')}</span><span>${ico('reloj')} ${min} min</span><span>${ico('rayo')} ${fnum(N.totales(PROG).puntos)} pts en total</span></div>
    <div class="f-mun">${mun('o_competir')}</div>
    <div class="f-bt"><button class="cta" data-a="ir-hoy">Volver a Hoy</button><a class="cta s" href="#/progreso">Ver mi progreso</a></div></div>`;
  scrollTo(0, 0);
  contar($('f-pts'), res.pts);
  anunciar(`Sesión completa. Sumaste ${res.pts} puntos. Racha de ${res.racha.dias} días.`);
  const h = m.querySelector('h1'); if (h) h.focus({ preventScroll: true });
}
