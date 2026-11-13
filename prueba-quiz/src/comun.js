/* Código común de todas las páginas: precios, envíos mínimos, contador, pie y bloques que leen DATOS. */
const P = { base: DATOS.precios.principal, b1: DATOS.precios.back1, b2: DATOS.precios.back2 };
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const vib = (n = 12) => { try { navigator.vibrate && navigator.vibrate(n); } catch (e) {} };
const guardar = (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const leer = (k, d) => { try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const A = leer('bc_resp', {});            // respuestas del quiz (solo en esta sesión del navegador)
const guardaA = () => guardar('bc_resp', A);

/* Envíos: solo «lead» (nombre y mail) y «click» (precio y campaña, sin datos personales). Nada más sale del navegador. */
window.__send = (k, d) => {
  if (k !== 'lead' && k !== 'click') return;
  try { navigator.sendBeacon('/api/' + k, new Blob([JSON.stringify(d)], { type: 'application/json' })); } catch (e) {}
};

/* ---------- Campaña (UTM), acceso y funnel ---------- */
const FUNNEL = location.pathname.indexOf('-peso') >= 0 ? 'peso' : 'peleador';   // los de bajar de peso terminan en «-peso»
const CLAVES_CAMPANA = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'ttclid', 'gclid'];
const VIDA_CAMPANA = 30 * 24 * 60 * 60 * 1000;                                 // la campaña se recuerda 30 días
const RE_ACCESO = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const lsLeer = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsGuardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const corto = (v) => String(v == null ? '' : v).trim().slice(0, 500);          // Hilvapay acepta hasta 500 caracteres por valor

function campanaGuardada() {
  try {
    const v = JSON.parse(lsLeer('bc_utm') || 'null');
    if (v && typeof v === 'object' && Date.now() - (+v.ts || 0) < VIDA_CAMPANA) return v;
  } catch (e) {}
  return {};
}

/* Si la dirección trae campaña, se guarda en bc_utm pisando lo anterior (fbc = fb.1.<ahora>.<fbclid> solo con un fbclid nuevo). Sin campaña en la dirección queda lo guardado. */
function capturaCampana() {
  const previa = campanaGuardada();
  const q = new URLSearchParams(location.search);
  const nueva = {};
  CLAVES_CAMPANA.forEach((k) => { const v = corto(q.get(k)); if (v) nueva[k] = v; });
  if (!Object.keys(nueva).length) return previa;
  if (nueva.fbclid) nueva.fbc = previa.fbclid === nueva.fbclid && previa.fbc ? previa.fbc : 'fb.1.' + Date.now() + '.' + nueva.fbclid;
  const mismo = Object.keys(nueva).length === Object.keys(previa).filter((k) => k !== 'ts').length && Object.keys(nueva).every((k) => nueva[k] === previa[k]);
  nueva.ts = mismo && previa.ts ? previa.ts : Date.now();                       // la misma campaña vista de nuevo no renueva los 30 días
  lsGuardar('bc_utm', JSON.stringify(nueva));
  return nueva;
}
const CAMPANA = capturaCampana();

/* «?utm_source=…&fbclid=…» con la campaña guardada, o '' si no hay: se suma a los links internos del funnel (quiz → oferta → back1 → back2). */
function consultaCampana() {
  const p = new URLSearchParams();
  CLAVES_CAMPANA.forEach((k) => { if (CAMPANA[k]) p.set(k, corto(CAMPANA[k])); });
  const s = p.toString();
  return s ? '?' + s : '';
}

function nuevoUuid() {
  try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
  const b = new Uint8Array(16);
  try { crypto.getRandomValues(b); } catch (e) { for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256); }
  b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;                            // UUID v4
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
}
/* Acceso personal del comprador (bc_acceso): se crea una sola vez, al tocar «Ir al pago», y viaja en el link de pago. Sin crear, devuelve lo que haya o ''. */
function accesoGuardado(crear) {
  let a = lsLeer('bc_acceso') || '';
  if (!RE_ACCESO.test(a)) { a = crear ? nuevoUuid() : ''; if (a) lsGuardar('bc_acceso', a); }
  return a;
}

