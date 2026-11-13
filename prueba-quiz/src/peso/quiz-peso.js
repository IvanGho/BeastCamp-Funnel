/* Quiz de bajar de peso (/quiz-peso/). Mismo motor y mismo aspecto que quiz.js: la primera pantalla ya es una pregunta, todas las opciones son
   tarjetas con muñeco 3D y todo entra sin scroll. Va dentro de una función para no chocar con nombres de otros archivos que se inlinean en la misma página.
   Las respuestas quedan en sessionStorage (A). Del quiz no sale ningún dato al servidor: ni nombre, ni peso, ni altura, ni edad (el servicio de leads exige un mail y este quiz ya no lo pide). */

(() => {
  const F = DATOS_PESO.fuentes || {};
  const fuenteOk = (k) => !!(F[k] && F[k].verificada && F[k].url);
  const coma = (n, d = 1) => n.toFixed(d).replace('.', ',');
  const imc1 = (imc) => Math.round(imc * 10) / 10;   // el IMC que se muestra (1 decimal): la categoría sale de este valor, no del sin redondear
  const enlaceFuente = (txt, url) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(txt)}</a>`;

  /* ---------- Pantallas ---------- */
  /* Cada opción es [texto, muñeco, detalle]. El muñeco es la clave de /img/muneco-<clave>.webp, también en «cuerpo»: ahí son los cuatro propios de este funnel
     (c_delgado, c_normal, c_kilos y c_sobrepeso: el mismo boxeador con cuatro contexturas). c_guardia es e_guardia sin la flecha roja, que en este funnel no señala nada. Se muestran con img3d(clave) como los demás; no están en CLAVES_MUNECO. */
  const MARCA = 'Marcá todas las que quieras';
  const S0 = [
    { t: 'q', k: 'cuerpo', video: 'hook', alto: true, pill: true, regalo: true, pregunta: '¿Cómo ves tu cuerpo hoy?', titulo: 'Bajá de peso sin complicarte con shadowboxing en casa', tituloHtml: 'Bajá de peso <em>peleando con tu sombra</em>', sub: 'Respondé 1 pregunta y descubrí cómo conseguirlo.',
      o: [['Delgado con algo de panza', 'c_delgado'], ['Normal', 'c_normal'], ['Con kilos de más', 'c_kilos'], ['Con bastante sobrepeso', 'c_sobrepeso']] },
    { t: 'medida', k: 'edad', unidad: 'años', maxTxt: '65+ años', muneco: 'n_seis', titulo: '¿Cuántos años tenés?', sub: 'Deslizá hasta tu edad.', min: 18, max: 65, def: 38 },
    { t: 'q', k: 'meta', alto: true, titulo: '¿Cómo te gustaría verte?',
      o: [['Un par de talles menos', 'o_peso'], ['En forma, sin exagerar', 'l_casa'], ['Atlético', 'o_tecnica'], ['Marcado', 'n_anios']] },
    { t: 'multi', k: 'zonas', filas: true, titulo: '¿Qué querés cambiar primero?', sub: MARCA, solo: 4,
      o: [['La panza', 'o_peso'], ['Los costados', 'c_guardia'], ['El pecho', 'o_resist'], ['Los brazos', 'l_pesa'], ['Todo un poco', 'o_sparring']] },
    { t: 'q', k: 'forma', titulo: '¿Hace cuánto estuviste en tu mejor forma?',
      o: [['Menos de un año', 't2'], ['Entre 1 y 3 años', 't3'], ['Más de 3 años', 't1'], ['Nunca', 'm_plan']] },
    { t: 'publicacion' },
    { t: 'q', k: 'exp', titulo: '¿Alguna vez boxeaste o hiciste artes marciales?', globo: 'No hace falta. El plan arranca desde cero.',
      o: [['Nunca', 'n_empiezo'], ['Estoy empezando', 'l_soga'], ['Probé alguna vez', 'n_seis'], ['Sí, hace años', 'n_anios']] },
    { t: 'info30' },
    { t: 'q', k: 'actividad', titulo: '¿Cuánto te moviste en los últimos 3 meses?',
      o: [['Nada', 'f_aburro'], ['Alguna que otra vez', 'f_const'], ['Una vez por semana', 'm_const'], ['Varias veces por semana', 'o_resist']] },
    { t: 'q', k: 'escaleras', titulo: '¿Cómo llegás después de subir dos pisos por escalera?',
      o: [['Sin aire', 'm_aire'], ['Agitado, pero bien', 'e_resp'], ['Tranquilo', 'n_seis']] },
    { t: 'q', k: 'dia', titulo: '¿Cómo es un día normal tuyo?',
      o: [['Sentado casi todo el día', 'f_tiempo'], ['Un poco de cada cosa', 'l_casa'], ['De pie casi todo el día', 'l_arbol'], ['Trabajo físico', 'l_pesa']] },
    { t: 'q', k: 'sueno', titulo: '¿Cuánto dormís por noche?', globo: 'El descanso también cuenta a la hora de sostener un plan.',
      o: [['Menos de 5 horas', 'o_estres'], ['5 a 6 horas', 't1'], ['7 a 8 horas', 'n_empiezo'], ['Más de 8 horas', 'l_casa']] },
    { t: 'multi', k: 'causas', titulo: '¿Qué te hizo subir de peso estos años?', sub: MARCA,
      o: [['Mucho trabajo y estrés', 'o_estres'], ['Menos tiempo por la familia', 'f_tiempo'], ['Una separación o un mal momento', 'f_ayuda'], ['El cuerpo ya no responde igual', 'm_aire'], ['Picotear o comer afuera', 'o_peso'], ['Otra cosa', 'm_plan']] },
    { t: 'noticia' },
    { t: 'infoboxeo' },
    { t: 'multi', k: 'frenos', titulo: '¿Qué te frenó las otras veces?', sub: MARCA,
      o: [['No tenía un plan', 'm_plan'], ['Me faltó tiempo', 'f_tiempo'], ['Me aburrí', 'f_aburro'], ['Perdí la motivación', 'f_const'], ['Me dolía algo', 'e_pies'], ['El gimnasio no es lo mío', 'f_equipo']] },
    { t: 'q', k: 'tiempo', titulo: '¿Cuánto tiempo le podés dedicar?', globo: 'Podés arrancar con lo mínimo y subir después.',
      o: [['Arranque', 't1', '2-3 días · 15-30 min'], ['Ritmo', 't2', '3-4 días · 30-40 min'], ['Impulso', 't3', '4-5 días · 45-60 min']] },
    { t: 'medida', k: 'altura', unidad: 'cm', muneco: 'c_guardia', titulo: '¿Cuánto medís?', sub: 'Deslizá hasta tu altura.', min: 140, max: 220, def: 170 },
    { t: 'medida', k: 'peso', unidad: 'kg', muneco: 'o_peso', titulo: '¿Cuánto pesás?', sub: 'Deslizá hasta tu peso.', min: 40, max: 200, def: 85 },
    { t: 'medida', k: 'pesoMeta', unidad: 'kg', muneco: 'o_tecnica', titulo: '¿A qué peso te gustaría llegar?', sub: 'Deslizá hasta tu meta.', min: 40, max: 200, def: 75 },
    { t: 'q', k: 'evento', chico: true, titulo: '¿Tenés algo importante en los próximos meses?',
      o: [['Vacaciones', 'l_arbol'], ['Un casamiento o evento', 'o_competir'], ['Un cumpleaños', 'p_gratis'], ['No, lo hago por mí', 'n_empiezo']] },
    { t: 'experto' },
    { t: 'carga' },
    { t: 'perfil', video: 'oferta' },
  ];

  /* Pantallas informativas: cada fila lleva su muñeco con movimiento por CSS (e-pies, e-guardia o e-resp, de base.css). */
  const ESCENAS = {
    info30: [['m_aire', 'e-resp'], ['f_tiempo', 'e-guardia'], ['m_plan', 'e-pies']],
    infoboxeo: [['o_resist', 'e-resp'], ['l_casa', 'e-guardia'], ['t3', 'e-pies']],
  };
  const escena = (t, i) => img3d(ESCENAS[t][i][0], `esc3d ${ESCENAS[t][i][1]}`);

  /* Slide «¿Llegaste a ver esto?» con una publicación (imagen + texto con su fuente), cargada en DATOS_PESO.publicacion.
     Sin contenido real cargado la slide NO sale en el sitio publicado: solo se ve en tu compu (localhost) como esqueleto, con el espacio de la imagen vacío. */
  const hayPublicacion = () => { const p = DATOS_PESO.publicacion || {}; return !!(p.titular || p.imagen) || /^(localhost|127\.0\.0\.1)$/.test(location.hostname); };
  function tarjetaPublicacion() {
    const n = DATOS_PESO.publicacion || {};
    const img = n.imagen ? `<img src="${esc(n.imagen)}" alt="${esc(n.alt || '')}">` : '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="8" y="12" width="48" height="40" rx="5"/><circle cx="24" cy="26" r="5"/><path d="M8 46l14-14 10 10 8-8 16 16"/></svg>';
    const tx = (n.etiqueta ? `<div class="et">${esc(n.etiqueta)}</div>` : '') + (n.titular ? `<h3>${esc(n.titular)}</h3>` : '') + (n.bajada ? `<p>${esc(n.bajada)}</p>` : '')
      + (n.fuente ? `<div class="fu">${esc(n.fuente)}${n.fecha ? ' · ' + esc(n.fecha) : ''}${n.enlace ? ` · <a href="${esc(n.enlace)}" target="_blank" rel="noopener noreferrer">Ver la fuente</a>` : ''}</div>` : '');
    return `<div class="nota pub"><div class="im">${img}</div>${tx ? `<div class="tx">${tx}</div>` : ''}</div>`;
  }

  /* La noticia solo aparece si hay una con fuente cargada en DATOS_PESO. */
  function tarjetaNoticiaPeso() {
    const n = DATOS_PESO.noticia || {};
    if (!n.titular) return '';
    const img = n.imagen ? `<img src="${esc(n.imagen)}" alt="">` : '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M6 34h14l6-16 10 30 8-22 5 8h9"/></svg>';
    return `<div class="nota"><div class="im">${img}</div><div class="tx"><div class="et">${esc(n.etiqueta)}</div><h3>${esc(n.titular)}</h3>${n.bajada ? `<p>${esc(n.bajada)}</p>` : ''}${n.cuerpo ? `<p class="cu">${esc(n.cuerpo)}</p>` : ''}${n.aviso ? `<p class="aviso">${esc(n.aviso)}</p>` : ''}<div class="fu">${esc(n.fuente)}${n.fecha ? ' · ' + esc(n.fecha) : ''}${n.enlace ? ` · <a href="${esc(n.enlace)}" target="_blank" rel="noopener noreferrer">Ver el estudio</a>` : ''}</div></div></div>`;
  }

  /* Además de «cuerpo», «meta» y «zonas» (alto y filas), otras pantallas ocupan todo el alto de la ventana (peso.css): «forma» y «actividad» son 4 filas, «causas» y «frenos»
     son 6 tarjetas altas (2x3) y las demás con botón de avanzar (FIJAS) reparten su contenido entre el título y el botón, que queda fijo abajo. */
  const LLENAS = { forma: 'filas cuatro', actividad: 'filas cuatro', exp: 'filas cuatro', escaleras: 'filas tres', dia: 'filas cuatro', sueno: 'filas cuatro', tiempo: 'filas tres', evento: 'filas cuatro', causas: 'alto seis', frenos: 'alto seis' };
  const FIJAS = ['info30', 'publicacion', 'infoboxeo', 'medida', 'experto', 'perfil'];

  const S = S0.filter((x) => (x.t !== 'noticia' || tarjetaNoticiaPeso()) && (x.t !== 'publicacion' || hayPublicacion()));
  let s = 0;
  let bloqueado = false;                 // evita saltar dos pantallas si se toca dos veces seguidas
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
    const v = videoSilencioso(document.createElement('video'), `/media/${n}.jpg`);
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
    const urls = ['oferta'].map((n) => `/media/${n}.jpg`);
    S.forEach((x) => {
      if (x.o) x.o.forEach((o) => urls.push(`/img/muneco-${o[1]}.webp`));
      if (ESCENAS[x.t]) ESCENAS[x.t].forEach((e) => urls.push(`/img/muneco-${e[0]}.webp`));
      if (x.muneco) urls.push(`/img/muneco-${x.muneco}${window.devicePixelRatio >= 1.5 && CON_2X.includes(x.muneco) ? '@2x' : ''}.webp`);
    });
    urls.forEach((u) => { const i = new Image(); i.src = u; precargadas.push(i); });
    if (navigator.connection && navigator.connection.saveData) return;   // con ahorro de datos solo imágenes: el póster reemplaza al video
    await videoListo(videoDe('hook'));
    for (const n of ['oferta']) {
      const v = videoDe(n);
      /* iOS ignora preload hasta que el video arranca: se le da play y se pausa, salvo que ya esté en pantalla. */
      v.play().then(() => { if (!v.isConnected) v.pause(); }).catch(() => {});
      await videoListo(v);
    }
  }

  const progreso = () => { document.body.classList.toggle('sinprog', S[s] && (S[s].t === 'carga' || S[s].t === 'perfil')); $('barra').style.width = Math.max(4, Math.round((s / (S.length - 1)) * 100)) + '%'; };
  function siguiente() {
    vib();
    const e = raiz.firstElementChild;
    if (e) e.classList.add('sale');
    setTimeout(() => { s++; if (s >= S.length) return; dibuja(); }, 170);
  }

  /* ---------- Piezas ---------- */
  /* Igual que tarjeta() de quiz.js: muñeco a la izquierda y texto a la derecha; chico cuando hay 5 o 6 opciones. */
  function tarjeta(o, i, chico, multi) {
    return `<button class="c B${chico ? ' chico' : ''}" data-i="${i}"${multi ? ' aria-pressed="false"' : ''}>${multi ? '<span class="chk"></span>' : ''}${img3d(o[1])}<b>${esc(o[0])}${o[2] ? `<small>${esc(detalleSinCortes(o[2]))}</small>` : ''}</b></button>`;
  }
  /* Regalo de la primera pantalla: la misma franja .gift de quiz.js, con lo que este plan sí incluye. */
  const regaloPeso = () => `<div class="gift">${I_REGALO}<span>Al terminar <b>te dejamos un regalo</b>. Ya está reservado para vos.</span></div>`;
  /* Píldora de la primera pantalla: la cifra sale de DATOS_PESO.personas (solo cifra real). */
  const pillPeso = () => (DATOS_PESO.personas ? `<div class="pill pill-c"><span class="estr">★</span> <span><b>+${esc(DATOS_PESO.personas)}</b> peleadores lo probaron este mes</span></div>` : '');
  const filaIll = (img, tit, txt) => `<div class="ill">${img}<div><b>${esc(tit)}</b><span>${esc(txt)}</span></div></div>`;
  /* Chips honestos: lo único que se afirma es lo que el código cumple (peso y altura no salen del navegador). */
  const chipsPrivado = (conTiempo) => `<div class="chips">${conTiempo ? `<span>${I_RELOJ} 3 minutos</span>` : ''}<span>${I_CANDADO} Tu peso y tu altura no salen de tu celu</span></div>`;
  const NOMBRE_CAT = { bajo: 'Bajo peso', normal: 'Rango normal', sobrepeso: 'Sobrepeso', obesidad: 'Obesidad' };

  /* Barra de IMC con marcador: bajo hasta 18,5 · normal hasta 25 · sobrepeso hasta 30 · obesidad desde 30 (escala de 15 a 40). */
  function barraImc(imc) {
    imc = imc1(imc);
    const pos = Math.min(99, Math.max(1, ((imc - 15) / 25) * 100));
    return `<div class="imcb" role="img" aria-label="IMC ${coma(imc)}: ${NOMBRE_CAT[CALC.categoria(imc)]}"><s class="b0" style="width:14%"></s><s class="b1" style="width:26%"></s><s class="b2" style="width:20%"></s><s class="b3" style="width:40%"></s><i style="left:${pos.toFixed(1)}%"></i></div>` +
      '<div class="imcl"><span style="width:14%">Bajo</span><span style="width:26%">Normal</span><span style="width:20%">Sobrepeso</span><span style="width:40%">Obesidad</span></div>';
  }

  /* Proyección de peso de hoy a la meta con CALC.curva. */
  function grafico(peso, meta, fechaTxt) {
    const W = 320, H = 130, pl = 16, pr = 16, pt = 34, pb = 34;   // más baja en celulares chicos para que el perfil entre sin scroll
    const pts = CALC.curva(peso, meta, 40);
    const rango = Math.max(1, peso - meta);
    const X = (x) => +(pl + x * (W - pl - pr)).toFixed(1);
    const Y = (kg) => +(pt + (1 - (kg - meta) / rango) * (H - pt - pb)).toFixed(1);
    const linea = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x)} ${Y(p.kg)}`).join('');
    const area = `${linea}L${X(1)} ${H - pb}L${X(0)} ${H - pb}Z`;
    return `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Proyección de ${peso} kg hoy a ${meta} kg en ${esc(fechaTxt)}">` +
      '<defs><linearGradient id="gp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16A34A" stop-opacity=".28"/><stop offset="1" stop-color="#16A34A" stop-opacity="0"/></linearGradient></defs>' +
      `<line x1="${pl}" y1="${H - pb}" x2="${W - pr}" y2="${H - pb}" stroke="#d6e0d9" stroke-width="1.5"/>` +
      `<line x1="${X(0)}" y1="${Y(meta)}" x2="${X(1)}" y2="${Y(meta)}" stroke="#16A34A" stroke-width="1" stroke-dasharray="3 4" opacity=".5"/>` +
      `<path class="ga" d="${area}" fill="url(#gp)"/><path class="gl" pathLength="1" d="${linea}" fill="none" stroke="#16A34A" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<g class="gp0"><circle cx="${X(0)}" cy="${Y(peso)}" r="5.5" fill="#fff" stroke="#0b0f0c" stroke-width="2.6"/><text x="${X(0)}" y="${Y(peso) - 12}" font-size="13" font-weight="800" fill="#0b0f0c">Hoy ${peso} kg</text></g>` +
      `<g class="gp1"><circle cx="${X(1)}" cy="${Y(meta)}" r="6.5" fill="#16A34A" stroke="#fff" stroke-width="2.4"/>` +
      `<text x="${X(1)}" y="${H - pb + 20}" font-size="13" font-weight="800" fill="#15803d" text-anchor="end">${meta} kg · ${esc(fechaTxt)}</text></g></svg>`;
  }

  /* Validación de los campos numéricos. Devuelve { ok, n, html, tono, incompleto } según lo tipeado. */
  function evaluaMedida(x, crudo) {
    const n = crudo ? parseInt(crudo, 10) : NaN;
    const vacio = { ok: false, n, html: '', tono: '' };
    if (!crudo) return vacio;
    if (x.k === 'edad') return { ok: true, n, html: '', tono: '' };
    if (x.k === 'altura') {
      const [lo, hi] = CALC.LIMITES.altura;
      if (n >= lo && n <= hi) return { ok: true, n, html: '', tono: '' };
      if (crudo.length < String(lo).length) return vacio;
      return { ok: false, n, html: `Ingresá una altura entre ${lo} y ${hi} cm.`, tono: 'err' };
    }
    if (x.k === 'peso') {
      const [lo, hi] = CALC.LIMITES.peso;
      if (!(n >= lo && n <= hi)) {
        if (crudo.length < String(lo).length) return vacio;
        return { ok: false, n, html: `Ingresá un peso entre ${lo} y ${hi} kg.`, tono: 'err' };
      }
      if (!A.altura) return { ok: true, n, html: '', tono: '' };
      const imc = imc1(CALC.imc(n, A.altura));
      const cat = CALC.categoria(imc);
      const cab = `<b>Tu IMC: ${coma(imc)}</b> <span class="cat">${NOMBRE_CAT[cat]}</span>`;
      const pie = '<small>El IMC es una referencia general.</small>';
      /* Pegado al mínimo sano no existe ninguna meta válida (peso > mínimo): se trata como bajo peso para no dejar un callejón sin salida en pesoMeta. */
      if (cat === 'bajo' || n <= CALC.pesoMinimoSano(A.altura)) return { ok: false, n, tono: 'bajo', html: `${cab}<p>Con tu altura y tu peso no necesitás bajar. Este plan no es para vos: consultá con un profesional.</p><a class="cta s" href="/quiz/">Ver el plan de técnica</a>` };
      if (cat === 'normal') return { ok: true, n, tono: 'ok', html: `${cab}<p>Estás en un rango normal. Igual podés mejorar cómo te sentís.</p>${pie}` };
      if (cat === 'sobrepeso') return { ok: true, n, tono: 'ok', html: `${cab}<p>Es un punto de partida, no un veredicto.</p>${pie}` };
      return { ok: true, n, tono: 'aviso', html: `${cab}<p>Es un punto de partida, no un veredicto. Consultá con tu médico antes de arrancar.</p>${pie}` };
    }
    /* pesoMeta */
    const alt = A.altura || 170, peso = A.peso || 0;
    const v = CALC.validarMeta(peso, n, alt);
    if (v.motivo === 'igual') return { ok: false, n, tono: 'err', html: 'Tu meta tiene que ser menor a tu peso actual.' };
    if (v.motivo === 'bajo') {
      if (crudo.length < String(v.minimo).length) return vacio;
      return { ok: false, n, tono: 'err', html: `Por tu altura, no te recomendamos bajar de ${v.minimo} kg.` };
    }
    const kg = peso - n;
    const exacto = (kg / peso) * 100;
    const cdc = exacto >= 5 && fuenteOk('beneficio')
      ? `<p>Perder entre 5 y 10% del peso corporal probablemente mejora la presión, el colesterol y la glucemia.</p><small>Fuente: ${enlaceFuente('CDC (archivo de 2018)', F.beneficio.url)}</small>`
      : '';
    return { ok: true, n, tono: 'ok', html: `<b>Son ${kg} kg${CALC.porcentaje(peso, n) >= 1 ? `, un ${CALC.porcentaje(peso, n)}% de tu peso` : ''}.</b>${cdc}` };
  }

  /* ---------- Dibujo de cada pantalla ---------- */
  function dibuja() {
    const x = S[s];
    bloqueado = false;
    setBg(x.t === 'carga' ? 'oferta' : x.video);   // la carga ya muestra la franja de video del perfil: así «perfil» no cambia el alto de la página al aparecer
    forma.classList.toggle('alto', !!(x.alto || x.filas));   // «cuerpo», «meta» y «zonas» ocupan todo el alto de la ventana (peso.css)
    const llena = LLENAS[x.k] || (FIJAS.includes(x.t) ? 'fijo' : '');
    if (llena) forma.classList.add('alto');
    progreso();
    let h = '';
    if (x.t === 'q') {
      h = (x.pill ? pillPeso() : '') + `<h2>${x.tituloHtml || esc(x.titulo)}</h2>` + (x.sub ? `<p class="sub">${esc(x.sub)}</p>` : '') + (x.globo ? `<div class="globo">${esc(x.globo)}</div>` : '') +
        (x.pregunta ? `<p class="preg">${esc(x.pregunta)}</p>` : '') + `<div class="grid">${x.o.map((o, i) => tarjeta(o, i, x.chico || x.o.length > 4, false)).join('')}</div>` + (x.regalo ? regaloPeso() + tarjetaMini() + chipsGatillos() : '');
    } else if (x.t === 'multi') {
      h = `<h2>${esc(x.titulo)}</h2><p class="sub">${esc(x.sub)}</p><div class="grid">${x.o.map((o, i) => tarjeta(o, i, true, true)).join('')}</div><button class="cta" id="seguir" disabled>Continuar</button>`;
    } else if (x.t === 'info30') {
      const m = fuenteOk('musculo');
      const txtMusculo = m ? 'La masa muscular baja aproximadamente 3 a 8% por década después de los 30.' : 'Con los años el cuerpo pierde algo de músculo.';
      const cita = m ? `<p class="cita">Fuente: ${enlaceFuente('Volpi, Nazemi y Fujita, ' + F.musculo.fecha + '. Curr Opin Clin Nutr Metab Care', F.musculo.url)}</p>` : '';
      h = `<h2>No es falta de voluntad: después de los 30 el cuerpo cambia</h2>` +
        filaIll(escena('info30', 0), 'Menos músculo', txtMusculo) +
        filaIll(escena('info30', 1), 'Menos tiempo', 'El trabajo, la familia y el cansancio le sacan lugar al movimiento.') +
        filaIll(escena('info30', 2), 'Sin plan, cuesta sostener', 'Es fácil arrancar fuerte, improvisar y largar a las pocas semanas.') +
        `${cita}<p class="sub cierre">Por eso conviene moverse con un plan, y no improvisar.</p><button class="cta" id="seguir">Seguir</button>`;
    } else if (x.t === 'infoboxeo') {
      h = `<h2>Por qué te sirve aunque nunca hayas boxeado</h2>` +
        filaIll(escena('infoboxeo', 0), 'Todo el cuerpo', 'Piernas, torso y brazos se mueven a la vez.') +
        filaIll(escena('infoboxeo', 1), 'Corto y en casa', 'Desde 15 minutos, sin equipo.') +
        filaIll(escena('infoboxeo', 2), 'Se hace llevadero', 'El timer te marca cuándo dar y cuándo descansar.') +
        '<button class="cta" id="seguir">Seguir</button>';
    } else if (x.t === 'noticia') {
      h = `<h2>¿Llegaste a ver esto?</h2><p class="sub">Un estudio sobre entrenamiento de boxeo</p>${tarjetaNoticiaPeso()}<button class="cta" id="seguir">Sí, lo vi</button><button class="cta s" id="seguir2">No, es la primera vez que lo veo</button>`;
    } else if (x.t === 'publicacion') {
      h = `<h2>¿Llegaste a ver esto?</h2>${tarjetaPublicacion()}<button class="cta" id="seguir">Sí, lo vi</button><button class="cta s" id="seguir2">No, es la primera vez que lo veo</button>`;
    } else if (x.t === 'medida') {
      const previo = A[x.k] ? String(A[x.k]) : x.def;
      h = `<h2>${esc(x.titulo)}</h2><p class="sub">${esc(x.sub)}</p>${img3d(x.muneco, 'mu')}<div class="slid"><output id="v" for="n"><b>${esc(previo)}</b><span>${esc(x.unidad)}</span></output><input id="n" type="range" min="${x.min}" max="${x.max}" step="1" value="${esc(previo)}" aria-label="${esc(x.titulo)}"><div class="rng"><span>${x.min} ${esc(x.unidad)}</span><span>${esc(x.maxTxt || x.max + ' ' + x.unidad)}</span></div></div><div class="msg" id="msg" role="status" aria-live="polite"></div><button class="cta" id="seguir" disabled>Seguir</button>`;
    } else if (x.t === 'experto') {
      h = `<div class="tag cen">Tu plan personalizado</div><h2>Tu análisis ya está en marcha</h2><p class="sub">Con tus respuestas ajustamos tu plan de 4 semanas al tiempo que tenés.</p>${tarjetaEspecialista()}${chipsPrivado(false)}<button class="cta" id="seguir">Ver mi análisis →</button>`;
    } else if (x.t === 'carga') {
      return cargando();
    } else if (x.t === 'perfil') {
      h = perfil();
    }
    raiz.innerHTML = `<div class="scr ${x.t}${x.video === 'hook' ? ' hook' : ''}${x.video === 'hook' ? ' edad cuerpo' : ''}${x.alto ? ' alto' : ''}${x.filas ? ' filas' : ''}${llena ? ' ' + llena : ''}">${h}</div>`;
    window.scrollTo(0, 0);
    enlaza(x);
    if (s > 0 && x.t !== 'medida') enfocaTitulo(raiz);
  }

  function perfil() {
    const tienePeso = A.peso && A.altura;
    let h = `<h2>Así queda tu plan</h2>`;
    if (tienePeso) {
      const imc = imc1(CALC.imc(A.peso, A.altura));
      h += `<div class="box res" style="--d:.1s"><div class="row"><b>Tu punto de partida</b><span class="vimc">IMC ${coma(imc)} · ${NOMBRE_CAT[CALC.categoria(imc)]}</span></div>${barraImc(imc)}</div>`;
    }
    /* «Tu condición hoy»: cada barra sale de una respuesta del quiz (nada inventado). [valor 0-100, etiqueta, nivel 0 bajo / 1 medio / 2 alto] */
    const NIV = [['#f59e0b', '#b45309'], ['#84cc16', '#4d7c0f'], ['#16A34A', '#15803d']];
    const barras = [
      ['Movimiento actual', { 'Nada': [10, 'Muy bajo', 0], 'Alguna que otra vez': [30, 'Bajo', 0], 'Una vez por semana': [55, 'Medio', 1], 'Varias veces por semana': [85, 'Alto', 2] }[A.actividad]],
      ['Resistencia', { 'Sin aire': [25, 'Para trabajar', 0], 'Agitado, pero bien': [58, 'Media', 1], 'Tranquilo': [88, 'Buena', 2] }[A.escaleras]],
      ['Descanso', { 'Menos de 5 horas': [22, 'Corto', 0], '5 a 6 horas': [50, 'Justo', 1], '7 a 8 horas': [90, 'Bueno', 2], 'Más de 8 horas': [80, 'Bueno', 2] }[A.sueno]],
      ['Tiempo para entrenar', { 'Arranque': [35, '2-3 días', 0], 'Ritmo': [65, '3-4 días', 1], 'Impulso': [92, '4-5 días', 2] }[A.tiempo]],
    ].filter((x) => x[1]);
    if (barras.length) {
      h += '<div class="box res" style="--d:.35s"><b>Tu condición hoy</b>' + barras.map(([t, v], i) =>
        `<div class="fila" style="--d:${(0.5 + i * 0.18).toFixed(2)}s"><div class="row"><span>${t}</span><span class="vimc" style="color:${NIV[v[2]][1]}">${v[1]}</span></div><div class="rbar" role="img" aria-label="${t}: ${v[1]}"><i style="--w:${v[0]}%;--c:${NIV[v[2]][0]}"></i></div></div>`).join('') +
        '<p class="rtx">El plan arranca desde donde estás hoy y ajusta la carga a tu tiempo.</p></div>';
    }
    if (tienePeso && A.pesoMeta && A.pesoMeta < A.peso) {
      const sem = CALC.semanas(A.peso, A.pesoMeta);
      const fecha = CALC.mesAnio(CALC.fechaMeta(new Date(), sem));
      h += `<div class="box res" style="--d:1.1s"><b>Tu proyección</b>${grafico(A.peso, A.pesoMeta, fecha)}</div>`;
    }
    const ev = { 'Vacaciones': 'tus vacaciones', 'Un casamiento o evento': 'ese casamiento o evento', 'Un cumpleaños': 'tu cumpleaños' }[A.evento];
    if (ev) h += `<p class="evento">Tu plan de 4 semanas puede ser un primer paso hacia ${ev}.</p>`;
    h += '<p class="nota-est">Estimación a 0,5 kg por semana, un ritmo prudente. Tu plan dura 4 semanas; la fecha supone que seguís entrenando al mismo ritmo después. Depende de lo que comas, de tu descanso y de cuánto sostengas el plan. No es una promesa.';
    if (fuenteOk('ritmo')) h += ` Bajar de a poco ayuda a mantener el peso perdido (${enlaceFuente('CDC', F.ritmo.url)}).`;
    h += '</p><button class="cta" id="ver">Ver mi plan</button>';
    return h;
  }

  function enlaza(x) {
    const q = (sel) => raiz.querySelector(sel);
    if (x.t === 'q') {
      raiz.querySelectorAll('.c').forEach((b) => (b.onclick = () => {
        if (bloqueado) return;
        bloqueado = true;
        const o = x.o[+b.dataset.i];
        b.classList.add('on'); A[x.k] = o[0]; guardaA(); vib(); ondaYSonido(b); setTimeout(siguiente, 320);
      }));
    } else if (x.t === 'multi') {
      const sel = new Set();
      const tarjetas = [...raiz.querySelectorAll('.c')];
      tarjetas.forEach((b) => (b.onclick = () => {
        const i = +b.dataset.i;
        ondaYSonido(b);
        if (sel.has(i)) sel.delete(i);
        else {
          /* «Todo un poco» no se combina con las zonas puntuales. */
          if (x.solo !== undefined) { if (i === x.solo) sel.clear(); else sel.delete(x.solo); }
          sel.add(i);
        }
        tarjetas.forEach((c, j) => { c.classList.toggle('on', sel.has(j)); c.setAttribute('aria-pressed', sel.has(j) ? 'true' : 'false'); });
        q('#seguir').disabled = sel.size === 0; vib(8);
      }));
      q('#seguir').onclick = () => { A[x.k] = [...sel].sort((a, b) => a - b).map((i) => x.o[i][0]); guardaA(); siguiente(); };
    } else if (x.t === 'info30' || x.t === 'infoboxeo' || x.t === 'experto') {
      q('#seguir').onclick = siguiente;
    } else if (x.t === 'noticia') {
      q('#seguir').onclick = () => { A.noticia = 'si'; guardaA(); siguiente(); };
      q('#seguir2').onclick = () => { A.noticia = 'no'; guardaA(); siguiente(); };
    } else if (x.t === 'publicacion') {
      q('#seguir').onclick = () => { A.publicacion = 'si'; guardaA(); siguiente(); };
      q('#seguir2').onclick = () => { A.publicacion = 'no'; guardaA(); siguiente(); };
    } else if (x.t === 'medida') {
      const inp = q('#n'), btn = q('#seguir'), msg = q('#msg'), salida = q('#v b');
      let valor = null;
      const revisa = () => {
        salida.textContent = inp.value;
        inp.style.setProperty('--p', ((inp.value - inp.min) / (inp.max - inp.min) * 100) + '%');
        const r = evaluaMedida(x, inp.value);
        valor = r.ok ? r.n : null;
        btn.disabled = !r.ok;
        msg.innerHTML = r.html ? `<div class="m ${r.tono || ''}">${r.html}</div>` : '';
      };
      inp.addEventListener('input', revisa);
      btn.onclick = () => {
        if (valor === null || bloqueado) return;
        bloqueado = true;
        A[x.k] = valor; guardaA(); siguiente();
      };
      revisa();
      enfocaTitulo(raiz);   // el deslizador no abre el teclado en celular
    } else if (x.t === 'perfil') {
      q('#ver').onclick = () => { guardaA(); location.href = '/oferta-peso/' + consultaCampana(); };
    }
  }

  /* Carga: 6 mensajes de ~1,6 s cada uno. El análisis se frena en dos puntos hasta que la persona responde un pop-up. */
  function cargando() {
    const R = 402;
    const imcTxt = A.peso && A.altura ? `Calculando tu punto de partida: IMC ${coma(CALC.imc(A.peso, A.altura))}` : 'Calculando tu punto de partida…';
    const detalleTiempo = { Arranque: '2-3 días · 15-30 min', Ritmo: '3-4 días · 30-40 min', Impulso: '4-5 días · 45-60 min' }[A.tiempo] || A.tiempo || '';
    const msgs = [
      'Analizando tus respuestas…',
      imcTxt,
      `Eligiendo el nivel de carga según tu tiempo: ${detalleTiempo}`,
      'Armando tu progresión desde cero…',
      'Armando tus 4 semanas de shadowboxing…',
      'Listo. Tu plan está armado.',
    ];
    const ETQ = ['Analizando', 'Tu punto de partida', 'Tu carga', 'Tu progresión', 'Tus 4 semanas', '¡Listo!'];
    raiz.innerHTML = `<div class="scr carga cg2"><h2>Estamos armando tu plan</h2><p class="sub">Con tus respuestas, en unos segundos</p><div class="ring cg-ring"><span class="cg-halo"></span><span class="cg-orb"><i></i><i></i><i></i></span><svg viewBox="0 0 150 150" aria-hidden="true"><defs><linearGradient id="cgG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4ade80"/><stop offset="1" stop-color="#15803d"/></linearGradient></defs><circle cx="75" cy="75" r="64" stroke="#e8efe9" stroke-width="10" fill="none"/><circle id="rc" cx="75" cy="75" r="64" stroke="url(#cgG)" stroke-width="10" fill="none" stroke-linecap="round" stroke-dasharray="${R}" stroke-dashoffset="${R}"/></svg><div class="cg-centro"><b id="pc">0%</b><small id="cgEt">${ETQ[0]}</small></div></div><div class="cg-lista">${msgs.map((m, i) => `<div class="chkl" id="c${i}"><div class="ic"></div><div class="cg-tx">${esc(m)}<span class="cg-b"><i></i></span></div></div>`).join('')}</div></div>`;
    window.scrollTo(0, 0);
    enfocaTitulo(raiz);
    let p = 0, pausa = false;
    const paso = 100 / msgs.length;                 // cada mensaje ocupa un sexto del avance
    const hitos = [
      { en: Math.round(paso * 2), pregunta: '¿Podés entrenar a la misma hora todos los días?', opc: ['Sí, ya tengo mi horario', 'Algunos días'], dato: 'Un horario fijo ayuda a sostener la constancia.', aviso: 'Anotado', clave: 'horaFija' },
      { en: Math.round(paso * 4), pregunta: '¿Preferís entrenar a la mañana o a la noche?', opc: ['A la mañana', 'A la noche'], dato: 'Elegí el momento en el que más rendís.', aviso: 'Anotado', clave: 'momento' },
    ];
    const marca = () => msgs.forEach((_, i) => {
      const e = $('c' + i); if (!e) return;
      if (p >= (i + 1) * paso - 0.01) { if (!e.classList.contains('d')) { e.classList.add('d'); e.classList.remove('act'); e.querySelector('.ic').textContent = '✓'; } }
      else if (p >= i * paso) { e.classList.add('act'); e.style.setProperty('--p', Math.round(((p - i * paso) / paso) * 100) + '%'); const et = $('cgEt'); if (et) et.textContent = ETQ[i] || ''; }
    });
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

  /* El pie legal es fijo y su alto cambia con el ancho de la ventana: las pantallas a todo el alto (peso.css) llegan justo hasta él. */
  const ajustaPie = () => { const f = document.querySelector('.ft'); if (f) forma.style.setProperty('--pie', f.offsetHeight + 'px'); };
  pie(false, true, true);   // pie de comun.js: solo los dos enlaces, en pestaña nueva para no perder el quiz
  ajustaPie();
  window.addEventListener('resize', ajustaPie, { passive: true });
  dibuja();
  precargar();
})();
