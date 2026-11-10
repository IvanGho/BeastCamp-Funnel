/* Oferta (/oferta/) y rescates (/back1/ con 20% y /back2/ con 50%). Una sola plantilla; PAGINA la fija el armado. */
const CFG = {
  oferta: { clave: 'base', siguiente: '/back1/', barra: 'Tu precio de lanzamiento está reservado por' },
  back1: { clave: 'b1', siguiente: '/back2/', barra: 'ESPERÁ — TU DESCUENTO ESTÁ RESERVADO POR', etiqueta: 'Desbloqueaste un descuento', dto: '20% OFF',
    titulo: 'Antes de irte… tenés 20% OFF', intro: 'Sabemos que decidir cuesta. Antes de que te vayas, te dejamos BeastCamp Sombra a un precio que no vas a volver a ver.',
    etiquetaPrecio: 'Tu precio con el descuento', boton: 'QUIERO MI 20% OFF →', apoyo: 'Empezar hoy por ', pie: '' },
  back2: { clave: 'b2', siguiente: null, barra: 'ÚLTIMA OPORTUNIDAD — SE ACABA EN', etiqueta: 'Oferta final', dto: '50% OFF',
    titulo: 'Esta es tu última chance: 50% OFF', intro: 'Si cerrás esta página, la oferta desaparece. No hay una tercera: este es el precio más bajo.',
    etiquetaPrecio: 'Tu precio final', boton: 'SÍ, QUIERO EL 50% OFF FINAL →', apoyo: 'Empezar hoy por ', pie: 'Este es el último descuento. Si salís, el precio vuelve a ' },
}[PAGINA];
const G = DATOS.garantiaDias;
const precio = P[CFG.clave];
const esRescate = PAGINA !== 'oferta';
const nombre = esc(A.nombre || '');

const semanas = [
  ['Semana 1', 'Pies, guardia, jab y cross'],
  ['Semana 2', 'Esquivas y sombra'],
  ['Semana 3', 'Combinaciones y ritmo'],
  ['Semana 4', 'Rounds completos de 3 minutos'],
];

const confianza = `<p class="note cen" style="margin-top:10px">Pago seguro · Garantía ${G} días · Acceso instantáneo</p>`;

function bloqueEncabezado() {
  if (esRescate) return `<div class="pill" style="align-self:flex-start">${CFG.etiqueta}</div><h1>${CFG.titulo}</h1><p style="color:var(--m)">${CFG.intro}</p>`;
  return `<div class="tag">Tu plan está listo</div><h1>${nombre ? nombre + ', t' : 'T'}u plan de shadowboxing ya está armado.</h1><p style="color:var(--m)">Según tus respuestas, armamos tu Semana 1 y las 3 siguientes. Falta un paso para activarlo.</p>`;
}

function bloquePrecio() {
  const lista = `<div class="stack">${DATOS.valor.items.map((x) => `<div><span>${x[0]}</span><s>${x[1]}</s></div>`).join('')}<div class="tot"><span>Valor total</span><s>${DATOS.valor.total}</s></div></div>`;
  if (!esRescate) {
    return `<div class="box">${lista}<div class="cen" style="margin-top:10px"><div class="note">Tu precio de lanzamiento</div><div class="big">${precio}</div><div>Pago único · Acceso inmediato · Sin suscripción</div><div class="note">Menos que un mes de gimnasio</div></div></div>`;
  }
  return `<div class="box">${lista}<div class="cen" style="margin-top:10px"><div class="pill">${CFG.dto}</div></div><div class="precio2"><span>Precio normal</span><s>${P.base}</s></div><div class="precio2"><b>${CFG.etiquetaPrecio}</b><b style="color:var(--g)">${precio}</b></div><div class="big cen">${precio}</div><div class="cen">Pago único · Acceso inmediato · Sin suscripción</div></div>`;
}

