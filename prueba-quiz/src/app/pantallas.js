/* Pantallas de la app: cada función devuelve el HTML de una vista. Los toques se resuelven en app.js (data-a="accion"). */
const N = NUCLEO;
const fnum = (n) => Number(n || 0).toLocaleString('es-AR');
const MEDIO_LEGAL = () => (DATOS.contacto ? `escribinos a ${esc(DATOS.contacto)}` : 'escribinos por el mismo medio por el que llegaste a esta página');
const FUNNEL_TXT = { peso: 'Bajar de peso con shadowboxing en casa', peleador: 'Shadowboxing en casa para entrenar como peleador' };

/* ---------- piezas ---------- */
const cab = (titulo, { atras = true, extra = '' } = {}) => `<header class="top">${atras ? `<button class="bt atras" data-a="volver" aria-label="Volver">${ico('atras')}</button>` : ''}<p class="tag">${esc(titulo)}</p>${extra}</header>`;
const chipsSes = (s, min) => `<div class="chips"><span>${ico('reloj')} ${min || s.minutos} min</span><span>${esc(N.nombreTipo(s.tipo))}</span><span>${ico('rayo')} ${fnum(s.puntos)} pts</span></div>`;

/* Mensaje a pantalla completa (pendiente, revocado, error, sin conexión, enlace inválido). */
function vMensaje({ mun: m = 'f_ayuda', tag = '', titulo, texto = '', extra = '', acciones = '', rol = '', anillo = false }) {
  return `<section class="msg ${anillo ? 'conanillo' : ''}" ${rol ? `role="${rol}"` : ''}>
    <div class="msg-im">${anillo ? '<svg class="gira" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="54"/></svg>' : ''}${mun(m)}</div>
    ${tag ? `<p class="tag">${esc(tag)}</p>` : ''}<h1 tabindex="-1">${esc(titulo)}</h1>${texto ? `<p class="sub">${texto}</p>` : ''}${extra}${acciones}</section>`;
}

/* Instalar: según dónde estés (Android, iPhone, navegador de Instagram o Facebook, ya instalada). */
function bloqueInstalar() {
  if (instalada()) return `<div class="box ok-box">${ico('tilde')}<div><b>App instalada</b><small>Ya la tenés en la pantalla de inicio.</small></div></div>`;
  if (ES_INAPP) return `<div class="box aviso-box"><b>Abrí este link en tu navegador</b><p class="sm">Estás en el navegador de Instagram o Facebook y desde ahí no se puede instalar. Tocá los tres puntos y elegí «Abrir en Safari» o «Abrir en Chrome», o copiá el link y pegalo en tu navegador.</p><button class="cta s" data-a="copiar">${ico('copiar')} Copiar mi link</button></div>`;
  if (promptInstalar) return `<div class="box"><b>Instalá la app</b><p class="sm">Entrás con un toque desde tu pantalla de inicio y funciona aunque no tengas señal.</p><button class="cta" data-a="instalar">${ico('instalar')} Instalar la app</button></div>`;
  if (ES_IOS) return `<div class="box"><b>Instalala en tu iPhone</b><ol class="pasos">
      <li><i>1</i><span>Tocá <b>Compartir</b> ${ico('compartir', 'inl')} en la barra de Safari.</span></li>
      <li><i>2</i><span>Elegí <b>Agregar a inicio</b> ${ico('agregar', 'inl')}.</span></li>
      <li><i>3</i><span>Tocá <b>Agregar</b>. Listo: la abrís desde el ícono.</span></li></ol></div>`;
  return `<div class="box"><b>Instalala en tu celu</b><p class="sm">Desde el menú del navegador elegí «Instalar app» o «Agregar a la pantalla de inicio». Así la abrís con un toque y anda sin conexión.</p></div>`;
}

const cardsNivel = (sel, accion) => `<div class="grid niveles" role="radiogroup" aria-label="Nivel de carga">${PLAN.niveles.map((n) => `<button type="button" class="c ${n.id === sel ? 'on' : ''}" role="radio" aria-checked="${n.id === sel}" data-a="${accion}" data-n="${esc(n.id)}">${mun(n.id)}<b>${esc(n.nombre)}<small>${esc(n.dias)} · ${esc(n.minutos)}</small></b></button>`).join('')}</div>`;

