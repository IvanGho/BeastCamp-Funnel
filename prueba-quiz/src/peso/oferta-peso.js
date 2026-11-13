/* Oferta (/oferta-peso/) y rescates (/back1-peso/ con 20% y /back2-peso/ con 50%) del funnel de bajar de peso. PAGINA la fija el armado. Usa CALC (calculos-peso.js) y DATOS_PESO (datos-peso.js).
   La oferta es larga (disco con tu meta, lo que vimos en tus respuestas, plan semana a semana, precio, garantía y preguntas) con una barra de compra abajo que aparece ni bien se desliza.
   Los rescates son cortos y van directo al descuento, con el contador arriba. Lo personal (Hoy → Tu meta, gráfico, disco) se oculta si no hay A.peso y A.pesoMeta numéricos. */
const CFG = {
  oferta: { clave: 'base', siguiente: '/back1-peso/' },
  back1: { clave: 'b1', siguiente: '/back2-peso/', barra: 'Tu descuento está reservado por', etiqueta: 'Esperá, desbloqueaste un descuento', dto: '20% OFF', sello: '20% OFF EXCLUSIVO',
    titulo: 'Antes de irte…', titulo2: 'tenés un 20% OFF', intro: 'Sabemos que decidir cuesta. Por eso, antes de que te vayas, te dejamos tu plan de BeastCamp Sombra con un 20% de descuento.',
    boton: 'QUIERO MI 20% OFF →', apoyo: 'Empezar hoy por ', testis: 'Casi se van. Hoy entrenan con su plan.' },
  back2: { clave: 'b2', siguiente: null, barra: 'Última oportunidad, se acaba en', etiqueta: 'Oferta final', dto: '50% OFF', sello: '50% OFF · PRECIO MÁS BAJO',
    titulo: 'Esta es tu última chance', titulo2: '50% OFF, no hay otra oferta', intro: 'No hay un tercer descuento: este es el precio más bajo que tenemos para tu plan.',
    boton: 'SÍ, QUIERO EL 50% OFF →', apoyo: 'Empezar hoy por ', testis: 'Casi se van. Hoy entrenan con su plan.' },
}[PAGINA];
const G = DATOS.garantiaDias;
const precio = P[CFG.clave];
const esRescate = PAGINA !== 'oferta';
const nombre = esc(A.nombre || '');

const SEMANAS_PLAN = [
  ['Semana 1', 'Postura, pies y tus dos primeros golpes', 'Rounds cortos: el timer te marca cuándo dar y cuándo descansar.'],
  ['Semana 2', 'Esquivas y boxeo al aire', 'Sumás cintura y piernas, siempre a tu nivel de carga.'],
  ['Semana 3', 'Combinaciones y ritmo', 'Encadenás golpes y esquivas: los rounds se hacen más fluidos.'],
  ['Semana 4', 'Rounds completos de 3 minutos, con descanso', 'Cerrás el plan entrenando como en un gimnasio de boxeo, en tu casa.'],
];

/* ---------- Cálculos de la persona (todo opcional) ---------- */
const numPeso = (v) => (v === '' || v == null ? NaN : Number(v));
const kgTxt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));
const imcTxt = (n) => n.toFixed(1).replace('.', ',');

function planPeso() {
  const peso = numPeso(A.peso), meta = numPeso(A.pesoMeta), alt = numPeso(A.altura);
  if (!isFinite(peso) || !isFinite(meta) || meta <= 0 || meta >= peso) return null;
  if (peso < CALC.LIMITES.peso[0] || peso > CALC.LIMITES.peso[1]) return null;
  const hayAltura = isFinite(alt) && alt >= CALC.LIMITES.altura[0] && alt <= CALC.LIMITES.altura[1];
  if (hayAltura && !CALC.validarMeta(peso, meta, alt).ok) return null;
  const sem = CALC.semanas(peso, meta);
  const fecha = CALC.fechaMeta(new Date(), sem);
  const pct = CALC.porcentaje(peso, meta);
  return {
    peso, meta, kg: peso - meta, pct,
    imcHoy: hayAltura ? CALC.imc(peso, alt) : null,
    imcMeta: hayAltura ? CALC.imc(meta, alt) : null,
    mes: CALC.mesAnio(fecha).replace(/ de (\d)/, ' de $1'),   // «marzo de 2027» no se parte en dos líneas
    puntos: CALC.curva(peso, meta, 24),
  };
}
const plan = planPeso();

