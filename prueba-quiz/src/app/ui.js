/* Piezas de interfaz compartidas: íconos SVG, muñecos, escape de HTML, avisos y hoja inferior. Sin emojis: todo es SVG o imagen. */
const $ = (id) => document.getElementById(id);
const $$ = (sel, ra = document) => [...ra.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const movimientoReducido = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

/* Íconos de línea (mismo trazo que los del quiz). */
const TRAZOS = {
  hoy: '<path d="M4 11l8-7 8 7"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>',
  plan: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h6"/>',
  progreso: '<path d="M5 20V12M12 20V5M19 20v-5"/>',
  perfil: '<circle cx="12" cy="8" r="4"/><path d="M4 20c1-4 4-6 8-6s7 2 8 6"/>',
  flama: '<path d="M12 3c.6 3.4 5 5.2 5 10a5 5 0 0 1-10 0c0-1.9.9-3.3 2-4.2.1 1.6.9 2.6 2 2.8C10.4 8.6 10.6 5.4 12 3z"/>',
  play: '<path d="M8 5.5l11 6.5-11 6.5z" style="fill:currentColor"/>',
  pausa: '<path d="M8.5 5.5v13M15.5 5.5v13" style="stroke-width:3.6"/>',
  siguiente: '<path d="M6 5.5l9.5 6.5L6 18.5z"/><path d="M19 5.5v13"/>',
  anterior: '<path d="M18 5.5L8.5 12l9.5 6.5z"/><path d="M5 5.5v13"/>',
  cerrar: '<path d="M6 6l12 12M18 6L6 18"/>',
  tilde: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  atras: '<path d="M15 5l-7 7 7 7"/>',
  der: '<path d="M9 5l7 7-7 7"/>',
  compartir: '<path d="M12 15V3.5"/><path d="M8 7l4-4 4 4"/><path d="M8 10H6.5A2.5 2.5 0 0 0 4 12.5v6A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5v-6a2.5 2.5 0 0 0-2.5-2.5H16"/>',
  agregar: '<rect x="4" y="4" width="16" height="16" rx="4.5"/><path d="M12 8v8M8 12h8"/>',
  copiar: '<rect x="9" y="9" width="11" height="11" rx="3"/><path d="M15 9V6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15H9"/>',
  sonido: '<path d="M4 10v4h3.5l5 4V6l-5 4z"/><path d="M16 9.5c1.4 1.4 1.4 3.6 0 5M18.6 7c2.8 2.8 2.8 7.2 0 10"/>',
  silencio: '<path d="M4 10v4h3.5l5 4V6l-5 4z"/><path d="M16.5 9.5l4 5M20.5 9.5l-4 5"/>',
  voz: '<path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M8 10h8M8 13h5"/>',
  vibra: '<rect x="8" y="3" width="8" height="18" rx="2.5"/><path d="M4 8v8M20 8v8"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  rayo: '<path d="M13 3L5.5 13H11l-1 8L18.5 11H13z"/>',
  sinred: '<path d="M3 9a14 14 0 0 1 4-2.5M21 9a14 14 0 0 0-9-3.5M6.5 12.5a9 9 0 0 1 3-1.8M17.5 12.5a9 9 0 0 0-2.2-1.6M10 16a3.5 3.5 0 0 1 4 0"/><circle cx="12" cy="19" r=".8"/><path d="M4 4l16 16"/>',
  reintentar: '<path d="M20 11a8 8 0 1 0-2.3 6"/><path d="M20 4.5V11h-6.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  candado: '<rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  salir: '<path d="M10 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H10"/><path d="M15 8l4 4-4 4M19 12H9"/>',
  instalar: '<path d="M12 4v11M7.5 11L12 15.5 16.5 11M5 20h14"/>',
  libro: '<path d="M5 4.5h10a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h10"/>',
  copa: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M8.5 20h7"/>',
  guante: '<path d="M7 11V7a3 3 0 0 1 6 0v1h2a3 3 0 0 1 3 3v3a6 6 0 0 1-6 6h-1a5 5 0 0 1-5-5z"/><path d="M7 15h8"/>',
  ayuda: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8M12 17h.01"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="3"/><path d="M4 8l8 5.5L20 8"/>',
};
const ico = (k, cl = '') => `<svg class="ic ${cl}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${TRAZOS[k] || ''}</svg>`;

/* Muñeco 3D (mismo archivo que usa el quiz; fondo blanco, se funde con la tarjeta por mix-blend-mode). */
const mun = (k, cl = 'im3d', ancho = 360, alto = 480) => `<img class="${cl}" src="/img/muneco-${esc(k)}.webp" alt="" width="${ancho}" height="${alto}" decoding="async">`;

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const primerNombre = (s) => String(s || '').trim().split(/\s+/)[0] || '';

/* Aviso breve (el mismo .toast del quiz). */
function toast(m) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = m; t.setAttribute('role', 'status');
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('in'), 20);
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, 2200);
  vibrar(8);
}
function vibrar(p = 12) { try { if (AJ().vibracion && navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
const AJ = () => (typeof PROG !== 'undefined' && PROG && PROG.ajustes) || { sonido: true, voz: true, vibracion: true };

/* Anuncio para lectores de pantalla (cambios de pantalla y de fase). */
function anunciar(txt) {
  const a = $('anuncio'); if (!a) return;
  a.textContent = txt;
}

/* Hoja inferior (la misma .velo/.hoja del quiz). Devuelve una función para cerrarla. */
function hoja(html, { alCerrar } = {}) {
  const previo = document.activeElement;
  const v = document.createElement('div');
  v.className = 'velo';
  v.innerHTML = `<div class="hoja" role="dialog" aria-modal="true">${html}</div>`;
  const cerrar = () => { v.remove(); document.removeEventListener('keydown', tecla); if (previo && previo.focus) previo.focus(); if (alCerrar) alCerrar(); };
  const tecla = (e) => {
    if (e.key === 'Escape') cerrar();
    if (e.key === 'Tab') {   // el foco se queda dentro de la hoja
      const f = $$('button,a[href],input', v).filter((x) => !x.disabled);
      if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  };
  v.addEventListener('click', (e) => { if (e.target === v) cerrar(); });
  document.addEventListener('keydown', tecla);
  document.body.appendChild(v);
  const primero = $$('[autofocus],button', v)[0]; if (primero) primero.focus({ preventScroll: true });
  return { cerrar, el: v };
}

/* Anima las barras y los anillos de progreso después de pintar la pantalla (con movimiento reducido salta directo). */
function animarBarras(raiz = document) {
  const ir = () => {
    $$('[data-w]', raiz).forEach((e) => { e.style.width = e.dataset.w + '%'; });
    $$('[data-p]', raiz).forEach((e) => { const r = +e.getAttribute('r'), c = 2 * Math.PI * r; e.style.strokeDasharray = c; e.style.strokeDashoffset = c * (1 - Math.min(1, Math.max(0, +e.dataset.p))); });
  };
  if (movimientoReducido()) ir(); else requestAnimationFrame(() => requestAnimationFrame(ir));
}
const barra = (pct, cl = '') => `<div class="bar ${cl}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><i data-w="${Math.round(pct)}"></i></div>`;

/* Cuenta de 0 al número (puntos que suben). */
function contar(el, hasta, ms = 1100) {
  if (!el) return;
  if (movimientoReducido() || hasta <= 0) { el.textContent = hasta; return; }
  const t0 = performance.now();
  let listo = false;
  const paso = () => { if (listo) return; const k = Math.min(1, (performance.now() - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(hasta * e); if (k < 1) requestAnimationFrame(paso); };
  requestAnimationFrame(paso);
  setTimeout(() => { listo = true; el.textContent = hasta; }, ms + 60);   // el número final siempre queda, aunque la pantalla estuviera en segundo plano
}

/* Copiar al portapapeles (con respaldo para navegadores viejos). */
async function copiarTexto(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch (e) {}
  try {
    const a = document.createElement('textarea'); a.value = t; a.setAttribute('readonly', ''); a.style.cssText = 'position:fixed;opacity:0;top:0';
    document.body.appendChild(a); a.select(); const ok = document.execCommand('copy'); a.remove(); return ok;
  } catch (e) { return false; }
}