function fila(href, im, titulo, meta, extra = '') {
  return `<a class="fila" href="${href}"><span class="fila-im">${im}</span><span class="fila-x"><b>${esc(titulo)}</b><small>${meta}</small></span>${extra || ico('der', 'chev')}</a>`;
}

/* ---------- bienvenida ---------- */
function vBienvenida(sel, apodo) {
  const nv = N.nivelDe(PLAN, sel);
  const nombre = ESTADO.nombre || 'campeón';
  return `<section class="bien">
    <div class="bien-h"><div class="bien-im">${mun(nv.id)}</div><div><p class="tag">Tu plan está listo</p><h1 tabindex="-1">Hola, ${esc(nombre)}</h1></div></div>
    <div class="box resumen"><div class="row"><span>Perfil</span><b>${esc(FUNNEL_TXT[ESTADO.funnel] || FUNNEL_TXT.peso)}</b></div>
      <div class="row"><span>Nivel</span><b id="b-nivel">${esc(nv.nombre)} · ${esc(nv.dias)}</b></div>
      <div class="row"><span>Duración</span><b>4 semanas · ${esc(nv.minutos)} por sesión</b></div></div>
    <h2>Tu apodo para el ranking</h2>
    <label class="campo" for="apodo"><span class="sm">Así aparecés frente a los rivales virtuales. Podés cambiarlo cuando quieras.</span>
      <input id="apodo" type="text" maxlength="20" autocomplete="nickname" autocapitalize="words" value="${esc(apodo)}" aria-describedby="apodo-err"></label>
    <p class="err" id="apodo-err" role="alert"></p>
    <h2>Confirmá tu nivel</h2>
    <p class="sm">Elegiste el que mejor se ajusta a tu tiempo. Si querés otro, tocalo.</p>
    ${cardsNivel(sel, 'nivel-bien')}
    <h2>Instalá la app</h2>
    <div data-instalar>${bloqueInstalar()}</div>
    <p class="sm cen pie-p">Si tenés una lesión o una condición médica, consultá a tu médico antes de empezar.</p>
    <div class="cta-fija"><button class="cta" data-a="empezar-app">Empezar</button></div>
  </section>`;
}

/* ---------- hoy ---------- */
const ahoraSemana = (prog, ahora) => {
  const s = N.semanaDe(prog, ahora), a = s[0].idx, z = s[6].idx;
  return Object.values(prog.sesiones).filter((x) => { const d = N.idxDia(x.fin); return d >= a && d <= z; }).length;
};
function cursoVigente() {
  const c = ls.get(K.curso);
  if (!c || !c.id || Date.now() - c.ts > 36 * 36e5) return null;
  const item = c.k === 'd' ? N.buscarDrill(PLAN, c.id) : N.buscarSesion(PLAN, c.id);
  if (!item) return null;
  const pasos = N.pasosDe(item, PLAN);
  if (c.idx >= pasos.length) return null;
  return { ...c, item, total: pasos.filter((p) => p.t === 'trabajo').length, hecho: pasos.slice(0, c.idx).filter((p) => p.t === 'trabajo').length };
}