function html() {
  const h = [];
  h.push(`<div class="tbar${esRescate ? ' up' : ''}"><span>${CFG.barra}</span> <b class="tm">10:00</b></div>`);
  h.push(bloqueEncabezado());
  h.push(`<div class="vid"><video src="/media/hd/oferta.mp4" poster="/media/oferta.jpg" autoplay muted loop playsinline webkit-playsinline preload="auto" disablepictureinpicture></video></div>`);
  h.push(`<div class="box sello">${I_ESCUDO}<div><b>Rutinas probadas por profesionales, semiprofesionales y amateurs</b><br><span style="color:var(--m);font-size:14px">Entrenadas y ajustadas por peleadores de los tres niveles.</span></div></div>`);
  if (!esRescate) h.push(`<div class="box"><b>Por qué entrenar sin plan te frena</b><p style="margin:8px 0 0;color:var(--m);font-size:15px">Repetir los mismos golpes sin una guía fija los errores. Un plan por semanas te dice qué trabajar, cuánto y cuándo.</p></div>`);
  h.push(`<p>Plan de 4 semanas de shadowboxing en casa, en tu celu, con 4 niveles de carga (de 15 minutos por día a 90 minutos por día), timer de rounds y rutinas guiadas.</p>`);
  h.push(pillPersonas('peleadores y aficionados ya entrenan con BeastCamp'));
  h.push(tarjetaEspecialista(true));
  h.push(`<div class="box"><b>Así cambia tu entrenamiento</b><div class="vs"><div><small>ANTES</small>Entrenás a ciegas<br>Repetís los mismos errores<br>Sin plan ni constancia<br>Sin saber si mejorás</div><div class="on"><small>CON BEASTCAMP</small>Plan semana a semana<br>Técnica y guardia corregidas<br>Timer de rounds y rutinas guiadas<br>Ranking con tu apodo</div></div></div>`);
  h.push(`<div class="box"><b>Cómo funciona</b><div class="st"><i>1</i>Te armamos tu plan según tu nivel y tiempo</div><div class="st"><i>2</i>Entrenás en casa con el timer y las rutinas guiadas</div><div class="st"><i>3</i>Sumás puntos y subís en el ranking con tu apodo</div></div>`);
  h.push(`<div class="box"><b>Qué trabajás cada semana</b>${semanas.map((x) => `<div class="sem"><b>${x[0]}</b><span>${x[1]}</span></div>`).join('')}<p style="margin:10px 0 0;color:var(--m);font-size:14px">Siguiendo el plan semana a semana trabajás tu técnica, tu guardia, tus combinaciones y tu resistencia.</p></div>`);
  h.push(`<div class="box"><b>Por qué funciona</b><div class="st"><i>✓</i>Progresión semanal: cada semana suma una capa nueva, sin saltos.</div><div class="st"><i>✓</i>Pies, guardia y respiración: lo que más se corrige entrenando solo.</div><div class="st"><i>✓</i>Timer de rounds: ordena el esfuerzo y la constancia.</div></div>`);
  h.push(bloqueTestimonios());
  h.push(bloquePrecio());
  h.push(`<div class="garantia">${I_ESCUDO}<div><b>Garantía de ${G} días</b><br><span style="color:var(--m);font-size:14px">Si en ${G} días no te sirve, te devolvemos tu plata, sin preguntas.</span></div></div>`);
  h.push(`<div class="box faq"><b>Preguntas frecuentes</b><details><summary>¿Cómo recibo el plan?</summary>Apenas pagás te llega el acceso al celular. Funciona como app, sin descargar nada.</details><details><summary>¿Necesito equipo?</summary>No. Se entrena en casa, sin equipo.</details><details><summary>¿Sirve si nunca entrené?</summary>Sí, el plan arranca desde cero y sube de a poco según tu nivel.</details><details><summary>¿Y si no me sirve?</summary>Tenés ${G} días de garantía de devolución, sin vueltas.</details></div>`);
  const boton = esRescate ? CFG.boton : `QUIERO MI PLAN POR ${precio} →`;
  const apoyo = esRescate ? CFG.apoyo + precio : 'Empezar hoy mismo';
  h.push(`<button class="cta" data-reservar>${boton}<span style="display:block;font-size:13px;font-weight:600;opacity:.92;margin-top:2px">${apoyo}</span></button>`);
  h.push(confianza);
  if (!esRescate) h.push(`<p class="note cen" style="margin-top:12px">Este precio es para quienes completaron el quiz. Cuando el contador llega a cero, se cierra.</p>`);
  if (CFG.pie) h.push(`<p class="note cen" style="margin-top:12px">${CFG.pie}${P.base}.</p>`);
  return h.join('');
}

$('app').innerHTML = `<div class="scr">${html()}</div>`;
const k = document.createElement('div');
k.className = 'sticky';
k.innerHTML = `<span>Oferta termina en<b class="tm">10:00</b></span><button class="cta" data-reservar>Reservar mi lugar</button>`;
document.body.appendChild(k);
document.querySelectorAll('[data-reservar]').forEach((b) => (b.onclick = () => reservar(CFG.clave)));
arrancaContador(PAGINA);
pie();

/* Salida: al intentar irse, la persona pasa al siguiente rescate (otra página con su propia dirección). */
if (CFG.siguiente) {
  let ido = false;
  const salir = () => { if (ido) return; ido = true; location.replace(CFG.siguiente + consultaCampana()); };
  try { history.pushState({ a: 1 }, ''); history.pushState({ a: 2 }, ''); } catch (e) {}
  window.addEventListener('popstate', salir);
  document.addEventListener('mouseleave', (e) => { if (e.clientY <= 0) salir(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) window.__lejos = 1; else if (window.__lejos) salir(); });
}
