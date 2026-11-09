/* Quiz BeastCamp (/quiz/). Sin botón «Empezar»: la primera pantalla ya es la pregunta gancho. Todo entra sin scroll. */
const S0 = [
  { t: 'q', k: 'hook', video: 'hook', est: 'B', regalo: true, pill: true,
    titulo: '¿Qué te pasa más cuando entrenás solo?', sub: 'Elegí la que más te pasa',
    o: [['No sé si mis golpes salen bien', 'm_golpes'], ['Me quedo sin aire enseguida', 'm_aire'], ['Improviso, no tengo un plan', 'm_plan'], ['Arranco y no soy constante', 'm_const']] },
  { t: 'q', k: 'nivel', est: 'B', titulo: '¿Cuál es tu nivel?', globo: 'Sea cual sea tu nivel, el plan se arma para el tuyo y sube de a poco.',
    o: [['Estoy empezando', 'n_empiezo'], ['Menos de 6 meses', 'n_seis'], ['1 a 3 años', 'n_anios'], ['Más de 3 años', 'n_mas']] },
  { t: 'q', k: 'obj', est: 'B', chico: true, titulo: '¿Qué querés lograr?', globo: 'Elegí lo principal: tu plan se ordena alrededor de eso.',
    o: [['Aprender técnica', 'o_tecnica'], ['Bajar de peso', 'o_peso'], ['Ganar resistencia', 'o_resist'], ['Prepararme para sparring', 'o_sparring'], ['Descargar estrés', 'o_estres'], ['Competir (amateur)', 'o_competir']] },
  { t: 'info' },
  { t: 'noticia' },
  { t: 'multi', k: 'frenos', titulo: '¿Qué te frena hoy para entrenar mejor?', sub: 'Marcá todo lo que aplique',
    o: [['No sé qué hacer', 'f_ayuda'], ['Me falta tiempo', 'f_tiempo'], ['Me falta constancia', 'f_const'], ['Me aburro', 'f_aburro'], ['No sé si lo hago bien', 'f_ojo'], ['Me falta equipo', 'f_equipo']] },
  { t: 'q', k: 'lugar', est: 'B', titulo: '¿Dónde entrenás?', globo: 'Para el plan no hace falta equipo: se entrena en casa, con tu celu y el timer.',
    o: [['Casa, sin equipo', 'l_casa'], ['Casa, con soga o bolsa', 'l_soga'], ['Patio o plaza', 'l_arbol'], ['Gimnasio, quiero sumar en casa', 'l_pesa']] },
  { t: 'q', k: 'tiempo', est: 'B', titulo: '¿Cuánto querés dedicarle por semana?', globo: 'Más horas no es mejor si no te recuperás: el plan sube la carga de a poco.',
    o: [['Arranque', 't1', '2-3 días · 15-30 min'], ['Ritmo', 't2', '3-4 días · 30-40 min'], ['Impulso', 't3', '4-5 días · 45-60 min'], ['Fighter', 't4', '5-6 días · 60-90 min']] },
  { t: 'q', k: 'precio', est: 'B', titulo: '¿Cuánto pagarías por un plan de 4 semanas armado para vos?',
    o: [['Solo gratis', 'p_gratis'], ['Hasta $5.000', 'p_5'], ['$5.000 a $10.000', 'p_10'], ['$10.000 a $20.000', 'p_20']] },
  { t: 'experto' },
  { t: 'mail', video: 'mail' },
  { t: 'carga' },
  { t: 'perfil', video: 'espejo' },
];
/* La noticia solo aparece si hay una con fuente cargada en DATOS. */
const S = S0.filter((x) => x.t !== 'noticia' || tarjetaNoticia());
let s = 0;
const raiz = $('app');
const forma = $('shell');

function setBg(n) {
  const bg = $('bg');
  if (!n) { forma.classList.remove('conbg'); if (bg) bg.innerHTML = ''; return; }
  forma.classList.add('conbg');
  const v = videoDe(n);
  bg.replaceChildren(v);
  v.play().catch(() => {});
}