/* Nivel de carga elegido en la pregunta «tiempo»: Arranque t1, Ritmo t2, Impulso t3, Fighter t4. */
const NIVEL_DE_TIEMPO = { Arranque: 't1', Ritmo: 't2', Impulso: 't3', Fighter: 't4' };
const nivelElegido = () => NIVEL_DE_TIEMPO[String(A.tiempo || '').split(' · ')[0].trim()] || '';

/* Video silencioso (fondo del quiz y oferta) que arranca solo, también en iOS: muted, playsinline y autoplay como atributos (Safari los pide así), loop, precarga y póster.
   Nunca lleva sonido. Con el ahorro de batería de iOS el autoplay puede bloquearse: ahí se ve el póster y el video arranca con el primer toque. */
function videoSilencioso(v, poster) {
  v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true; v.autoplay = true; v.preload = 'auto';
  ['muted', 'loop', 'playsinline', 'webkit-playsinline', 'autoplay', 'disablepictureinpicture'].forEach((a) => v.setAttribute(a, ''));
  v.setAttribute('preload', 'auto');
  v.setAttribute('aria-hidden', 'true'); v.tabIndex = -1;                       // decorativo: ni el lector de pantalla ni el teclado pasan por acá
  if (poster) v.poster = poster;
  return v;
}
['touchstart', 'pointerdown'].forEach((ev) => window.addEventListener(ev, () => {
  document.querySelectorAll('video').forEach((v) => { if (v.isConnected && v.paused && !v.ended) v.play().catch(() => {}); });
}, { passive: true }));

/* Contadores: cada página tiene el suyo y se reinicia al llegar a cero. /oferta 10:00, /back1 09:57, /back2 04:57. */
const CICLOS = { oferta: 600, back1: 597, back2: 297 };
function tiempoRestante(clave = 'oferta') {
  const ciclo = CICLOS[clave] || 600;
  const ini = leer('bc_t0_' + clave, 0);
  const ahora = Math.floor(Date.now() / 1000);
  if (!ini) { guardar('bc_t0_' + clave, ahora); return ciclo; }
  return ciclo - ((ahora - ini) % ciclo);
}
const fmt = (n) => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
function arrancaContador(clave = 'oferta') {
  const pinta = () => document.querySelectorAll('.tm').forEach((e) => (e.textContent = fmt(tiempoRestante(clave))));
  pinta(); setInterval(pinta, 1000);
}

/* Cada pantalla nueva del quiz lleva el foco a su título (sin scroll), para el teclado y los lectores de pantalla. En compu, las pantallas con un campo enfocan el campo;
   en celular no, porque abriría el teclado y taparía la pantalla. El título cuenta como encabezado de primer nivel sin cambiar su aspecto. */
function enfocaTitulo(raiz, campo) {
  const t = raiz.querySelector('h2');
  if (t) { t.setAttribute('aria-level', '1'); t.tabIndex = -1; }
  const aqui = campo && window.matchMedia && window.matchMedia('(hover:hover)').matches ? campo : t;
  try { if (aqui) aqui.focus({ preventScroll: true }); } catch (e) {}
}

/* Aviso breve que aparece y se va (por ejemplo «Plan ajustado a tu rutina»). */
window.toast = (m) => {
  const t = document.createElement('div');
  t.className = 'toast abajo'; t.textContent = m; t.setAttribute('role', 'status');
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('in'), 20);
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, 1700);
  vib(8);
};

/* Pie legal con enlaces a Términos y Privacidad (los avisos legales van solo acá).
   Por defecto es fijo (el quiz). Con fin = true va al final de la página, dentro de #app, sin posición fija: así la barra de abajo de las ofertas no lo tapa.
   Con nueva = true los enlaces abren en otra pestaña, para no perder el quiz ni la oferta. */