function vHoy() {
  const ahora = Date.now(), nv = N.nivelDe(PLAN, PROG.nivel), r = N.racha(PROG, ahora);
  const sig = N.siguienteSesion(nv, PROG), curso = cursoVigente(), tot = N.totales(PROG);
  const primera = tot.sesiones === 0 && tot.drills === 0;
  const dia = N.numeroDeDia(PROG, ahora);
  const nombre = ESTADO.nombre || PROG.apodo || 'campeón';
  const semana = N.semanaDe(PROG, ahora);
  const hechas = ahoraSemana(PROG, ahora), meta = nv.sesionesPorSemana || 3;
  const proximas = N.sesionesDe(nv).filter((s) => !PROG.sesiones[s.id] && (!sig || s.id !== sig.id)).slice(0, 3);
  const drill = (PLAN.drills || []).length ? PLAN.drills[N.idxDia(ahora) % PLAN.drills.length] : null;

  const rach = `<a class="rach ${r.dias ? 'on' : ''}" href="#/progreso" aria-label="${r.dias ? `Racha de ${plural(r.dias, 'día', 'días')}. Ver progreso` : 'Todavía sin racha. Ver progreso'}">${ico('flama')}<span>${r.dias ? `<b>${r.dias}</b> ${r.dias === 1 ? 'día' : 'días'}` : 'Sin racha'}</span></a>`;
  const tira = `<ol class="sem7" aria-label="Tu semana">${semana.map((d) => `<li class="dd ${d.hecho ? 'ok' : ''} ${d.hoy ? 'hoy' : ''} ${d.futuro ? 'fut' : ''}" aria-label="${d.nombre}${d.hoy ? ' (hoy)' : ''}: ${d.hecho ? 'entrenaste' : d.futuro ? 'por venir' : 'sin entrenar'}"><i>${d.letra}</i><b>${d.hecho ? ico('tilde') : d.n}</b></li>`).join('')}</ol>`;

  let hero;
  if (curso) {
    const it = curso.item;
    hero = `<section class="hero curso" aria-label="Seguí donde quedaste"><div class="hero-t"><div class="hero-im">${mun(N.munecoDe(PLAN, it))}</div><div class="hero-x"><p class="tag">Seguí donde quedaste</p><h2>${esc(it.titulo)}</h2><p class="sm">Llevás ${curso.hecho} de ${curso.total} pasos.</p></div></div>
      <button class="cta" data-a="retomar">Retomar</button></section>`;
  } else if (sig) {
    hero = `<section class="hero" aria-label="Tu sesión de hoy"><div class="hero-t"><div class="hero-im">${mun(N.munecoDe(PLAN, sig))}</div><div class="hero-x"><p class="tag">${primera ? 'Tu primera sesión' : 'Tu sesión de hoy'}</p><h2>${esc(sig.titulo)}</h2><p class="sm">Semana ${sig.semana} · Sesión ${sig.n}</p>${chipsSes(sig)}</div></div>
      <a class="cta" href="#/sesion/${esc(sig.id)}">Empezar sesión</a></section>`;
  } else {
    hero = `<section class="hero" aria-label="Plan completo"><div class="hero-t"><div class="hero-im">${mun('o_competir')}</div><div class="hero-x"><p class="tag">Plan completo</p><h2>Terminaste las 4 semanas</h2><p class="sm">Repetí las sesiones que más te gusten o probá un drill.</p></div></div><a class="cta" href="#/plan">Ver el plan</a></section>`;
  }

  return `<section>
    <header class="saludo"><div><h1 tabindex="-1">Hola, ${esc(nombre)}</h1><p class="sub l">${primera ? 'Tu racha empieza con la primera sesión.' : `Día ${dia} de tu plan`}</p></div>${rach}</header>
    ${tira}
    ${hero}
    <div class="box semana"><div class="row"><b>Esta semana</b><span>${Math.min(hechas, meta)} de ${meta} sesiones</span></div>${barra(Math.min(100, (hechas / meta) * 100))}</div>
    ${proximas.length ? `<h2>Próximas sesiones</h2><div class="lista">${proximas.map((s) => fila(`#/sesion/${esc(s.id)}`, mun(N.munecoDe(PLAN, s), 'im3d mini', 120, 160), s.titulo, `Semana ${s.semana} · ${s.minutos} min · ${esc(N.nombreTipo(s.tipo))}`)).join('')}</div>` : ''}
    ${drill ? `<h2>Drill del día</h2><div class="lista">${fila(`#/drill/${esc(drill.id)}`, mun(N.munecoDe(PLAN, drill), 'im3d mini', 120, 160), drill.titulo, `${drill.minutos} min · ${fnum(drill.puntos)} pts`)}${fila('#/drills', ico('guante', 'ic-f'), 'Todos los drills', 'Práctica corta para cualquier momento')}</div>` : ''}
    ${PLAN.guia ? `<h2>Tu guía</h2><div class="lista">${fila('#/guia', mun('e_guardia', 'im3d mini', 120, 160), PLAN.guia.titulo, 'Postura, golpes y defensa, paso a paso')}</div>` : ''}
  </section>`;
}

