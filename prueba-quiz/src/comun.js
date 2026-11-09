/* Código común de todas las páginas: precios, envíos mínimos, contador, pie y bloques que leen DATOS. */
const P = { base: DATOS.precios.principal, b1: DATOS.precios.back1, b2: DATOS.precios.back2 };
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const vib = (n = 12) => { try { navigator.vibrate && navigator.vibrate(n); } catch (e) {} };
const guardar = (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const leer = (k, d) => { try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const A = leer('bc_resp', {});            // respuestas del quiz (solo en esta sesión del navegador)
const guardaA = () => guardar('bc_resp', A);

/* Envíos: solo «lead» (nombre y mail) y «click» (precio, sin datos personales). Nada más sale del navegador. */
window.__send = (k, d) => {
  if (k !== 'lead' && k !== 'click') return;
  try { navigator.sendBeacon('/api/' + k, new Blob([JSON.stringify(d)], { type: 'application/json' })); } catch (e) {}
};

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

/* Aviso breve que aparece y se va (por ejemplo «Plan ajustado a tu rutina»). */
window.toast = (m) => {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = m; t.setAttribute('role', 'status');
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('in'), 20);
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, 1700);
  vib(8);
};

/* Pie legal fijo con enlaces a Términos y Privacidad (los avisos legales van solo acá). */
function pie() {
  const f = document.createElement('footer');
  f.className = 'ft';
  f.innerHTML = '<a href="/legal/terminos/">Términos y condiciones</a> · <a href="/legal/privacidad/">Política de privacidad</a> · Para mayores de 18. Las rutinas no reemplazan a un profesional de la salud; consultá antes de entrenar si tenés una lesión.';
  document.body.appendChild(f);
}

/* ---------- Bloques que leen DATOS (vacío = no se muestran) ---------- */
const svgMini = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const I_RELOJ = svgMini('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>');
const I_CANDADO = svgMini('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>');
const I_TILDE = svgMini('<path d="M5 12l5 5 9-10"/>');
const I_ESCUDO = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5l15 6v11c0 10-6 17-15 21C15 39 9 32 9 22V11z"/><path d="M17 24l5 5 9-10"/></svg>';
const I_REGALO = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="10" y="26" width="44" height="28" rx="4" fill="#fde68a"/><path d="M10 36h44M32 26v28"/><path d="M32 26c-5-12-16-8-12-3 2 3 8 3 12 3zM32 26c5-12 16-8 12-3-2 3-8 3-12 3z" fill="#fbbf24"/></svg>';

const estrellas = () => (DATOS.estrellas ? `<span class="estr">★★★★★</span> <b>${esc(DATOS.estrellas)}</b>` : '');
const pillPersonas = (txt = 'personas ya lo probaron') => (DATOS.personas ? `<div class="pill">${estrellas()} <span><b>+${esc(DATOS.personas)}</b> ${txt}</span></div>` : '');
const regaloFranja = () => `<div class="gift">${I_REGALO}<span>Al terminar el diagnóstico <b>te dejamos un regalo</b>. Ya está reservado para vos.</span></div>`;

function tarjetaEspecialista(compacta = false) {
  const e = DATOS.especialista || {};
  if (!e.nombre) return '';
  const ini = e.nombre.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const foto = e.foto ? `<img src="${esc(e.foto)}" alt="${esc(e.nombre)}">` : esc(ini);
  const lista = [e.universidad, ...(e.posgrados || [])].filter(Boolean).map((x) => `<li>${esc(x)}</li>`).join('');
  return `<div class="exp"><div class="av">${foto}</div><div class="nm">${esc(e.nombre)}</div><div class="ti">${esc(e.titulo)}</div>${e.matricula ? `<span class="mt">${esc(e.matricula)}</span>` : ''}${e.resumen ? `<p style="font-size:13px;color:var(--m);margin:8px 0 0">${esc(e.resumen)}</p>` : ''}${lista && !compacta ? `<ul>${lista}</ul>` : ''}${DATOS.diagnosticos ? `<div class="chips"><span>${estrellas() || I_TILDE} +${esc(DATOS.diagnosticos)} diagnósticos realizados</span></div>` : ''}</div>`;
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

/* Un solo punto de pago. Con DATOS.pagoUrl vacío no se cobra nada: se muestra «Reservá tu lugar» y se cuenta el clic. */
function pagar(precio) {
  window.__send('click', { precio, t: Date.now() });
  if (DATOS.pagoUrl) { location.href = DATOS.pagoUrl; return; }
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
