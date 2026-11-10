/* Oferta (/oferta-peso/) y rescates (/back1-peso/ con 20% y /back2-peso/ con 50%) del funnel de bajar de peso.
   Una sola plantilla, con los mismos bloques y en el mismo orden que oferta.js; PAGINA la fija el armado. Usa CALC (calculos-peso.js) y DATOS_PESO (datos-peso.js).
   Lo propio de este funnel es la tarjeta Hoy → Tu meta y el gráfico: sin A.peso y A.pesoMeta numéricos (entrada directa) se ocultan, y lo demás queda igual. */
const CFG = {
  oferta: { clave: 'base', siguiente: '/back1-peso/', barra: 'Tu precio de lanzamiento está reservado por' },
  back1: { clave: 'b1', siguiente: '/back2-peso/', barra: 'ESPERÁ — TU DESCUENTO ESTÁ RESERVADO POR', etiqueta: 'Desbloqueaste un descuento', dto: '20% OFF',
    titulo: 'Tenés 20% OFF en tu plan', intro: 'Sabemos que decidir cuesta. Te dejamos BeastCamp Sombra con 20% OFF para que arranques hoy.',
    etiquetaPrecio: 'Tu precio con el descuento', boton: 'QUIERO MI 20% OFF →', apoyo: 'Empezar hoy por ' },
  back2: { clave: 'b2', siguiente: null, barra: 'ÚLTIMA OPORTUNIDAD — SE ACABA EN', etiqueta: 'Precio más bajo', dto: '50% OFF',
    titulo: 'Tu plan con 50% OFF', intro: 'Este es el precio más bajo que tenemos.',
    etiquetaPrecio: 'Tu precio con el descuento', boton: 'SÍ, QUIERO EL 50% OFF →', apoyo: 'Empezar hoy por ' },
}[PAGINA];
const G = DATOS.garantiaDias;
const precio = P[CFG.clave];
const esRescate = PAGINA !== 'oferta';
const nombre = esc(A.nombre || '');

const SEMANAS_PLAN = [
  ['Semana 1', 'Postura, pies y tus dos primeros golpes'],
  ['Semana 2', 'Esquivas y boxeo al aire'],
  ['Semana 3', 'Combinaciones y ritmo'],
  ['Semana 4', 'Rounds completos de 3 minutos, con descanso'],
];

const confianza = `<p class="note cen" style="margin-top:10px">Pago seguro · Garantía ${G} días · Acceso instantáneo</p>`;

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
    mes: CALC.mesAnio(fecha).replace(/ de (\d)/, ' de\u00a0$1'),   // «marzo de 2027» no se parte en dos líneas
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
  return `<div class="box po-hoy"><div class="po-par">${col('HOY', plan.peso, plan.imcHoy, '')}<div class="po-flecha">${I_FLECHA}</div>${col('TU META', plan.meta, plan.imcMeta, ' meta')}</div><div class="po-fecha">${resumen}<br>Fecha estimada si sostenés este ritmo: <b>${esc(plan.mes)}</b></div></div>`;
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
  return `<div class="box"><b>Tu camino hasta tu meta</b><svg class="po-graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Proyección de tu peso, de ${kgTxt(plan.peso)} kg hoy a ${kgTxt(plan.meta)} kg en ${esc(plan.mes)}"><defs><linearGradient id="poRelleno" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16A34A" stop-opacity=".28"/><stop offset="1" stop-color="#16A34A" stop-opacity="0"/></linearGradient></defs><path class="po-area" d="${area}"/><path class="po-linea" d="${linea}"/><circle class="po-pt" cx="${f(ini[0])}" cy="${f(ini[1])}" r="5"/><circle class="po-pt meta" cx="${f(fin[0])}" cy="${f(fin[1])}" r="6"/><text class="po-et" x="${f(ini[0])}" y="${f(ini[1] - 12)}" text-anchor="start">Hoy ${kgTxt(plan.peso)} kg</text><text class="po-et meta" x="${f(fin[0])}" y="${f(fin[1] + 22)}" text-anchor="end">${kgTxt(plan.meta)} kg · ${esc(plan.mes)}</text></svg>${notaEstimacion}</div>`;
}

/* ---------- Bloques ---------- */
function bloqueEncabezado() {
  if (esRescate) return `<div class="pill" style="align-self:flex-start">${CFG.etiqueta}</div><h1>${CFG.titulo}</h1><p style="color:var(--m)">${CFG.intro}</p>`;
  return `<div class="tag">Tu plan está listo</div><h1>${nombre ? nombre + ', t' : 'T'}u plan para bajar de peso ya está armado.</h1><p style="color:var(--m)">Según tus respuestas, armamos tu Semana 1 y las 3 siguientes. Falta un paso para activarlo.</p>`;
}

