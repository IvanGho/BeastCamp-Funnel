/* Arranque, rutas por hash, acciones (data-a) y avisos de la app. */
const NAV = [['hoy', 'Hoy'], ['plan', 'Plan'], ['progreso', 'Progreso'], ['perfil', 'Perfil']];
const NAV_DE = { hoy: 'hoy', plan: 'plan', progreso: 'progreso', perfil: 'perfil', drills: 'hoy', guia: 'hoy' };
const TITULOS = { hoy: 'Hoy', plan: 'Tu plan', progreso: 'Tu progreso', perfil: 'Tu perfil', drills: 'Drills', guia: 'Tu guía', bienvenida: 'Bienvenida', sesion: 'Sesión', drill: 'Drill' };
let navCount = 0, claveRepro = '', BIEN = null, PEDIDO = null, ultimaRevalid = 0;

/* ---------- pintar ---------- */
function pintar(html, { nav = null, titulo = '' } = {}) {
  const m = $('vista');
  m.className = nav ? 'ap' : 'ap sinnav';
  m.innerHTML = `<div class="pg ${nav ? 'tab' : ''}">${html}</div>`;
  document.body.classList.remove('jugando');
  $('nav').hidden = !nav;
  if (nav) $$('#nav a').forEach((a) => (a.dataset.nav === nav ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  document.title = (titulo ? titulo + ' · ' : '') + 'BeastCamp';
  scrollTo(0, 0);
  animarBarras(m);
  const h = m.querySelector('h1'); if (h) h.focus({ preventScroll: true });
}

/* Avisos fijos arriba: sin conexión y versión nueva. */
function pintarAviso() {
  const a = $('aviso'); if (!a) return;
  a.innerHTML = (ENLINEA ? '' : `<div class="aviso sin" role="status">${ico('sinred')}<span>Sin conexión. Usás tus datos guardados.</span></div>`) +
    (swEsperando ? `<div class="aviso upd" role="status"><span>Hay una versión nueva</span><button type="button" class="bt-aviso" data-a="actualizar">Actualizar</button></div>` : '');
}
function repintarInstalar() { $$('[data-instalar]').forEach((e) => { e.innerHTML = bloqueInstalar(); }); }

/* ---------- rutas ---------- */
function rutaActual() {
  const h = location.hash.replace(/^#\/?/, '');
  const [r, ...resto] = h.split('/');
  let id = ''; try { id = decodeURIComponent(resto.join('/')); } catch (e) {}
  return { r: r || 'hoy', id };
}
const ir = (r, reemplazar = false) => { if (reemplazar) location.replace('#/' + r); else location.hash = '#/' + r; };

function render() {
  if (!PLAN || !PROG || !ESTADO || ESTADO.estado !== 'activo') return;
  const { r, id } = rutaActual();
  const clave = r + '/' + id;
  if (R) { if (clave === claveRepro) return; detenerReproductor(true); }
  if (!PROG.inicio && r !== 'bienvenida') return ir('bienvenida', true);
  if (PROG.inicio && r === 'bienvenida') return ir('hoy', true);
  switch (r) {
    case 'bienvenida':
      BIEN = BIEN || { nivel: PROG.nivel || ESTADO.nivel, apodo: PROG.apodo };
      return pintar(vBienvenida(BIEN.nivel, BIEN.apodo), { titulo: TITULOS.bienvenida });
    case 'plan': return pintar(vPlan(), { nav: 'plan', titulo: TITULOS.plan });
    case 'progreso': return pintar(vProgreso(), { nav: 'progreso', titulo: TITULOS.progreso });
    case 'perfil': return pintar(vPerfil(), { nav: 'perfil', titulo: TITULOS.perfil });
    case 'drills': return pintar(vDrills(), { nav: 'hoy', titulo: TITULOS.drills });
    case 'guia': return pintar(vGuia(), { nav: 'hoy', titulo: TITULOS.guia });
    case 'sesion':
    case 'drill': {
      const kind = r === 'sesion' ? 's' : 'd';
      const item = kind === 's' ? N.buscarSesion(PLAN, id) : N.buscarDrill(PLAN, id);
      if (!item) return pintar(vMensaje({ mun: 'f_ayuda', titulo: kind === 's' ? 'No encontramos esa sesión' : 'No encontramos ese drill', texto: 'Puede que haya cambiado el plan. Volvé a Hoy y elegí otra.', acciones: '<a class="cta" href="#/hoy">Ir a Hoy</a>' }), { titulo: 'No encontrado' });
      if (PEDIDO) { const d = PEDIDO.idx; PEDIDO = null; return arrancarSesion(item, kind, r + '/' + id, d); }
      return pintar(vResumen(item, kind), { titulo: item.titulo });
    }
    default: return pintar(vHoy(), { nav: 'hoy', titulo: TITULOS.hoy });
  }
}
function arrancarSesion(item, kind, clave, desde = 0) {
  claveRepro = clave;
  iniciarReproductor(item, kind, desde);
  if (!R) { claveRepro = ''; render(); }
}

/* ---------- acceso ---------- */
function sinAcceso(msg = '') {
  const u = ls.getRaw(K.ultimo);
  if (!msg && UUID.test(u)) { location.replace('/app/' + u + '/' + location.hash); return; }
  pintar(vRecuperar('form', msg), { titulo: 'Recuperar mi link' });
}
let pendT = 0, pendLargoT = 0, pendIni = 0, pendLargo = false;
function pararSondeo() { clearTimeout(pendT); clearTimeout(pendLargoT); pendT = pendLargoT = 0; }
function esperarPago() {
  pararSondeo(); pendIni = Date.now(); pendLargo = false;
  pintar(vPendiente(false), { titulo: 'Confirmando tu pago' });
  pendLargoT = setTimeout(() => { pendLargo = true; if (document.querySelector('.msg.conanillo')) pintar(vPendiente(true), { titulo: 'Confirmando tu pago' }); }, 45000);
  sondear();
}
function sondear() {
  clearTimeout(pendT);
  pendT = setTimeout(async () => {
    const r = await pedirEstado();
    if (r.ok && r.datos && r.datos.estado !== 'pendiente') { pararSondeo(); return cargar(); }
    if (pendT) sondear();
  }, pendLargo ? 8000 : 2500);
}

async function cargar() {
  pararSondeo();
  pintar(vCarga(), { titulo: 'Cargando' });
  const r = await pedirEstado();
  if (r.status === 400) return sinAcceso('Ese link no es válido. Escribí tu mail y te mandamos el correcto.');
  if (!r.ok || !r.datos || !r.datos.estado) return pintar(vError(r.status === 429 ? 'Hubo muchos pedidos seguidos. Esperá un momento e intentá de nuevo.' : 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.'), { titulo: 'Sin conexión' });
  const d = r.datos;
  if (d.estado === 'pendiente') return esperarPago();
  if (d.estado === 'revocado') { ESTADO = { estado: 'revocado', nombre: '', funnel: 'peso', nivel: 't1', ts: Date.now() }; return pintar(vRevocado(), { titulo: 'Acceso desactivado' }); }
  aplicarEstado(d);
  let plan = null;
  const rp = await pedirPlan();
  if (rp.ok && planValido(rp.datos)) { plan = rp.datos; guardarPlan(plan); }
  else if (rp.status === 403) return cargar();
  else plan = planGuardado();
  if (!plan) return pintar(vError('No pudimos descargar tu plan. Revisá tu conexión e intentá de nuevo.'), { titulo: 'Sin conexión' });
  entrarALaApp(plan);
}
function entrarALaApp(plan) {
  PLAN = plan;
  if (!PROG) PROG = NUCLEO.progVacio(ESTADO.nivel, 0, NUCLEO.limpiarApodo(ESTADO.nombre));
  if (!PLAN.niveles.some((n) => n.id === PROG.nivel)) PROG.nivel = PLAN.niveles[0].id;
  ultimaRevalid = Date.now();
  render();
  precargarMunecos();
  vaciarCola();
}
/* Con datos guardados la app abre al toque y se pone al día en segundo plano. */
async function revalidar() {
  ultimaRevalid = Date.now();
  const r = await pedirEstado();
  if (!r.ok || !r.datos) return;
  const d = r.datos;
  if (d.estado !== 'activo') { if (r.cache) return; detenerReproductor(true); ESTADO = { ...ESTADO, estado: d.estado }; return d.estado === 'pendiente' ? esperarPago() : pintar(vRevocado(), { titulo: 'Acceso desactivado' }); }
  aplicarEstado(d);
  const rp = await pedirPlan();
  if (rp.ok && planValido(rp.datos) && JSON.stringify(rp.datos) !== JSON.stringify(PLAN)) {
    guardarPlan(rp.datos); PLAN = rp.datos;
    if (!R && !/^(sesion|drill)$/.test(rutaActual().r)) render();
    precargarMunecos();
  } else if (!R && r.ok && PROG) { const { r: ru } = rutaActual(); if (ru === 'progreso' || ru === 'hoy' || ru === '') render(); }
  vaciarCola();
}
const revisarAcceso = () => { if (ESTADO && ESTADO.estado === 'activo') revalidar(); };
const alVolver = () => { if (ESTADO && ESTADO.estado === 'activo' && !R && Date.now() - ultimaRevalid > 60000) revalidar(); };

/* ---------- acciones ---------- */
const accion = {
  volver() { if (navCount > 0) history.back(); else ir('hoy'); },
  'ir-hoy'() { ir('hoy'); },
  reintentar() { cargar(); },
  'ir-recuperar'() { pararSondeo(); pintar(vRecuperar('form'), { titulo: 'Recuperar mi link' }); },
  'recuperar-otra'() { pintar(vRecuperar('form'), { titulo: 'Recuperar mi link' }); },
  actualizar() { actualizarApp(); },
  copiar: async () => { toast((await copiarTexto(linkPersonal())) ? 'Link copiado' : 'No pudimos copiarlo. Mantené apretado el link para copiarlo.'); },
  instalar: async () => { const r = await instalar(); if (r === 'no') toast('Usá el menú del navegador para instalarla'); },
  'nivel-bien'(b) {
    BIEN.nivel = b.dataset.n;
    $$('.niveles .c').forEach((c) => { const on = c.dataset.n === BIEN.nivel; c.classList.toggle('on', on); c.setAttribute('aria-checked', on); });
    const nv = N.nivelDe(PLAN, BIEN.nivel); $('b-nivel').textContent = `${nv.nombre} · ${nv.dias}`;
    document.querySelector('.bien-im').innerHTML = mun(nv.id);
    vibrar(8);
  },
  'empezar-app'() {
    const a = $('apodo'), v = N.limpiarApodo(a.value);
    if (a.value.trim() !== '' && !N.apodoValido(a.value.trim())) { $('apodo-err').textContent = 'Usá solo letras, números, espacios y _ . - (hasta 20).'; a.focus(); return; }
    PROG.apodo = v; PROG.nivel = BIEN.nivel; PROG.inicio = Date.now(); BIEN = null;
    guardarProg(); ir('hoy');
  },
  nivel() {
    const h = hoja(`<p class="tag">Nivel de carga</p><h3>Elegí cómo entrenar</h3>${cardsNivel(PROG.nivel, 'nivel-set')}<button class="cta s" data-a="cerrar-hoja">Cancelar</button>`);
    HOJA = h;
  },
  'nivel-set'(b) {
    if (b.dataset.n !== PROG.nivel) { PROG.nivel = b.dataset.n; guardarProg(); toast('Nivel: ' + N.nivelDe(PLAN, PROG.nivel).nombre); }
    if (HOJA) HOJA.cerrar(); render();
  },
  'cerrar-hoja'() { if (HOJA) HOJA.cerrar(); },
  ajuste(b) {
    const k = b.dataset.k; PROG.ajustes[k] = !PROG.ajustes[k]; guardarProg();
    b.setAttribute('aria-checked', !!PROG.ajustes[k]);
    if (k === 'sonido' && PROG.ajustes.sonido) { audioDesbloquear(); SON.cuenta(); }
    if (k === 'vibracion' && PROG.ajustes.vibracion) vibrar(40);
    if (k === 'voz' && PROG.ajustes.voz) hablar('Voz activada');
  },
  salir() {
    HOJA = hoja(`<p class="tag">Salir</p><h3>¿Salir en este celu?</h3><p class="sub">Se borran tus datos de este teléfono. Tu progreso queda guardado: para volver a entrar usá tu link o pedilo con tu mail.${hayCola() ? ' Todavía hay progreso sin subir: conectate antes de salir.' : ''}</p><button class="cta" data-a="salir-ok">Salir</button><button class="cta s" data-a="cerrar-hoja">Cancelar</button>`);
  },
  async 'salir-ok'() {
    if (HOJA) HOJA.cerrar();
    if (hayCola()) await subir();
    await olvidarEnEsteCelu();
    location.replace('/app/');
  },
  empezar() {
    const { r, id } = rutaActual(), kind = r === 'sesion' ? 's' : 'd';
    const item = kind === 's' ? N.buscarSesion(PLAN, id) : N.buscarDrill(PLAN, id);
    if (item) { ls.del(K.curso); arrancarSesion(item, kind, r + '/' + id, 0); }
  },
  retomar() {
    const c = cursoVigente(); if (!c) return accion.empezar();
    PEDIDO = { idx: c.idx };
    const h = `#/${c.k === 's' ? 'sesion' : 'drill'}/${c.id}`;
    if (location.hash === h) render(); else location.hash = h;
  },
  'p-salir'() {
    if (!R) return;
    const estaba = R.corriendo; if (estaba) pausaPlay();
    HOJA = hoja(`<p class="tag">En curso</p><h3>¿Salir de la sesión?</h3><p class="sub">Tu avance queda guardado y podés retomar desde acá cuando quieras.</p><button class="cta" data-a="p-seguir">Seguir entrenando</button><button class="cta s" data-a="p-salir-ok">Salir y guardar</button>`, { alCerrar: () => { if (R && !R.corriendo && estaba) pausaPlay(); } });
  },
  'p-seguir'() { if (HOJA) HOJA.cerrar(); },
  'p-salir-ok'() { const h = HOJA; HOJA = null; detenerReproductor(true); claveRepro = ''; if (h) h.cerrar(); ir('hoy'); },
  'p-pp'() { audioDesbloquear(); pausaPlay(); },
  'p-sig'() { audioDesbloquear(); siguiente(false); },
  'p-atras'() { audioDesbloquear(); atras(); },
  'p-sonido'() { PROG.ajustes.sonido = !PROG.ajustes.sonido; guardarProg(); pintarAjustesTop(); if (PROG.ajustes.sonido) { audioDesbloquear(); SON.cuenta(); } },
  'p-voz'() { PROG.ajustes.voz = !PROG.ajustes.voz; guardarProg(); pintarAjustesTop(); if (PROG.ajustes.voz) hablar('Voz activada'); else { try { speechSynthesis.cancel(); } catch (e) {} } },
};
let HOJA = null;

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-a]');
  if (!b || b.disabled) return;
  const f = accion[b.dataset.a];
  if (f) { e.preventDefault(); if (R) audioDesbloquear(); f(b, e); }
});
document.addEventListener('submit', async (e) => {
  const f = e.target.closest('[data-f]'); if (!f) return;
  e.preventDefault();
  if (f.dataset.f === 'recuperar') {
    const inp = $('mail'), err = $('mail-err'), btn = $('rec-b'), mail = inp.value.trim();
    err.textContent = '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) { err.textContent = 'Revisá que el mail esté bien escrito.'; inp.focus(); return; }
    btn.disabled = true; btn.textContent = 'Enviando…';
    const r = await api('/api/app/recuperar', { metodo: 'POST', cuerpo: { mail } });
    if (r.ok) return pintar(vRecuperar('listo'), { titulo: 'Revisá tu mail' });
    btn.disabled = false; btn.textContent = 'Mandame el link';
    err.textContent = r.status === 429 ? 'Hiciste varios pedidos seguidos. Esperá unos minutos y probá de nuevo.' : r.status === 0 ? 'No hay conexión. Probá de nuevo en un rato.' : 'No pudimos procesarlo. Probá de nuevo en un rato.';
  }
  if (f.dataset.f === 'apodo') {
    const a = $('apodo'), v = a.value.trim();
    if (v !== '' && !N.apodoValido(v)) { $('apodo-err').textContent = 'Usá solo letras, números, espacios y _ . - (hasta 20).'; a.focus(); return; }
    $('apodo-err').textContent = '';
    PROG.apodo = v; guardarProg(); toast(v ? 'Apodo guardado' : 'Apodo borrado');
  }
});
addEventListener('hashchange', () => { navCount++; render(); });

/* ---------- arranque ---------- */
function construirNav() {
  $('nav').innerHTML = NAV.map(([k, t]) => `<a href="#/${k}" data-nav="${k}">${ico(k)}<span>${t}</span></a>`).join('');
}
async function arrancar() {
  construirNav();
  if (!ACC) return sinAcceso();
  ls.setRaw(K.ultimo, ACC);
  registrarSW();
  PROG = N.normalizarProg(ls.get(K.prog));
  const est = ls.get(K.estado), plan = planGuardado();
  if (est && est.estado === 'activo' && plan) { ESTADO = est; entrarALaApp(plan); revalidar(); return; }
  cargar();
}
arrancar();