/* Un solo elemento por video: el que se precarga es el mismo que después se muestra, así no se baja dos veces. */
const VIDEOS = {};
function videoDe(n) {
  if (VIDEOS[n]) return VIDEOS[n];
  const v = document.createElement('video');
  v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true; v.preload = 'auto';
  v.poster = `/media/${n}.jpg`;
  v.src = `/media/hd/${n}.mp4`;
  return (VIDEOS[n] = v);
}

/* Espera a que el video pueda reproducirse entero; si la conexión no da, a los 20 s sigue con el próximo. */
const videoListo = (v) => new Promise((listo) => {
  if (v.readyState >= 4) return listo();
  v.addEventListener('canplaythrough', listo, { once: true });
  v.addEventListener('error', listo, { once: true });
  setTimeout(listo, 20000);
});

/* Baja todo en el orden del funnel apenas abre la página. */
const precargadas = [];
async function precargar() {
  const urls = ['mail', 'espejo', 'oferta'].map((n) => `/media/${n}.jpg`);
  S.forEach((x) => {
    if (x.o) x.o.forEach((o) => urls.push(`/img/muneco-${o[1]}.webp`));
    if (x.t === 'info') ['e_pies', 'e_guardia', 'e_resp'].forEach((k) => urls.push(`/img/muneco-${k}.webp`));
  });
  urls.forEach((u) => { const i = new Image(); i.src = u; precargadas.push(i); });
  if (navigator.connection && navigator.connection.saveData) return;   // con ahorro de datos solo imágenes: el póster reemplaza al video
  await videoListo(videoDe('hook'));
  for (const n of ['mail', 'espejo', 'oferta']) {
    const v = videoDe(n);
    /* iOS ignora preload hasta que el video arranca: se le da play y se pausa, salvo que ya esté en pantalla. */
    v.play().then(() => { if (!v.isConnected) v.pause(); }).catch(() => {});
    await videoListo(v);
  }
}
const progreso = () => { $('barra').style.width = Math.max(4, Math.round((s / (S.length - 1)) * 100)) + '%'; };
function siguiente() {
  vib();
  const e = raiz.firstElementChild;
  if (e) e.classList.add('sale');
  setTimeout(() => { s++; if (s >= S.length) return; dibuja(); }, 170);
}

function tarjeta(o, est, i, chico, multi) {
  const ico = MUNECO[o[1]]();
  return `<button class="c ${est}${chico ? ' chico' : ''}" data-i="${i}">${multi ? '<span class="chk"></span>' : ''}${ico}<b>${esc(o[0])}${o[2] ? `<small>${esc(o[2])}</small>` : ''}</b></button>`;
}