function pie(fin = false, nueva = false, solo_enlaces = false) {
  const f = document.createElement('footer');
  f.className = fin ? 'ft fin' : 'ft';
  const blank = nueva ? ' target="_blank" rel="noopener"' : '';
  const aviso = solo_enlaces ? '' : ' · Para mayores de 18. Las rutinas no reemplazan a un profesional de la salud; consultá antes de entrenar si tenés una lesión.';
  f.innerHTML = `<a href="/legal/terminos/"${blank}>Términos y condiciones</a> · <a href="/legal/privacidad/"${blank}>Política de privacidad</a>${aviso}`;
  if (fin && $('app')) { $('app').appendChild(f); return f; }
  document.body.appendChild(f);
  /* El alto del pie cambia con el ancho de la ventana: el contenido deja justo ese lugar abajo (--pie). */
  const ajusta = () => document.documentElement.style.setProperty('--pie', f.offsetHeight + 'px');
  ajusta();
  window.addEventListener('resize', ajusta, { passive: true });
  return f;
}

/* Detalle de una tarjeta («2-3 días · 15-30 min»): con guiones y espacios que no cortan, solo puede partirse después del «·». */
const detalleSinCortes = (t) => String(t).replace(/-/g, '\u2011').replace(/ · /g, '\u00a0· ').replace(/(\d) min/g, '$1\u00a0min');

/* ---------- Bloques que leen DATOS (vacío = no se muestran) ---------- */
const svgMini = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const I_RELOJ = svgMini('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>');
const I_CANDADO = svgMini('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>');
const I_TILDE = svgMini('<path d="M5 12l5 5 9-10"/>');
const I_ESCUDO = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5l15 6v11c0 10-6 17-15 21C15 39 9 32 9 22V11z"/><path d="M17 24l5 5 9-10"/></svg>';
const I_REGALO = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="10" y="26" width="44" height="28" rx="4" fill="#fde68a"/><path d="M10 36h44M32 26v28"/><path d="M32 26c-5-12-16-8-12-3 2 3 8 3 12 3zM32 26c5-12 16-8 12-3-2 3-8 3-12 3z" fill="#fbbf24"/></svg>';

const estrellas = () => (DATOS.estrellas ? `<span class="estr">★★★★★</span> <b>${esc(DATOS.estrellas)}</b>` : '');
const pillPersonas = (txt = 'personas ya lo probaron') => (DATOS.personas ? `<div class="pill pill-c">${estrellas()} <span><b>+${esc(DATOS.personas)}</b> ${txt}</span></div>` : '');
const regaloFranja = () => `<div class="gift">${I_REGALO}<span>Al terminar el diagnóstico <b>te dejamos un regalo</b>. Ya está reservado para vos.</span></div>`;

/* Click corto de gota al elegir una opción (~90 ms): se sintetiza acá (sin archivos de terceros). Si el navegador no deja sonar, no pasa nada. */
let audioGota = null;
function sonidoGota() {
  try {
    audioGota = audioGota || new (window.AudioContext || window.webkitAudioContext)();
    if (audioGota.state === 'suspended') audioGota.resume();
    const t = audioGota.currentTime, o = audioGota.createOscillator(), g = audioGota.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(1100, t);
    o.frequency.exponentialRampToValueAtTime(260, t + 0.06);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g); g.connect(audioGota.destination);
    o.start(t); o.stop(t + 0.1);
  } catch (e) {}
}
/* Al tocar una opción: un anillo suave que se expande desde su centro, sincronizado con el sonido. */
function ondaYSonido(b) {
  b.classList.remove('onda'); void b.offsetWidth; b.classList.add('onda');
  sonidoGota();
}
/* Tarjeta compacta del especialista (foto, nombre con matrícula y título): la usan el quiz general y el de peso, debajo del regalo. */
const tarjetaMini = () => {
    const e = DATOS.especialista || {};
    if (!e.nombre) return '';
    const ini = e.nombre.split(/\s+/).filter((w) => !w.endsWith('.')).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    const foto = e.foto ? `<img src="${esc(e.foto)}" alt="${esc(e.nombre)}">` : esc(ini);
    return `<div class="esp-mini"><div class="av">${foto}</div><div><b>${esc(e.nombre)}${e.matricula ? ` · ${esc(e.matricula)}` : ''}</b><small>${esc(e.titulo)}${DATOS.diagnosticos ? ` · +${esc(DATOS.diagnosticos)} diagnósticos` : ''}</small></div></div>`;
};