/* Bloque con tildes: el mismo .st con ✓ de «Por qué funciona» en oferta.js. */
const tildes = (items) => items.map((x) => `<div class="st"><i>✓</i><span>${x}</span></div>`).join('');

function bloquePrecio() {
  const valor = `<div class="stack">${DATOS.valor.items.map((x) => `<div><span>${x[0]}</span><s>${x[1]}</s></div>`).join('')}<div class="tot"><span>Valor total</span><s>${DATOS.valor.total}</s></div></div>`;
  if (!esRescate) {
    return `<div class="box">${valor}<div class="cen" style="margin-top:10px"><div class="note">Tu precio de lanzamiento</div><div class="big">${precio}</div><div>Pago único · Acceso inmediato · Sin suscripción</div><div class="note">Menos que un mes de gimnasio</div></div></div>`;
  }
  return `<div class="box">${valor}<div class="cen" style="margin-top:10px"><div class="pill">${CFG.dto}</div></div><div class="precio2"><span>Precio normal</span><s>${P.base}</s></div><div class="precio2"><b>${CFG.etiquetaPrecio}</b><b style="color:var(--gd)">${precio}</b></div><div class="big cen">${precio}</div><div class="cen">Pago único · Acceso inmediato · Sin suscripción</div><div class="note cen">Menos que un mes de gimnasio</div></div>`;
}

/* Testimonios propios del funnel: sin datos reales (DATOS_PESO.testimonios vacío) no se muestra nada. */
function bloqueTestimoniosPeso(titulo = 'Lo que cuentan quienes lo probaron') {
  const ts = (typeof DATOS_PESO !== 'undefined' && DATOS_PESO && DATOS_PESO.testimonios) || [];
  if (!ts.length) return '';
  return `<div class="box"><b>${titulo}</b>${ts.map((t) => `<div class="test2"><div class="av" style="width:42px;height:42px;font-size:16px;margin:0;box-shadow:none;border:0">${esc(String(t.nombre || '?')[0])}</div><div><b>${esc(t.nombre)}</b>${t.detalle ? ` · <span>${esc(t.detalle)}</span>` : ''}<br><span>“${esc(t.texto)}”</span></div></div>`).join('')}</div>`;
}

