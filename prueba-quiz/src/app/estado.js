/* Estado de la app: acceso, almacenamiento local, llamadas a la API, progreso con subida diferida y cola sin conexión,
   instalación (Android, iPhone, navegador de Instagram o Facebook) y service worker. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ACC = (() => { const m = location.pathname.match(/^\/app\/([^/]+)\/?/); return m && UUID.test(m[1]) ? m[1] : ''; })();
const K = { ultimo: 'bc_app_ultimo', estado: `bc_app_${ACC}_estado`, prog: `bc_app_${ACC}_prog`, cola: `bc_app_${ACC}_cola`, plan: `bc_app_${ACC}_plan`, curso: `bc_app_${ACC}_curso`, perfil: `bc_app_${ACC}_perfil` };

const ls = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  /* bc_app_ultimo es texto plano (lo escribe también /gracias/): sin JSON */
  getRaw(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
  setRaw(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
};

let ESTADO = null;   // { estado, nombre, funnel, nivel, extras, ts }
let PLAN = null;     // lo que devuelve GET /api/app/<acceso>/plan
let PROG = null;     // progreso (versión 1 del contrato)
let ENLINEA = navigator.onLine !== false;

function marcarRed(ok) {
  if (ok === ENLINEA) return;
  ENLINEA = ok;
  if (typeof pintarAviso === 'function') pintarAviso();
}

/* Pedido a la API: nunca lanza. status 0 = sin red o tiempo agotado. `cache` = lo sirvió el service worker desde su copia. */
async function api(ruta, { metodo = 'GET', cuerpo, plazo = 8000 } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), plazo);
  try {
    const r = await fetch(ruta, { method: metodo, headers: cuerpo ? { 'content-type': 'application/json' } : undefined, body: cuerpo ? JSON.stringify(cuerpo) : undefined, signal: ctl.signal, cache: 'no-store', credentials: 'omit', keepalive: metodo !== 'GET' });
    let datos = null;
    if (r.status !== 204) { try { datos = await r.json(); } catch (e) {} }
    const cache = !!r.headers.get('x-bc-cache');
    marcarRed(!cache);
    return { ok: r.ok, status: r.status, datos, cache };
  } catch (e) {
    marcarRed(false);
    return { ok: false, status: 0, datos: null, red: true };
  } finally { clearTimeout(t); }
}

/* ---------- progreso ---------- */
let subidaT = 0, subiendo = false, esperaReintento = 5000;
function guardarProg() {
  PROG.actualizado = Date.now();
  ls.set(K.prog, PROG);
  programarSubida();
}
function programarSubida(demora = 1500) { clearTimeout(subidaT); subidaT = setTimeout(subir, demora); }
/* Sube el progreso entero (PUT). Hasta que el servidor confirma queda copia en la cola; si no hay red, se reintenta al volver. */
async function subir() {
  subidaT = 0;
  if (!PROG || !PROG.inicio || !ACC) return;
  if (subiendo) { programarSubida(800); return; }
  subiendo = true;
  const foto = JSON.stringify(PROG);
  ls.set(K.cola, { ts: Date.now(), prog: PROG });
  const r = await api(`/api/app/${ACC}/progreso`, { metodo: 'PUT', cuerpo: PROG });
  subiendo = false;
  if (r.ok) { ls.del(K.cola); esperaReintento = 5000; if (JSON.stringify(PROG) !== foto) programarSubida(300); return; }
  if (r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429) {
    ls.del(K.cola);                               // el servidor no lo va a aceptar nunca: no trabar la cola
    if (r.status === 403 && typeof revisarAcceso === 'function') revisarAcceso();
    return;
  }
  programarSubida(esperaReintento);                 // sin red o servidor caído: queda en la cola y se reintenta, cada vez más espaciado
  esperaReintento = Math.min(60000, esperaReintento * 2);
}
const hayCola = () => !!ls.get(K.cola);
function vaciarCola() { if (hayCola()) subir(); }
addEventListener('online', () => { marcarRed(true); vaciarCola(); });
addEventListener('offline', () => marcarRed(false));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { vaciarCola(); if (typeof alVolver === 'function') alVolver(); } else if (subidaT) { clearTimeout(subidaT); subir(); } });
addEventListener('pagehide', () => { if (subidaT) { clearTimeout(subidaT); subir(); } });