/* ---------- plan ---------- */
function vPlan() {
  const nv = N.nivelDe(PLAN, PROG.nivel), sig = N.siguienteSesion(nv, PROG);
  return `<section>
    <header class="saludo"><div><h1 tabindex="-1">Tu plan</h1><p class="sub l">4 semanas, a tu ritmo</p></div></header>
    <div class="box nivel-actual"><div class="na-im">${mun(nv.id, 'im3d mini', 120, 160)}</div><div class="na-x"><p class="tag">Tu nivel</p><b>${esc(nv.nombre)}</b><small>${esc(nv.dias)} por semana · ${esc(nv.minutos)}</small></div><button class="cta s chico" data-a="nivel">Cambiar</button></div>
    ${nv.semanas.map((sem) => {
      const ses = sem.sesiones || [], hechas = ses.filter((s) => PROG.sesiones[s.id]).length;
      return `<section class="sem-c" aria-labelledby="sem-${sem.n}"><div class="sem-h"><div><p class="tag">Semana ${sem.n}</p><h2 id="sem-${sem.n}">${esc(sem.titulo)}</h2></div>
        <svg class="mini-anillo" viewBox="0 0 44 44" role="img" aria-label="${hechas} de ${ses.length} sesiones hechas"><circle class="pista" cx="22" cy="22" r="18"/><circle class="aro" cx="22" cy="22" r="18" data-p="${ses.length ? hechas / ses.length : 0}"/><text x="22" y="26.5" text-anchor="middle">${hechas}/${ses.length}</text></svg></div>
        ${sem.foco ? `<p class="sm">${esc(sem.foco)}</p>` : ''}
        <ul class="ses">${ses.map((s) => {
          const ok = PROG.sesiones[s.id], es = sig && sig.id === s.id;
          return `<li><a class="ses-a ${ok ? 'hecha' : ''} ${es ? 'sig' : ''}" href="#/sesion/${esc(s.id)}"><span class="est" aria-hidden="true">${ok ? ico('tilde') : es ? ico('play') : ''}</span><span class="ses-x"><b>${esc(s.titulo)}</b><small>${s.minutos} min · ${esc(N.nombreTipo(s.tipo))} · ${fnum(s.puntos)} pts</small></span><em class="est-t ${ok ? 'ok' : es ? 'sig' : ''}">${ok ? 'Hecha' : es ? 'Siguiente' : 'Por hacer'}</em></a></li>`;
        }).join('')}</ul></section>`;
    }).join('')}
  </section>`;
}