const notaEstimacion = `<p class="po-nota">Estimación a ${String(CALC.RITMO_KG_SEMANA).replace('.', ',')} kg por semana, un ritmo prudente. Tu plan dura 4 semanas; la fecha supone que seguís entrenando al mismo ritmo después. Depende de lo que comas, de tu descanso y de cuánto sostengas el plan. No es una promesa.</p>`;

const I_FLECHA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>';

function bloqueHoyMeta() {
  if (!plan) return '';
  const col = (et, kg, imc, cls) => `<div class="po-col${cls}"><small>${et}</small><b>${kgTxt(kg)} kg</b>${imc != null ? `<span>IMC ${imcTxt(imc)}</span>` : ''}</div>`;
  const resumen = `${kgTxt(plan.kg)} kg menos${plan.pct >= 1 ? `, un ${plan.pct}% de tu peso` : ''}`;
  return `<div class="box po-hoy rv"><div class="po-par">${col('HOY', plan.peso, plan.imcHoy, '')}<div class="po-flecha">${I_FLECHA}</div>${col('TU META', plan.meta, plan.imcMeta, ' meta')}</div><div class="po-fecha">${resumen}<br>Fecha estimada si sostenés este ritmo: <b>${esc(plan.mes)}</b></div></div>`;
}

function bloqueGrafico() {
  if (!plan || !plan.puntos || plan.puntos.length < 2) return '';
  const W = 320, H = 172, pl = 16, pr = 16, pt = 34, pb = 34;
  const rango = plan.peso - plan.meta || 1;
  const xy = plan.puntos.map((p) => [pl + p.x * (W - pl - pr), pt + ((plan.peso - p.kg) / rango) * (H - pt - pb)]);
  const f = (n) => n.toFixed(1);
  const linea = xy.map((p, i) => (i ? 'L' : 'M') + f(p[0]) + ' ' + f(p[1])).join(' ');
  const base = H - pb + 12;
  const area = `${linea} L${f(xy[xy.length - 1][0])} ${base} L${f(xy[0][0])} ${base} Z`;
  const ini = xy[0], fin = xy[xy.length - 1];
  return `<div class="box rv po-gbox"><b>Tu camino hasta tu meta</b><svg class="po-graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Proyección de tu peso, de ${kgTxt(plan.peso)} kg hoy a ${kgTxt(plan.meta)} kg en ${esc(plan.mes)}"><defs><linearGradient id="poRelleno" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16A34A" stop-opacity=".28"/><stop offset="1" stop-color="#16A34A" stop-opacity="0"/></linearGradient></defs><path class="po-area" d="${area}"/><path class="po-linea" pathLength="1" d="${linea}"/><circle class="po-pt" cx="${f(ini[0])}" cy="${f(ini[1])}" r="5"/><circle class="po-pt meta" cx="${f(fin[0])}" cy="${f(fin[1])}" r="6"/><text class="po-et" x="${f(ini[0])}" y="${f(ini[1] - 12)}" text-anchor="start">Hoy ${kgTxt(plan.peso)} kg</text><text class="po-et meta" x="${f(fin[0])}" y="${f(fin[1] + 22)}" text-anchor="end">${kgTxt(plan.meta)} kg · ${esc(plan.mes)}</text></svg>${notaEstimacion}</div>`;
}