function tarjetaEspecialista(compacta = false) {
  const e = DATOS.especialista || {};
  if (!e.nombre) return '';
  const ini = e.nombre.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const foto = e.foto ? `<img src="${esc(e.foto)}" alt="${esc(e.nombre)}">` : esc(ini);
  const lista = [e.universidad, ...(e.posgrados || [])].filter(Boolean).map((x) => `<li>${esc(x)}</li>`).join('');
  return `<div class="exp"><div class="av">${foto}</div><div class="nm">${esc(e.nombre)}</div><div class="ti">${esc(e.titulo)}</div>${e.matricula ? `<span class="mt">${esc(e.matricula)}</span>` : ''}${e.resumen ? `<p style="font-size:13px;color:var(--m);margin:8px 0 0">${esc(e.resumen)}</p>` : ''}${lista && !compacta ? `<ul>${lista}</ul>` : ''}${DATOS.diagnosticos ? `<div class="chips"><span>${estrellas() || I_TILDE} +${esc(DATOS.diagnosticos)} diagnósticos realizados</span></div>` : ''}</div>`;
}
/* Tarjeta grande del especialista con toda su formación (funnel de bajar de peso). Cada renglón entra con animación; con movimiento reducido queda quieta. */
function tarjetaMedico() {
  const e = DATOS.especialista || {};
  if (!e.nombre) return '';
  const birrete = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6"/></svg>';
  const medalla = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="9" r="6"/><path d="M9 14l-2 8 5-3 5 3-2-8"/></svg>';
  const filas = [
    e.resumen ? [medalla, e.resumen, 'res'] : null,
    e.universidad ? [birrete, 'Médico egresado de la ' + e.universidad, ''] : null,
    ...(e.posgrados || []).map((x) => [birrete, 'Posgrado en ' + x, '']),
  ].filter(Boolean);
  const foto = e.foto ? `<img src="${esc(e.foto)}" alt="${esc(e.nombre)}">` : `<i>${esc(e.nombre.split(/\s+/).map((p) => p[0]).slice(0, 2).join(''))}</i>`;
  return `<div class="med"><div class="med-foto"><span class="med-aro"></span>${foto}${e.matricula ? `<span class="med-mn">${esc(e.matricula)}</span>` : ''}</div>` +
    `<b class="med-nm">${esc(e.nombre)}</b><span class="med-ti">${esc(e.titulo)}</span>` +
    (filas.length ? `<ul class="med-l">${filas.map((f, i) => `<li class="${f[2]}" style="--i:${i}">${f[0]}<span>${esc(f[1])}</span></li>`).join('')}</ul>` : '') +
    (DATOS.diagnosticos ? `<span class="med-chip"><span class="estr">★</span> +${esc(DATOS.diagnosticos)} diagnósticos realizados</span>` : '') + '</div>';
}
const chipsGatillos = () => `<div class="chips"><span>${I_RELOJ} 3 minutos</span><span>${I_CANDADO} 100% privado</span><span>${I_TILDE} Sin costo</span></div>`;

function bloqueTestimonios(titulo = 'Lo que dicen quienes lo probaron') {
  if (!DATOS.testimonios.length) return '';
  return `<div class="box"><b>${titulo}</b>${DATOS.testimonios.map((t) => `<div class="test2"><div class="av" style="width:42px;height:42px;font-size:16px;margin:0;box-shadow:none;border:0">${esc(String(t.nombre || '?')[0])}</div><div><b>${esc(t.nombre)}</b>${t.detalle ? ` · <span>${esc(t.detalle)}</span>` : ''}${DATOS.estrellas ? ' <span class="estr" style="font-size:12px">★★★★★</span>' : ''}<br><span>“${esc(t.texto)}”</span></div></div>`).join('')}</div>`;
}

function tarjetaNoticia() {
  const n = DATOS.noticia || {};
  if (!n.titular) return '';
  const img = n.imagen ? `<img src="${esc(n.imagen)}" alt="">` : ICONO.pulmon.replace('<svg', '<svg style="stroke:#fff"');
  return `<div class="nota"><div class="im">${img}</div><div class="tx"><div class="et">${esc(n.etiqueta)}</div><h3>${esc(n.titular)}</h3>${n.bajada ? `<p>${esc(n.bajada)}</p>` : ''}${n.cuerpo ? `<p class="cu">${esc(n.cuerpo)}</p>` : ''}<div class="fu">${esc(n.fuente)}${n.fecha ? ' · ' + esc(n.fecha) : ''}${n.enlace ? ` · <a href="${esc(n.enlace)}" target="_blank" rel="noopener noreferrer">Ver el estudio</a>` : ''}</div></div></div>`;
}