function dibuja() {
  const x = S[s];
  setBg(x.video);
  progreso();
  let h = '';
  if (x.t === 'q') {
    h = (x.pill ? pillPersonas() : '') + `<h2>${esc(x.titulo)}</h2>` + (x.sub ? `<p class="sub">${esc(x.sub)}</p>` : '') + (x.globo ? `<div class="globo">${esc(x.globo)}</div>` : '') +
      `<div class="grid">${x.o.map((o, i) => tarjeta(o, x.est, i, x.chico, false)).join('')}</div>` + (x.regalo ? regaloFranja() : '');
  } else if (x.t === 'multi') {
    h = `<h2>${esc(x.titulo)}</h2><p class="sub">${esc(x.sub)}</p><div class="grid">${x.o.map((o, i) => tarjeta(o, 'B', i, true, true)).join('')}</div><button class="cta" id="seguir" disabled>Continuar</button>`;
  } else if (x.t === 'info') {
    h = `<h2>Entrenar mal te frena más que no entrenar</h2><div class="ill">${ESCENA.pies}<div><b>Pies</b><span>Juntos y sin base: perdés equilibrio en cada golpe.</span></div></div><div class="ill">${ESCENA.guardia}<div><b>Guardia</b><span>Manos bajas, mentón al aire.</span></div></div><div class="ill">${ESCENA.respiracion}<div><b>Respiración</b><span>La aguantás y te quedás sin aire en el 2º round.</span></div></div><p class="sub" style="margin-top:8px">Con una semana guiada se corrigen los tres.</p><button class="cta" id="seguir">Seguir</button>`;
  } else if (x.t === 'noticia') {
    h = `<h2>¿Llegaste a ver esto?</h2><p class="sub">Un estudio reciente sobre entrenamiento de boxeo</p>${tarjetaNoticia()}<button class="cta" id="seguir">Sí, lo vi</button><button class="cta s" id="seguir2">No, es la primera vez que lo veo</button>`;
  } else if (x.t === 'experto') {
    h = `<div class="tag cen">Tu diagnóstico personalizado</div><h2>Un diagnóstico de 3 minutos, privado y sin costo</h2><p class="sub">Con tus respuestas armamos tu plan de 4 semanas.</p>${tarjetaEspecialista()}${chipsGatillos()}<button class="cta" id="seguir">Generar mi diagnóstico →</button>`;
  } else if (x.t === 'mail') {
    h = `<div class="tag cen">Último paso</div><h2>Tu plan está casi listo</h2><p class="sub">Decinos cómo te llamás y a dónde guardamos tu plan.</p><input id="nm" type="text" placeholder="Tu nombre o apodo" autocomplete="given-name" value="${esc(A.nombre || '')}"><input id="m" type="email" placeholder="tu@mail.com" autocomplete="email" value="${esc(A.mail || '')}"><button class="cta" id="seguir">Quiero mi plan</button>${chipsGatillos()}`;
  } else if (x.t === 'carga') {
    return cargando();
  } else if (x.t === 'perfil') {
    const pro = /Impulso|Fighter/i.test(A.tiempo || '');
    h = `<div class="tag cen">Tu perfil</div><h2>${esc(A.nombre || 'Tu plan')}, así queda tu plan</h2><div class="box"><b>Tu punto de partida</b><br><span style="color:var(--m)">${esc(A.nivel || '')} · ${esc(A.obj || '')}</span></div><div class="box"><b>Tu camino</b><div class="sem"><b>Semana 1</b><span>Pies, guardia, jab y cross</span></div><div class="sem"><b>Semana 2</b><span>Esquivas y sombra</span></div><div class="sem"><b>Semana 3</b><span>Combinaciones y ritmo</span></div><div class="sem"><b>Semana 4</b><span>${pro ? 'Rounds de 3 min con más volumen y pausas controladas' : 'Rounds completos de 3 min'}</span></div></div><div class="box"><b>Tu carga</b><br><span style="color:var(--m)">${esc((A.tiempo || '').split(' · ')[0])}. ${pro ? 'Arrancás con una semana de adaptación y 1 día de descanso total: más horas no es mejor si no te recuperás.' : 'Subimos la carga de a poco, según cómo te sientas.'}</span></div><button class="cta" id="ver">Ver mi plan</button>`;
  }
  raiz.innerHTML = `<div class="scr ${x.t}">${h}</div>`;
  window.scrollTo(0, 0);
  enlaza(x);
}

function enlaza(x) {
  const q = (sel) => raiz.querySelector(sel);
  if (x.t === 'q') {
    raiz.querySelectorAll('.c').forEach((b) => (b.onclick = () => {
      const o = x.o[+b.dataset.i];
      b.classList.add('on'); A[x.k] = o[0]; guardaA(); vib(); setTimeout(siguiente, 220);
    }));
  } else if (x.t === 'multi') {
    const sel = new Set();
    raiz.querySelectorAll('.c').forEach((b) => (b.onclick = () => {
      const i = +b.dataset.i; sel.has(i) ? sel.delete(i) : sel.add(i);
      b.classList.toggle('on'); q('#seguir').disabled = sel.size === 0; vib(8);
    }));
    q('#seguir').onclick = () => { A[x.k] = [...sel].map((i) => x.o[i][0]); guardaA(); siguiente(); };
  } else if (x.t === 'info' || x.t === 'experto') {
    q('#seguir').onclick = siguiente;
  } else if (x.t === 'noticia') {
    q('#seguir').onclick = () => { A.noticia = 'si'; guardaA(); siguiente(); };
    q('#seguir2').onclick = () => { A.noticia = 'no'; guardaA(); siguiente(); };
  } else if (x.t === 'mail') {
    q('#seguir').onclick = () => {
      const e = q('#m');
      if (!/^\S+@\S+\.\S+$/.test(e.value)) { e.style.borderColor = '#dc2626'; return; }
      A.nombre = (q('#nm').value || '').trim().slice(0, 60) || 'Campeón'; A.mail = e.value.trim(); guardaA();
      window.__send('lead', { nombre: A.nombre, mail: A.mail, nivel: A.nivel || '', t: Date.now() });
      siguiente();
    };
  } else if (x.t === 'perfil') {
    q('#ver').onclick = () => { guardaA(); location.href = '/oferta/'; };
  }
}