/* ---------- resumen de una sesión o un drill ---------- */
function vResumen(item, kind) {
  const pasos = N.pasosDe(item, PLAN), ahora = Date.now(), r = N.racha(PROG, ahora);
  const hecha = kind === 's' ? PROG.sesiones[item.id] : null;
  const bloques = (item.bloques || [{ titulo: item.titulo, pasos: item.pasos }]).map((b, i) => {
    const ps = pasos.filter((p) => p.bi === i), ejs = [...new Set(ps.filter((p) => p.t === 'trabajo').map((p) => p.nombre))];
    return { titulo: b.titulo, n: ejs.length, min: N.minutosDe(ps), ejs };
  });
  const bonus = kind === 's' && !hecha && !r.hoy ? N.bonusRacha(r.dias + 1) : 0;
  const curso = cursoVigente(), retoma = curso && curso.id === item.id;
  const min = item.minutos || N.minutosDe(pasos);
  const trab = pasos.filter((p) => p.t === 'trabajo').length;
  return `<section class="resumen-s">
    ${cab(kind === 's' ? `Semana ${item.semana} · Sesión ${item.n}` : 'Drill')}
    <div class="res-im">${mun(N.munecoDe(PLAN, item))}</div>
    <h1 tabindex="-1">${esc(item.titulo)}</h1>
    ${kind === 's' ? chipsSes(item, min) : `<div class="chips"><span>${ico('reloj')} ${min} min</span><span>${ico('rayo')} ${fnum(item.puntos)} pts</span></div>`}
    ${item.objetivo || item.foco ? `<p class="obj">${esc(item.objetivo || item.foco)}</p>` : ''}
    ${hecha ? `<div class="box ok-box">${ico('tilde')}<div><b>Ya la hiciste</b><small>Podés repetirla, pero no suma puntos otra vez.</small></div></div>` : ''}
    ${kind === 'd' && PROG.drills[item.id] && N.idxDia(PROG.drills[item.id].ultimo) === N.idxDia(ahora) ? `<div class="box ok-box">${ico('tilde')}<div><b>Hoy ya lo hiciste</b><small>Los puntos de este drill se suman una vez por día.</small></div></div>` : ''}
    <div class="box"><b>Qué vas a hacer</b><p class="sm">${trab} pasos en total. Escuchás un pitido en cada cambio.</p>
      <ol class="bloques">${bloques.map((b, i) => `<li><i>${i + 1}</i><span><b>${esc(b.titulo)}</b><small>${esc(b.ejs.slice(0, 3).join(', '))}${b.ejs.length > 3 ? ` y ${b.ejs.length - 3} más` : ''} · ${b.min} min</small></span></li>`).join('')}</ol></div>
    ${bonus ? `<div class="globo">Si entrenás hoy, tu racha suma <b>+${bonus} puntos</b> a los de la sesión.</div>` : ''}
    <div class="cta-fija">${retoma ? `<button class="cta" data-a="retomar">Retomar desde el paso ${curso.hecho + 1}</button><button class="cta s" data-a="empezar">Empezar de cero</button>` : `<button class="cta" data-a="empezar">${hecha ? 'Hacerla otra vez' : 'Empezar'}</button>`}</div>
  </section>`;
}