/* ---------- Íconos (SVG, sin emojis) ---------- */
const ic = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const IC = {
  cuerpo: ic('<circle cx="12" cy="5" r="2.2"/><path d="M12 8v6M8 22l4-8 4 8M6 11l6-2 6 2"/>'),
  reloj: ic('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>'),
  casa: ic('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'),
  escalon: ic('<path d="M3 20h5v-5h5v-5h5V5h3"/>'),
  celu: ic('<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>'),
  timer: ic('<circle cx="12" cy="13" r="8"/><path d="M12 13V9M12 2v2M18.5 6.5l1.5-1.5"/>'),
  lista: ic('<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>'),
  copa: ic('<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 21h6"/>'),
  guante: ic('<path d="M7 10V7a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v6a5 5 0 0 1-5 5H9a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h3"/><path d="M8 18v3h8v-3"/>'),
  candado: ic('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  rayo: ic('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
  escudo: ic('<path d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>'),
  alarma: ic('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M4 4l3-2M20 4l-3-2"/>'),
  regalo: ic('<rect x="3" y="9" width="18" height="12" rx="2"/><path d="M3 13h18M12 9v12M12 9c-2-4-6-4-6-1.5S9 9 12 9zm0 0c2-4 6-4 6-1.5S15 9 12 9z"/>'),
};

/* ---------- Datos de la persona para los textos ---------- */
const DETALLE_TIEMPO = { Arranque: '2-3 días · 15-30 min', Ritmo: '3-4 días · 30-40 min', Impulso: '4-5 días · 45-60 min' };
const comoLista = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const minus = (t) => String(t).charAt(0).toLowerCase() + String(t).slice(1);
const precioNum = (t) => Number(String(t).replace(/\D/g, '')) || 0;
const porDia = (t) => '$' + Math.round(precioNum(t) / 28).toLocaleString('es-AR');

/* Lo que salió de sus respuestas: solo lo que contestó, sin inventar nada. */
function loQueVimos() {
  const it = [];
  const frenos = comoLista(A.frenos), zonas = comoLista(A.zonas);
  if (frenos.length) it.push(`Lo que te frenó otras veces: <b>${esc(minus(frenos[0]))}</b>. Por eso el plan te dice qué hacer cada día.`);
  if (zonas.length) it.push(`Lo primero que querés cambiar: <b>${esc(zonas.map(minus).join(', '))}</b>.`);
  if (plan && plan.imcHoy != null) it.push(`Tu IMC hoy: <b>${imcTxt(plan.imcHoy)}</b>. Es tu punto de partida, no un veredicto.`);
  if (A.sueno === 'Menos de 5 horas' || A.sueno === '5 a 6 horas') it.push(`Dormís <b>${esc(minus(A.sueno))}</b>: el plan arranca suave para que lo puedas sostener.`);
  if (A.actividad) it.push(`Cuánto te moviste en los últimos 3 meses: <b>${esc(minus(A.actividad))}</b>.`);
  if (DETALLE_TIEMPO[A.tiempo]) it.push(`Tu nivel de carga: <b>${esc(A.tiempo)} (${DETALLE_TIEMPO[A.tiempo]})</b>.`);
  if (!it.length) return '';
  return `<div class="box po-vi rv"><b>${nombre ? `¡Hola ${nombre}! ` : ''}Esto es lo que vimos en tus respuestas:</b><ul>${it.slice(0, 5).map((x) => `<li>${x}</li>`).join('')}</ul></div>`;
}

/* Disco animado con la meta: el número baja de tu peso de hoy a tu meta. Sin datos, muestra el plan de 4 semanas. */
function bloqueHeroe() {
  const centro = plan
    ? `<small>Hoy <s>${kgTxt(plan.peso)} kg</s></small><b><span class="po-cuenta" data-de="${plan.peso}" data-a="${plan.meta}">${kgTxt(plan.meta)}</span><em>kg</em></b><small>estimado para ${esc(plan.mes)}</small><span class="po-chip">−${kgTxt(plan.kg)} kg</span>`
    : `<small>Tu plan</small><b>4<em>semanas</em></b><small>de shadowboxing en casa</small>${DETALLE_TIEMPO[A.tiempo] ? `<span class="po-chip">${DETALLE_TIEMPO[A.tiempo]}</span>` : ''}`;
  return `<div class="po-heroe"><div class="po-anillo"><i></i><i></i><svg class="po-arco" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="94" pathLength="1"/></svg><div class="po-disco">${centro}</div></div></div>`;
}

const tildes = (items) => items.map((x) => `<div class="st"><i>✓</i><span>${x}</span></div>`).join('');

/* Cita real del especialista (la misma de la slide de publicación del quiz). */
function bloqueCita() {
  const n = (typeof DATOS_PESO !== 'undefined' && DATOS_PESO.publicacion) || {};
  if (!n.bajada || !n.fuente) return '';
  return `<figure class="po-cita rv"><blockquote>${esc(n.bajada)}</blockquote><figcaption>${esc(n.fuente)}</figcaption></figure>`;
}

function bloqueLinea() {
  return `<section class="po-sec rv"><h2>${nombre ? nombre + ', esto' : 'Esto'} es lo que vas a hacer</h2><p class="po-sub">Tu plan, semana a semana</p><ol class="po-linea-t">${SEMANAS_PLAN.map((x, i) =>
    `<li style="--i:${i}"><span class="po-nodo">${[IC.guante, IC.cuerpo, IC.rayo, IC.copa][i]}</span><div><span class="po-et2">${x[0]}</span><b>${x[1]}</b><p>${x[2]}</p></div></li>`).join('')}</ol><p class="po-pie2">Todo guiado paso a paso desde el celu, sin equipo y sin gimnasio.</p></section>`;
}

function bloquePorQue() {
  const f = [
    [IC.cuerpo, 'Mueve todo el cuerpo', 'Piernas, torso y brazos trabajan a la vez en cada round.'],
    [IC.reloj, 'Desde 15 minutos', 'Arrancás con lo mínimo y subís cuando te sentís listo.'],
    [IC.casa, 'En tu casa, sin equipo', 'Sin gimnasio, sin cuotas y sin horarios ajenos.'],
    [IC.escalon, 'Desde cero', 'No hace falta haber boxeado: el plan sube de a poco.'],
  ];
  return `<section class="po-sec rv" id="por-que"><h2>Por qué funciona el shadowboxing</h2><div class="po-cards">${f.map((x) => `<div class="po-card">${x[0]}<div><b>${x[1]}</b><span>${x[2]}</span></div></div>`).join('')}</div></section>`;
}

function bloqueIncluye() {
  const ics = [IC.lista, IC.timer, IC.copa, IC.regalo];
  return `<div class="box po-precio rv"><b class="po-tit">Qué incluye tu plan</b>${DATOS.valor.items.map((x, i) => `<div class="po-item">${ics[i] || IC.lista}<span>${x[0]}</span><s>${x[1]}</s></div>`).join('')}` +
    `<div class="po-item">${IC.celu}<span>En tu celu, como una app, sin descargar nada</span><em>incluido</em></div>` +
    `<div class="po-total"><span>Valor total</span><s>${DATOS.valor.total}</s></div><div class="po-hoy2"><span>Hoy pagás</span><b>${precio}</b></div><p class="po-dia">= ${porDia(precio)} por día durante tus 4 semanas · pago único</p></div>`;
}

const bloqueComparar = () => `<div class="po-comp rv"><div><span>Cuota de gimnasio</span><i>todos los meses</i></div><div><span>Clases con entrenador</span><i>se pagan por clase</i></div><div class="on"><span>BeastCamp Sombra</span><b>${precio} total</b></div></div>`;

/* Testimonios: SOLO personas reales con su permiso (DATOS_PESO.testimonios). Vacío = el bloque no aparece. Formato de chat. */
function bloqueTestimoniosPeso(titulo = 'Lo que nos escriben') {
  const ts = (typeof DATOS_PESO !== 'undefined' && DATOS_PESO && DATOS_PESO.testimonios) || [];
  if (!ts.length) return '';
  return `<section class="po-sec rv"><h2>${titulo}</h2>${ts.slice(0, 3).map((t) => `<div class="po-msj"><span class="po-av">${esc(String(t.nombre || '?')[0])}</span><div class="po-globo"><p>${esc(t.texto)}</p><small>${esc(t.nombre)}${t.detalle ? ' · ' + esc(t.detalle) : ''}</small></div></div>`).join('')}</section>`;
}

const bloqueAntesDespues = () => `<div class="po-vs rv"><div><small>SIN PLAN</small><p>Improvisás y lo dejás a la semana</p><p>No sabés por dónde empezar</p><p>Sesiones largas que no sostenés</p><p>Nadie te marca el ritmo</p></div><div class="on"><small>CON TU PLAN</small><p>Sabés qué hacer cada día</p><p>Arrancás desde cero y subís de a poco</p><p>Rounds cortos a tu nivel de carga</p><p>El timer te marca el ritmo</p></div></div>`;

const bloqueGarantia = () => `<div class="po-gar rv"><span class="po-gar-ic">${IC.escudo}</span><div><small>CERO RIESGO</small><b>Garantía de ${G} días</b><p>Si en ${G} días no te sirve, te devolvemos tu plata, sin preguntas. Un mail y listo.</p></div></div>`;

const bloqueFaq = () => `<section class="po-sec rv"><h2>Preguntas frecuentes</h2><div class="po-faq">
<details><summary>¿Tengo que saber boxear?</summary><p>No. El plan arranca de cero y sube de a poco.</p></details>
<details><summary>¿Cómo recibo el plan?</summary><p>Apenas pagás te llega el acceso al celular. Funciona como app, sin descargar nada.</p></details>
<details><summary>¿Cuánto tiempo necesito por día?</summary><p>Desde 15 minutos. Vos elegís el nivel de carga según el tiempo que tenés.</p></details>
<details><summary>¿Cuánto voy a bajar?</summary><p>Depende de tu punto de partida, de lo que comas, de tu descanso y de cuánto sostengas el plan. No prometemos una cifra.</p></details>
<details><summary>¿Incluye dieta?</summary><p>No. Es un plan de entrenamiento; para bajar de peso también cuenta lo que comés.</p></details>
<details><summary>¿Necesito equipo?</summary><p>No. Se entrena en casa, sin equipo.</p></details>
<details><summary>¿Y si tengo una lesión o un problema de salud?</summary><p>Consultá a tu médico antes de empezar. Las rutinas no reemplazan a un profesional de la salud.</p></details>
<details><summary>¿Y si no me sirve?</summary><p>Tenés ${G} días de garantía de devolución, sin vueltas.</p></details></div></section>`;

const confianza = `<div class="po-conf"><span>${IC.candado}Pago seguro</span><span>${IC.rayo}Acceso inmediato</span><span>${IC.escudo}Garantía ${G} días</span></div>`;
const botonCompra = (txt, apoyo = '') => `<button class="cta po-cta" data-reservar>${txt}${apoyo ? `<span class="po-apoyo">${apoyo}</span>` : ''}</button>`;

/* ---------- Páginas ---------- */
function oferta() {
  const h = [];
  h.push(`<div class="po-top">${tarjetaMini()}</div>`);
  h.push(`<h1 class="po-h1">${nombre ? nombre + ', t' : 'T'}u plan para bajar de peso <em>ya está armado</em></h1><p class="po-sub">Basado en tus respuestas, tu tiempo y tu punto de partida</p>`);
  h.push(bloqueHeroe());
  h.push(loQueVimos());
  h.push(`<div class="vid-fila rv"><div class="vid"><video src="/media/hd/oferta.mp4" poster="/media/oferta.jpg" autoplay muted loop playsinline webkit-playsinline preload="auto" width="960" height="540" aria-hidden="true" tabindex="-1" disablepictureinpicture></video></div><div class="vid-info">${tildes(['Plan de 4 semanas', '4 niveles de carga', 'Rutinas guiadas paso a paso', 'Timer de rounds'])}</div></div>`);
  h.push(bloqueGrafico());
  h.push(bloqueCita());
  h.push(bloqueLinea());
  h.push(bloquePorQue());
  h.push(bloqueIncluye());
  h.push(`<p class="po-urg">${IC.alarma}Precio de lanzamiento · vence en <b class="tm">10:00</b></p>`);
  h.push(botonCompra('QUIERO MI PLAN PERSONALIZADO →'));
  h.push(confianza);
  h.push(bloqueComparar());
  h.push(bloqueTestimoniosPeso());
  h.push(bloqueAntesDespues());
  h.push(bloqueGarantia());
  h.push(bloqueFaq());
  h.push(`<section class="po-fin rv"><h2>${nombre ? nombre + ', t' : 'T'}u plan te está esperando</h2><p>El precio de lanzamiento de ${precio} vence en:</p><div class="po-reloj tm">10:00</div>${botonCompra(`QUIERO MI PLAN POR ${precio} →`)}${confianza}</section>`);
  h.push(`<p class="note cen" style="margin-top:12px">Pago único, sin suscripción.</p>`);
  return h.join('');
}

function rescate() {
  const h = [];
  const puede = [
    [IC.lista, 'Seguir tu plan de 4 semanas de shadowboxing, armado con tus respuestas'],
    [IC.escalon, 'Elegir entre 4 niveles de carga, de 15 a 90 minutos por día'],
    [IC.timer, 'Entrenar con el timer de rounds y las rutinas guiadas paso a paso'],
    [IC.celu, 'Tener todo en tu celu, como una app, sin equipo y sin gimnasio'],
  ];
  const tarjetaPrecio = `<div class="po-oferta rv"><span class="po-badge">${IC.regalo}${CFG.sello}</span><p class="po-normal">Precio normal <s>${P.base}</s></p><p class="po-etq">Tu precio con el descuento</p><div class="po-grande">${precio}</div><p class="po-dia">Pago único · Acceso inmediato a la app · Sin suscripción</p>${botonCompra(CFG.boton, CFG.apoyo + precio)}${confianza}</div>`;
  h.push(`<div class="tbar up po-tbar">${IC.alarma}<span>${CFG.barra}</span> <b class="tm">10:00</b></div>`);
  h.push(`<div class="po-cen"><span class="po-pill">${IC.regalo}${CFG.etiqueta}</span><h1 class="po-h1">${CFG.titulo}<br><em>${CFG.titulo2}</em></h1><p class="po-intro">${nombre ? nombre + ', ' + minus(CFG.intro) : CFG.intro}</p></div>`);
  h.push(tarjetaPrecio);
  h.push(`<section class="po-sec rv"><h2>Con BeastCamp Sombra vas a poder:</h2><div class="po-cards">${puede.map((x) => `<div class="po-card">${x[0]}<div><span>${x[1]}</span></div></div>`).join('')}</div></section>`);
  h.push(bloqueHoyMeta());
  h.push(bloqueTestimoniosPeso(CFG.testis));
  h.push(bloqueGarantia());
  h.push(PAGINA === 'back2' ? tarjetaPrecio : `<div class="rv">${botonCompra(CFG.boton, CFG.apoyo + precio)}</div>`);
  return h.join('');
}

$('app').innerHTML = `<div class="scr po ${esRescate ? 'po-res' : 'po-of'}">${esRescate ? rescate() : oferta()}</div>`;

/* Barra fija de abajo con el precio y el botón: aparece ni bien la persona desliza un poco (y se esconde arriba de todo). */
const k = document.createElement('div');
k.className = 'sticky po-st oculta';
k.innerHTML = `<div class="po-sp"><b>${precio}</b><small>${esRescate ? CFG.dto + ' · pago único' : 'vence en <span class="tm">10:00</span>'}</small></div><button class="cta" data-reservar>QUIERO MI PLAN →</button>`;
document.body.appendChild(k);
document.body.classList.add('consticky');
const revisaBarra = () => k.classList.toggle('oculta', window.scrollY < 60);
window.addEventListener('scroll', revisaBarra, { passive: true });
revisaBarra();
document.querySelectorAll('[data-reservar]').forEach((b) => (b.onclick = () => reservar(CFG.clave)));

/* Animaciones: los bloques entran al aparecer y el número del disco baja de tu peso a tu meta. Con movimiento reducido todo queda quieto y visible. */
const quieto = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const cuenta = document.querySelector('.po-cuenta');
if (cuenta && !quieto && window.requestAnimationFrame) {
  const de = +cuenta.dataset.de, a = +cuenta.dataset.a, t0 = performance.now() + 500, dur = 1700;
  const paso = (t) => { const x = Math.min(1, Math.max(0, (t - t0) / dur)); const e = 1 - Math.pow(1 - x, 3); cuenta.textContent = x < 1 ? kgTxt(Math.round(de - (de - a) * e)) : kgTxt(a); if (x < 1) requestAnimationFrame(paso); };
  cuenta.textContent = kgTxt(de); requestAnimationFrame(paso);
}
if (!quieto && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('rvjs');
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px' });
  document.querySelectorAll('.rv').forEach((e) => io.observe(e));
}

/* Mismo contador que oferta.js (comun.js): 10:00 en la oferta, 09:57 en back1 y 04:57 en back2, y se reinicia solo al llegar a cero. */
arrancaContador(PAGINA);
pie(true, true);            // pie de comun.js al final de la página (sin posición fija), con los enlaces en pestaña nueva para no perder la oferta

/* Salida: al intentar irse, la persona pasa al siguiente rescate (otra página con su propia dirección). */
if (CFG.siguiente) {
  let ido = false;
  const salir = () => { if (ido) return; ido = true; location.replace(CFG.siguiente + consultaCampana()); };
  try { history.pushState({ a: 1 }, ''); history.pushState({ a: 2 }, ''); } catch (e) {}
  window.addEventListener('popstate', salir);
  document.addEventListener('mouseleave', (e) => { if (e.clientY <= 0) salir(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) window.__lejos = 1; else if (window.__lejos) salir(); });
}