/* Carga: 6 mensajes de ~1,6 s cada uno. El análisis se frena en dos puntos hasta que la persona responde un pop-up. */
function cargando() {
  const R = 402;
  const nom = A.nombre || 'Campeón';
  const msgs = [
    'Analizando tus respuestas…',
    `Detectando tu nivel: ${A.nivel || ''}`,
    `Eligiendo los drills para tu objetivo: ${A.obj || ''}`,
    `Ajustando la carga a tu tiempo: ${A.tiempo || ''}`,
    'Armando tus 4 semanas de shadowboxing…',
    `Listo, ${nom}. Tu plan está armado.`,
  ];
  raiz.innerHTML = `<div class="scr"><h2>${esc(nom)}, estamos preparando tu plan</h2><div class="ring"><svg width="150" height="150"><circle cx="75" cy="75" r="64" stroke="#e5ebe6" stroke-width="11" fill="none"/><circle id="rc" cx="75" cy="75" r="64" stroke="#16A34A" stroke-width="11" fill="none" stroke-linecap="round" stroke-dasharray="${R}" stroke-dashoffset="${R}"/></svg><b id="pc">0%</b></div>${msgs.map((m, i) => `<div class="chkl" id="c${i}"><div class="ic"></div>${esc(m)}</div>`).join('')}</div>`;
  window.scrollTo(0, 0);
  let p = 0, pausa = false;
  const paso = 100 / msgs.length;                 // cada mensaje ocupa un sexto del avance
  const hitos = [
    { en: Math.round(paso * 2), pregunta: `${nom}, ¿podés entrenar a la misma hora todos los días?`, opc: ['Sí, ya tengo mi horario', 'Algunos días'], dato: 'Un horario fijo ayuda a sostener la constancia.', aviso: 'Plan ajustado a tu rutina', clave: 'horaFija' },
    { en: Math.round(paso * 4), pregunta: '¿Preferís entrenar a la mañana o a la noche?', opc: ['A la mañana', 'A la noche'], dato: 'Elegí el momento en el que más rendís.', aviso: 'Horario guardado', clave: 'momento' },
  ];
  const marca = () => msgs.forEach((_, i) => { const e = $('c' + i); if (e && p >= (i + 1) * paso - 0.01) { e.classList.add('d'); e.querySelector('.ic').textContent = '✓'; } });
  const iv = setInterval(() => {
    if (pausa) return;
    p += 1; $('pc').textContent = p + '%'; $('rc').style.strokeDashoffset = R - (R * p) / 100;
    marca();
    const h = hitos.find((m) => p === m.en);
    if (h) {
      pausa = true;
      const v = document.createElement('div'); v.className = 'velo';
      v.innerHTML = `<div class="hoja"><div class="tag">Para terminar tu plan</div><h3>${esc(h.pregunta)}</h3><div class="globo">${esc(h.dato)}</div>${h.opc.map((t, i) => `<button class="cta${i ? ' s' : ''}" data-i="${i}">${esc(t)}</button>`).join('')}</div>`;
      document.body.appendChild(v);
      v.querySelectorAll('button').forEach((b) => (b.onclick = () => { A[h.clave] = h.opc[+b.dataset.i]; guardaA(); v.remove(); pausa = false; window.toast(h.aviso); }));
    }
    if (p >= 100) { clearInterval(iv); setTimeout(() => { if (S[s].t === 'carga') siguiente(); }, 900); }
  }, 96);                                          // 100 pasos x 96 ms ≈ 9,6 s (6 mensajes x 1,6 s)
}

pie();
dibuja();
precargar();