function html() {
  const h = [];
  h.push(`<div class="tbar${esRescate ? ' up' : ''}"><span>${CFG.barra}</span> <b class="tm">10:00</b></div>`);
  h.push(bloqueEncabezado());
  h.push(`<div class="vid"><video src="/media/hd/oferta.mp4" poster="/media/oferta.jpg" autoplay muted loop playsinline webkit-playsinline preload="auto" width="960" height="540" aria-hidden="true" tabindex="-1" disablepictureinpicture></video></div>`);
  h.push(bloqueHoyMeta());
  h.push(bloqueGrafico());
  h.push(`<div class="box sello">${I_ESCUDO}<div><b>Hecho para arrancar de cero</b><br><span style="color:var(--m);font-size:14px">No necesitás saber boxear ni tener equipo.</span></div></div>`);
  if (!esRescate) h.push(`<div class="box"><b>Por qué arrancar sin plan te frena</b><p style="margin:8px 0 0;color:var(--m);font-size:15px">Sin un plan es fácil largar a las pocas semanas. Un plan por semanas te dice qué hacer, cuánto y cuándo.</p></div>`);
  h.push(`<p>Plan de 4 semanas de shadowboxing en casa, en tu celu, con 4 niveles de carga (de 15 minutos por día a 90 minutos por día), timer de rounds y rutinas guiadas.</p>`);
  h.push(pillPersonas());
  h.push(`<div class="box"><b>Qué incluye</b>${tildes([
    'Plan de 4 semanas de shadowboxing, con 4 niveles de carga (de 15 a 90 minutos por día)',
    'Rutinas guiadas paso a paso',
    'Timer de rounds: te marca cuándo dar y cuándo descansar',
    'Ejercicios cortos (drills) y ranking con tu apodo',
    'Bono: guía de guardia y desplazamientos',
    'En tu celu, sin descargar nada y sin equipo',
  ])}</div>`);
  h.push(tarjetaEspecialista(true));
  h.push(`<div class="box"><b>Así cambia tu forma de arrancar</b><div class="vs"><div><small>ANTES</small>Improvisás y lo dejás a la semana<br>No sabés por dónde empezar<br>Sesiones largas que no sostenés<br>Sin un ritmo que te ordene</div><div class="on"><small>CON BEASTCAMP</small>Plan semana a semana<br>Arrancás desde cero<br>Sesiones desde 15 minutos<br>Timer que marca el ritmo</div></div></div>`);
  h.push(`<div class="box"><b>Cómo funciona</b><div class="st"><i>1</i>Elegís el nivel de carga que se ajusta a tu tiempo</div><div class="st"><i>2</i>Entrenás en casa, desde el celu, con el timer y las rutinas guiadas</div><div class="st"><i>3</i>Sumás puntos y subís en el ranking con tu apodo</div></div>`);
  h.push(`<div class="box"><b>Qué hacés cada semana</b>${SEMANAS_PLAN.map((x) => `<div class="sem"><b>${x[0]}</b><span>${x[1]}</span></div>`).join('')}</div>`);
  h.push(`<div class="box" id="por-que"><b>Por qué te sirve</b>${tildes([
    '<b>Sin gimnasio:</b> entrenás en casa, cuando te queda cómodo.',
    '<b>Sin experiencia:</b> el plan arranca desde cero y sube de a poco.',
    '<b>Desde 15 minutos:</b> podés empezar con lo mínimo y subir después.',
    '<b>Todo el cuerpo:</b> piernas, torso y brazos se mueven a la vez.',
  ])}</div>`);
  h.push(bloqueTestimoniosPeso());
  h.push(bloquePrecio());
  h.push(`<div class="garantia">${I_ESCUDO}<div><b>Garantía de ${G} días</b><br><span style="color:var(--m);font-size:14px">Si en ${G} días no te sirve, te devolvemos tu plata, sin preguntas.</span></div></div>`);
  h.push(`<div class="box faq"><b>Preguntas frecuentes</b>
<details><summary>¿Tengo que saber boxear?</summary>No. El plan arranca de cero y sube de a poco.</details>
<details><summary>¿Cuánto voy a bajar?</summary>Depende de tu punto de partida, de lo que comas, de tu descanso y de cuánto sostengas el plan. No prometemos una cifra.</details>
<details><summary>¿Incluye dieta?</summary>No. Es un plan de entrenamiento; para bajar de peso también cuenta lo que comés.</details>
<details><summary>¿Necesito equipo?</summary>No. Se entrena en casa, sin equipo.</details>
<details><summary>¿Y si tengo una lesión o un problema de salud?</summary>Consultá a tu médico antes de empezar. Las rutinas no reemplazan a un profesional de la salud.</details>
<details><summary>¿Cómo recibo el plan?</summary>Apenas pagás te llega el acceso al celular. Funciona como app, sin descargar nada.</details>
<details><summary>¿Y si no me sirve?</summary>Tenés ${G} días de garantía de devolución, sin vueltas.</details></div>`);
  const boton = esRescate ? CFG.boton : `QUIERO MI PLAN POR ${precio} →`;
  const apoyo = esRescate ? CFG.apoyo + precio : 'Empezar hoy mismo';
  h.push(`<button class="cta" data-reservar>${boton}<span style="display:block;font-size:13px;font-weight:600;margin-top:2px">${apoyo}</span></button>`);
  h.push(confianza);
  h.push(`<p class="note cen" style="margin-top:12px">Pago único, sin suscripción.</p>`);
  return h.join('');
}

$('app').innerHTML = `<div class="scr">${html()}</div>`;
const k = document.createElement('div');
k.className = 'sticky';
k.innerHTML = `<span>Oferta termina en<b class="tm">10:00</b></span><button class="cta" data-reservar>Reservar mi lugar</button>`;
document.body.appendChild(k);
/* La barra fija aparece recién cuando «Por qué te sirve» terminó por encima de ella, así nunca le tapa el final, y se esconde otra vez si la persona sube por encima de ese punto. Sin ese bloque se ve siempre. */
const porQue = document.getElementById('por-que');
if (porQue) {
  const revisaBarra = () => k.classList.toggle('oculta', porQue.getBoundingClientRect().bottom > window.innerHeight - k.offsetHeight);
  k.classList.add('oculta');
  window.addEventListener('scroll', revisaBarra, { passive: true });
  window.addEventListener('resize', revisaBarra, { passive: true });
  window.addEventListener('load', revisaBarra);
  revisaBarra();
}
document.querySelectorAll('[data-reservar]').forEach((b) => (b.onclick = () => reservar(CFG.clave)));
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