/* ---------- estado y plan ---------- */
async function pedirEstado() { return api(`/api/app/${ACC}`); }
/* Perfil que se está mirando: el comprado (funnel) o un módulo extra comprado aparte (upsell). */
const PERFILES = ['peso', 'peleador'];
function perfilActual() {
  if (!ESTADO) return '';
  const p = ls.get(K.perfil);
  return p && (ESTADO.extras || []).includes(p) ? p : ESTADO.funnel;
}
async function pedirPlan() {
  const p = perfilActual();
  return api(`/api/app/${ACC}/plan` + (p && ESTADO && p !== ESTADO.funnel ? `?perfil=${p}` : ''), { plazo: 10000 });
}

/* Guarda lo que dijo el servidor y lo fusiona con el progreso local. */
function aplicarEstado(d) {
  ESTADO = { estado: d.estado, nombre: primerNombre(d.nombre || ''), funnel: d.funnel === 'peleador' ? 'peleador' : 'peso', nivel: /^t[1-4]$/.test(d.nivel) ? d.nivel : 't1', extras: Array.isArray(d.extras) ? d.extras.filter((x) => PERFILES.includes(x)) : [], ts: Date.now() };
  ls.set(K.estado, ESTADO);
  const sp = NUCLEO.normalizarProg(d.progreso);
  if (sp) {
    const f = NUCLEO.fusionar(PROG, sp);
    const cambio = JSON.stringify(f) !== JSON.stringify(PROG);
    PROG = f;
    if (cambio) ls.set(K.prog, PROG);
    if (JSON.stringify(f) !== JSON.stringify(sp)) programarSubida(600);   // lo local tiene algo que el servidor no
  }
}
function planValido(p) { return p && Array.isArray(p.niveles) && p.niveles.length && p.niveles.every((n) => n && Array.isArray(n.semanas)) && p.ejercicios && typeof p.ejercicios === 'object'; }
function guardarPlan(p) { ls.set(K.plan, p); }
function planGuardado() { const p = ls.get(K.plan); return planValido(p) ? p : null; }

/* Pide al service worker que guarde los muñecos del plan para usarlos sin conexión. */
function precargarMunecos() {
  if (!PLAN || !navigator.serviceWorker) return;
  const urls = NUCLEO.munecosDelPlan(PLAN).map((k) => `/img/muneco-${k}.webp`);
  navigator.serviceWorker.ready.then((reg) => reg.active && reg.active.postMessage({ type: 'precache', urls })).catch(() => {});
}

/* Borra todo lo de este acceso en este celu (progreso ya subido). */
async function olvidarEnEsteCelu() {
  Object.values(K).forEach((k) => { if (k !== K.ultimo || ls.getRaw(K.ultimo) === ACC) ls.del(k); });
  try {
    const c = await caches.open('bc-app-datos');
    await Promise.all([`/api/app/${ACC}`, `/api/app/${ACC}/plan`, ...PERFILES.map((p) => `/api/app/${ACC}/plan?perfil=${p}`)].map((u) => c.delete(u)));
  } catch (e) {}
}

/* ---------- instalación ---------- */
const UA = navigator.userAgent || '';
const ES_INAPP = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger|musical_ly|TikTok|Snapchat/i.test(UA);
const ES_IOS = /iPad|iPhone|iPod/.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const ES_ANDROID = /Android/i.test(UA);
const instalada = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } };
let promptInstalar = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); promptInstalar = e; repintarInstalar(); });
addEventListener('appinstalled', () => { promptInstalar = null; repintarInstalar(); if (typeof toast === 'function') toast('App instalada'); });
async function instalar() {
  if (!promptInstalar) return 'no';
  const e = promptInstalar; promptInstalar = null;
  try { await e.prompt(); const r = await e.userChoice; repintarInstalar(); return r.outcome; } catch (x) { return 'no'; }
}
const linkPersonal = () => location.origin + '/app/' + ACC + '/';

/* ---------- service worker (aviso de versión nueva, sin saltear la espera a ciegas) ---------- */
let swEsperando = null, actualizando = false;
function registrarSW() {
  if (!('serviceWorker' in navigator)) return;
  const nuevo = (w) => { swEsperando = w; if (typeof pintarAviso === 'function') pintarAviso(); };
  navigator.serviceWorker.register('/app/sw.js', { scope: '/app/' }).then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) nuevo(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (w) w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) nuevo(w); });
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (actualizando) location.reload(); });
}
function actualizarApp() {
  if (!swEsperando) return;
  actualizando = true;
  swEsperando.postMessage({ type: 'actualizar' });
}