/* ---------- drills ---------- */
function vDrills() {
  const hoy = N.idxDia(Date.now());
  return `<section>${cab('Práctica corta')}
    <h1 tabindex="-1">Drills</h1><p class="sub l">Rutinas cortas para sumar práctica y puntos cuando tengas un rato. Suman una vez por día cada una.</p>
    <div class="lista">${(PLAN.drills || []).map((d) => {
      const p = PROG.drills[d.id], hoyHecho = p && N.idxDia(p.ultimo) === hoy;
      return fila(`#/drill/${esc(d.id)}`, mun(N.munecoDe(PLAN, d), 'im3d mini', 120, 160), d.titulo, `${d.minutos} min · ${fnum(d.puntos)} pts${p ? ` · hecho ${plural(p.veces, 'vez', 'veces')}` : ''}`, hoyHecho ? `<em class="est-t ok">Hoy</em>` : ico('der', 'chev'));
    }).join('')}</div></section>`;
}

/* ---------- guía ---------- */
function vGuia() {
  const g = PLAN.guia || { titulo: 'Guía', secciones: [] };
  return `<section>${cab('Tu guía')}<h1 tabindex="-1">${esc(g.titulo)}</h1><p class="sub l">Lo básico para que cada golpe y cada paso salgan bien.</p>
    ${g.secciones.map((s) => `<article class="gcard" id="g-${esc(s.id)}"><div class="zona ${s.video ? 'convideo' : 'sinvideo'}">${s.video ? `<video src="${esc(s.video)}" controls playsinline preload="metadata"></video>` : `${mun(s.muneco || 'e_guardia')}<span class="zona-et">${ico('guante')} Postura y técnica</span>`}</div>
      <h2>${esc(s.titulo)}</h2>${(s.texto || []).map((t) => `<p>${esc(t)}</p>`).join('')}
      ${(s.puntos || []).length ? `<ul class="checks">${s.puntos.map((t) => `<li>${ico('tilde')}<span>${esc(t)}</span></li>`).join('')}</ul>` : ''}</article>`).join('')}
  </section>`;
}

/* ---------- progreso ---------- */
function vProgreso() {
  const ahora = Date.now(), r = N.racha(PROG, ahora), tot = N.totales(PROG), nv = N.nivelDe(PLAN, PROG.nivel);
  const vacio = tot.sesiones === 0 && tot.drills === 0;
  const cal = N.calendario(PROG, ahora), off = N.diaSemana(cal[0].idx);
  const rk = N.ranking(ACC, PLAN, PROG, ESTADO.nombre, ahora), yo = rk.find((x) => !x.virtual);
  const ord = ['primero', 'segundo', 'tercero', 'cuarto', 'quinto', 'sexto', 'séptimo', 'octavo'];
  return `<section>
    <header class="saludo"><div><h1 tabindex="-1">Tu progreso</h1><p class="sub l">${vacio ? 'Todavía no hay nada que contar. Eso cambia hoy.' : `Día ${N.numeroDeDia(PROG, ahora)} de tu plan`}</p></div></header>
    <div class="box racha-g ${r.dias ? 'on' : ''}"><div class="rg-im">${mun('n_anios', 'im3d mini', 120, 160)}</div><div><p class="tag">Tu racha</p><div class="rg-n"><b>${r.dias}</b> ${r.dias === 1 ? 'día' : 'días'}</div><small>${r.dias ? (r.hoy ? 'Ya entrenaste hoy.' : 'Entrená hoy para no cortarla.') : 'Con tu primera sesión arranca.'}${r.mejor > 1 ? ` Mejor racha: ${r.mejor} días.` : ''}</small></div></div>
    <div class="stats3"><div class="stat"><b>${fnum(tot.sesiones)}</b><small>${tot.sesiones === 1 ? 'sesión' : 'sesiones'}</small></div><div class="stat"><b>${fnum(tot.minutos)}</b><small>minutos</small></div><div class="stat"><b>${fnum(tot.puntos)}</b><small>puntos</small></div></div>
    ${vacio ? `<div class="box vacio"><div class="vac-im">${mun('m_const', 'im3d mini', 120, 160)}</div><div><b>Tu calendario está esperando</b><p class="sm">Cada día que entrenes se marca acá. Hacé tu primera sesión y arrancás.</p><a class="cta chico" href="#/hoy">Ir a Hoy</a></div></div>` : ''}
    <h2>Tus 28 días</h2>
    <div class="box cal-b"><div class="cal" role="grid" aria-label="Calendario de 28 días"><div class="cal-h" aria-hidden="true">${N.LETRAS.map((l) => `<i>${l}</i>`).join('')}</div><div class="cal-g">${'<span class="cd vacio-d" aria-hidden="true"></span>'.repeat(off)}${cal.map((d) => `<span class="cd ${d.hecho ? 'ok' : ''} ${d.hoy ? 'hoy' : ''} ${d.futuro ? 'fut' : ''}" role="gridcell" aria-label="Día ${d.n}${d.hoy ? ', hoy' : ''}: ${d.hecho ? 'entrenaste' : d.futuro ? 'todavía no' : 'sin entrenar'}">${d.hecho ? ico('tilde') : d.n}</span>`).join('')}</div></div></div>
    <h2>Avance por semana</h2>
    <div class="box">${nv.semanas.map((sem) => { const ss = sem.sesiones || [], h = ss.filter((s) => PROG.sesiones[s.id]).length; return `<div class="avance"><div class="row"><span><b>Semana ${sem.n}</b></span><span class="m">${h} de ${ss.length}</span></div>${barra(ss.length ? (h / ss.length) * 100 : 0)}</div>`; }).join('')}</div>
    <h2>Ranking</h2>
    <div class="globo">Los rivales son virtuales: los genera la app para que tengas contra quién medirte. No son otras personas.</div>
    <ol class="rank" aria-label="Ranking contra rivales virtuales">${rk.map((x) => `<li class="rk ${x.virtual ? '' : 'yo'}" ${x.virtual ? '' : 'aria-current="true"'}><span class="pos">${x.pos}</span><span class="av2" aria-hidden="true">${esc(String(x.nombre)[0].toUpperCase())}</span><span class="rn"><b>${esc(x.nombre)}</b><em class="vir ${x.virtual ? '' : 'tu'}">${x.virtual ? 'Virtual' : 'Vos'}</em></span><span class="pt">${fnum(x.pts)}<small> pts</small></span></li>`).join('')}</ol>
    <p class="sm cen">${tot.puntos === 0 ? 'Sumá tu primera sesión para empezar a subir.' : `Vas ${ord[yo.pos - 1] || yo.pos + '.º'} entre los rivales virtuales.`}</p>
    <p class="sm cen">Puntos = los de cada sesión o drill. Si entrenás varios días seguidos, la racha suma hasta 60 puntos extra por día, una vez por día.</p>
  </section>`;
}

/* ---------- perfil ---------- */
const interruptor = (k, ic, titulo, desc) => `<button type="button" class="sw" role="switch" aria-checked="${!!PROG.ajustes[k]}" data-a="ajuste" data-k="${k}"><span class="sw-ic">${ico(ic)}</span><span class="sw-t"><b>${titulo}</b><small>${desc}</small></span><i class="sw-k" aria-hidden="true"></i></button>`;
function vPerfil() {
  const nv = N.nivelDe(PLAN, PROG.nivel), nombre = ESTADO.nombre || '';
  const mail = DATOS.contacto && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(DATOS.contacto) ? DATOS.contacto : '';
  return `<section>
    <header class="saludo"><div><h1 tabindex="-1">Tu perfil</h1><p class="sub l">${nombre ? esc(nombre) + ' · ' : ''}Nivel ${esc(nv.nombre)}</p></div><div class="perf-im">${mun(nv.id, 'im3d mini', 120, 160)}</div></header>
    <h2>Tus datos</h2>
    <form class="box" data-f="apodo" novalidate><label class="campo" for="apodo"><b>Apodo en el ranking</b><input id="apodo" type="text" maxlength="20" autocomplete="nickname" value="${esc(PROG.apodo)}" aria-describedby="apodo-err"></label><p class="err" id="apodo-err" role="alert"></p><button class="cta s chico" type="submit">Guardar apodo</button></form>
    <div class="lista"><button type="button" class="fila fila-b" data-a="nivel"><span class="fila-im">${mun(nv.id, 'im3d mini', 120, 160)}</span><span class="fila-x"><b>Nivel: ${esc(nv.nombre)}</b><small>${esc(nv.dias)} · ${esc(nv.minutos)} · Cambiar</small></span>${ico('der', 'chev')}</button></div>
    <h2>Durante la sesión</h2>
    <div class="box sws">${interruptor('sonido', 'sonido', 'Sonido', 'Pitidos en los cambios y en la cuenta final')}${interruptor('voz', 'voz', 'Voz', 'Te dice cada ejercicio, en español')}${interruptor('vibracion', 'vibra', 'Vibración', 'Un toque en cada cambio de fase')}</div>
    <h2>Instalar</h2><div data-instalar>${bloqueInstalar()}</div>
    <h2>Guardá tu link</h2>
    <div class="box"><p class="sm">Este link es tu acceso a BeastCamp: entrás desde cualquier celu sin usuario ni clave. Guardalo y no lo compartas.</p><p class="link-p" id="mi-link">${esc(linkPersonal())}</p><button class="cta s" data-a="copiar">${ico('copiar')} Copiar mi link</button></div>
    <h2>Ayuda y contacto</h2>
    <div class="box"><p class="sm">¿Algo no anda o tenés una duda? ${MEDIO_LEGAL().replace(/^./, (c) => c.toUpperCase())}. Tenés ${DATOS.garantiaDias} días de garantía desde tu compra.</p>${mail ? `<a class="cta s" href="mailto:${esc(mail)}">${ico('mail')} Escribirnos</a>` : ''}</div>
    <div class="lista"><a class="fila" href="/legal/terminos/"><span class="fila-im">${ico('info', 'ic-f')}</span><span class="fila-x"><b>Términos y condiciones</b></span>${ico('der', 'chev')}</a><a class="fila" href="/legal/privacidad/"><span class="fila-im">${ico('candado', 'ic-f')}</span><span class="fila-x"><b>Política de privacidad</b></span>${ico('der', 'chev')}</a></div>
    <button class="cta s salir" data-a="salir">${ico('salir')} Salir en este celu</button>
    <p class="sm cen pie-p">Para mayores de 18. Las rutinas no reemplazan a un profesional de la salud; consultá antes de entrenar si tenés una lesión.</p>
  </section>`;
}

/* ---------- acceso: sin acceso, pendiente, revocado, error ---------- */
function vRecuperar(estado = 'form', msg = '') {
  if (estado === 'listo') return vMensaje({ mun: 'f_tiempo', tag: 'Revisá tu mail', titulo: 'Listo, mirá tu casilla', texto: 'Si ese mail tiene una compra de BeastCamp, te mandamos el link a tu plan. Puede tardar unos minutos y a veces cae en correo no deseado.', acciones: `<button class="cta s" data-a="recuperar-otra">Probar con otro mail</button>` });
  return `<section class="msg"><div class="msg-im">${mun('f_ayuda')}</div><p class="tag">Tu plan BeastCamp</p><h1 tabindex="-1">Recuperá tu link</h1>
    <p class="sub">${msg ? esc(msg) : 'Escribí el mail con el que compraste y te reenviamos el link a tu plan.'}</p>
    <form class="rec" data-f="recuperar" novalidate><label class="campo" for="mail"><span class="sm">Mail de la compra</span><input id="mail" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="tu@mail.com"></label><p class="err" id="mail-err" role="alert"></p>
    <button class="cta" type="submit" id="rec-b">Mandame el link</button></form></section>`;
}
function vPendiente(largo) {
  if (!largo) return vMensaje({ mun: 'f_tiempo', anillo: true, tag: 'Pago', titulo: 'Estamos confirmando tu pago', texto: 'Suele tardar unos segundos. No cierres esta pantalla: apenas se confirme, entrás solo.', rol: 'status' });
  return vMensaje({ mun: 'f_tiempo', anillo: true, tag: 'Pago', titulo: 'Está tardando más de lo normal', rol: 'status', texto: 'Seguimos revisando solo, no hace falta que toques nada.',
    extra: `<div class="box pasos-b"><b>Mientras tanto</b><ol class="pasos"><li><i>1</i><span>Mirá tu mail, también el correo no deseado: cuando se confirma el pago te llega el link a tu plan.</span></li><li><i>2</i><span>Algunos medios de pago tardan un poco más en confirmarse.</span></li><li><i>3</i><span>Si pasaron más de 15 minutos, ${MEDIO_LEGAL()} con el mail de la compra.</span></li></ol></div>`,
    acciones: `<button class="cta" data-a="reintentar">${ico('reintentar')} Revisar ahora</button><button class="cta s" data-a="ir-recuperar">Recibir el link por mail</button>` });
}
const vRevocado = () => vMensaje({ mun: 'f_ayuda', tag: 'Acceso', titulo: 'Este acceso ya no está activo', texto: `Se desactivó por un reembolso o una disputa del pago. Si creés que es un error, ${MEDIO_LEGAL()}.`, acciones: `<button class="cta s" data-a="ir-recuperar">Probar con otro mail</button>` });
const vError = (txt = 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.') => vMensaje({ mun: 'f_ayuda', tag: 'Sin conexión', titulo: 'No pudimos cargar tu plan', texto: esc(txt), rol: 'alert', acciones: `<button class="cta" data-a="reintentar">${ico('reintentar')} Reintentar</button>` });
const vCarga = () => `<section class="msg carga" role="status" aria-label="Cargando"><div class="msg-im">${mun('m_golpes')}</div><div class="sk sk1"></div><div class="sk sk2"></div><p class="sub">Preparando tu plan</p></section>`;