/* Link de Hilvapay con todo lo que se sabe de la persona (solo lo que tenga valor, cada uno de hasta 500 caracteres):
   acceso, funnel, nivel, pagina, nombre, email y la campaña (utm_*, fbclid, fbc, ttclid, gclid). Lo que ya traiga el link base no se pisa. */
function urlPago(base, pagina) {
  let u;
  try { u = new URL(base, location.href); } catch (e) { return ''; }
  const nombre = A.nombre && A.nombre !== 'Campeón' ? A.nombre : '';             // «Campeón» es el nombre de relleno del quiz, no el de la persona
  const mail = /^\S+@\S+\.\S+$/.test(A.mail || '') ? A.mail : '';
  const extra = { acceso: accesoGuardado(true), funnel: FUNNEL, nivel: nivelElegido(), pagina, nombre, email: mail };
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'fbc', 'ttclid', 'gclid'].forEach((k) => { extra[k] = CAMPANA[k]; });
  Object.keys(extra).forEach((k) => { const v = corto(extra[k]); if (v && !u.searchParams.has(k)) u.searchParams.set(k, v); });
  return u.toString();
}

/* Un solo punto de pago: DATOS.pagoUrl tiene un link por precio (base, b1, b2). Con el link vacío no se cobra nada: se muestra «Todavía no abrimos el pago» y se cuenta el clic.
   El clic viaja con funnel, página y campaña (sin datos personales). */
function pagar(precio) {
  const clave = Object.keys(P).find((k) => P[k] === precio) || 'base';
  const pagina = typeof PAGINA === 'string' ? PAGINA : '';
  const clic = { precio, funnel: FUNNEL, pagina };
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbc'].forEach((k) => { if (CAMPANA[k]) clic[k] = corto(CAMPANA[k]); });
  clic.t = Date.now();
  window.__send('click', clic);
  const base = DATOS.pagoUrl && DATOS.pagoUrl[clave];
  const destino = base ? urlPago(base, pagina) : '';
  if (destino) { location.href = destino; return; }
  const m = $('pg');
  if (m) m.innerHTML = '<b>Gracias por llegar hasta acá.</b><br><span style="color:var(--m);font-size:14px">Todavía no abrimos el pago, así que no se cobró nada. Registramos tu interés.</span>';
}
function reservar(clave) {
  const pr = P[clave] || clave;
  document.querySelectorAll('.sticky,#fin').forEach((e) => e.remove());
  const f = document.createElement('div');
  f.id = 'fin';
  f.style.cssText = 'position:fixed;inset:0;z-index:80;background:#fff;overflow:auto;padding:24px 20px 90px';
  const mail = A.mail ? esc(A.mail) : '';
  f.innerHTML = `<div style="max-width:520px;margin:0 auto"><div class="tag">Último paso</div><h1>Reservá tu lugar</h1><p style="color:var(--m)">Plan de 4 semanas de shadowboxing en casa, con timer de rounds y rutinas guiadas.</p><div class="box"><div class="row"><span>BeastCamp Sombra</span><b>${pr}</b></div>${mail ? `<div class="row" style="margin-top:8px"><span>Tu mail</span><b>${mail}</b></div>` : ''}<div class="note">Pago único · Acceso inmediato · Sin suscripción</div><div class="badge">Garantía de devolución · ${DATOS.garantiaDias} días</div></div><div class="box" id="pg"></div><button class="cta" id="pgb">Ir al pago</button><a class="cta s" href="#" id="pgv">Volver</a></div>`;
  f.querySelector('#pgb').onclick = () => pagar(pr);
  f.querySelector('#pgv').onclick = (e) => { e.preventDefault(); f.remove(); };
  document.body.appendChild(f);
  f.scrollTop = 0;
}

if (typeof module !== 'undefined') module.exports = { P };
