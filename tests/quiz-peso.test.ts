// Funnel de bajar de peso: /quiz-peso/ → /oferta-peso/ → /back1-peso/ → /back2-peso/. Se comparte /gracias/ y /legal/*.
// El funnel de peleadores no se toca: sus tests están en prueba-quiz.test.ts y pantallas-quiz.test.ts.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { test } from "node:test";

const leer = (r: string) => readFileSync(r, "utf8");
const NUEVAS = ["quiz-peso", "oferta-peso", "back1-peso", "back2-peso"];
const paginas: Record<string, string> = Object.fromEntries(NUEVAS.map((p) => [p, leer(`prueba-quiz/sitio/${p}/index.html`)]));
const html = Object.values(paginas).join("\n");
const fuentePeso = readdirSync("prueba-quiz/src/peso").filter((f) => /\.(js|css)$/.test(f));
const textoPeso = fuentePeso.map((f) => leer(`prueba-quiz/src/peso/${f}`)).join("\n");
const CALC = new Function(`${leer("prueba-quiz/src/peso/calculos-peso.js").replace(/if \(typeof module[\s\S]*$/, "")}; return CALC;`)();
const DATOS_PESO = new Function(`${leer("prueba-quiz/src/peso/datos-peso.js")}; return DATOS_PESO;`)();
const DATOS = new Function(`${leer("prueba-quiz/src/datos.js")}; return DATOS;`)();

test("peso: las cuatro páginas existen, con noindex", () => {
  for (const p of NUEVAS) assert.ok(existsSync(`prueba-quiz/sitio/${p}/index.html`), p);
  for (const h of Object.values(paginas)) assert.match(h, /<meta name="robots" content="noindex,nofollow,noarchive">/);
});

test("peso: flujo quiz-peso → oferta-peso → back1-peso → back2-peso", () => {
  assert.match(paginas["quiz-peso"], /location\.href = '\/oferta-peso\/'/);
  assert.match(paginas["oferta-peso"], /const PAGINA='oferta'/);
  assert.match(paginas["back1-peso"], /const PAGINA='back1'/);
  assert.match(paginas["back2-peso"], /const PAGINA='back2'/);
  assert.match(paginas["oferta-peso"], /siguiente: '\/back1-peso\/'/);
  assert.match(paginas["back1-peso"], /siguiente: '\/back2-peso\/'/);
  assert.match(paginas["back2-peso"], /siguiente: null/);
  assert.doesNotMatch(html, /location\.href = '\/oferta\/'|siguiente: '\/back1\/'|siguiente: '\/back2\/'/);
});

test("peso: CALC (IMC, categorías, mínimo sano, validación, semanas, fecha, curva)", () => {
  assert.equal(CALC.RITMO_KG_SEMANA, 0.5);
  assert.deepEqual(CALC.LIMITES, { altura: [140, 220], peso: [40, 250] });
  assert.ok(Math.abs(CALC.imc(80, 180) - 24.6914) < 0.001);
  assert.equal(CALC.categoria(18.4), "bajo");
  assert.equal(CALC.categoria(18.5), "normal");
  assert.equal(CALC.categoria(24.9), "normal");
  assert.equal(CALC.categoria(25), "sobrepeso");
  assert.equal(CALC.categoria(29.9), "sobrepeso");
  assert.equal(CALC.categoria(30), "obesidad");
  assert.equal(CALC.pesoMinimoSano(170), Math.ceil(18.5 * 1.7 * 1.7));
  assert.equal(CALC.pesoMinimoSano(170), 54);
  assert.deepEqual(CALC.validarMeta(90, 90, 175), { ok: false, motivo: "igual", minimo: CALC.pesoMinimoSano(175) });
  assert.equal(CALC.validarMeta(90, 95, 175).motivo, "igual");
  assert.equal(CALC.validarMeta(90, 50, 175).motivo, "bajo");
  assert.deepEqual(CALC.validarMeta(90, 80, 175), { ok: true, motivo: "", minimo: CALC.pesoMinimoSano(175) });
  assert.equal(CALC.porcentaje(100, 90), 10);
  assert.equal(CALC.porcentaje(85, 75), 12);
  assert.equal(CALC.semanas(90, 80), 20);
  assert.equal(CALC.semanas(80, 79.9), 1);
  assert.equal(CALC.semanas(80, 79), 2);
  const f = CALC.fechaMeta(new Date(2026, 10, 9), 4);
  assert.equal(f.getDate(), 7); assert.equal(f.getMonth(), 11);
  assert.equal(CALC.mesAnio(new Date(2027, 2, 15)), "marzo de 2027");
  const c = CALC.curva(90, 80, 12);
  assert.equal(c.length, 12);
  assert.equal(c[0].kg, 90); assert.equal(c[0].x, 0);
  assert.equal(c[11].kg, 80); assert.equal(c[11].x, 1);
  for (let i = 1; i < c.length; i++) assert.ok(c[i].kg < c[i - 1].kg && c[i].x > c[i - 1].x, "decreciente, sin rebotes");
});

test("peso: sin mail no hay lead: no existe el campo #m, no se llama a __send('lead') y el servicio sigue exigiendo el mail", async () => {
  const q = paginas["quiz-peso"];
  const fuente = leer("prueba-quiz/src/peso/quiz-peso.js");
  /* La pantalla de nombre se sacó: nada que escribir (las medidas son deslizadores). */
  assert.doesNotMatch(q, /\{ t: \'mail\'/, "sin pantalla de nombre");
  assert.doesNotMatch(q, /id="nm"/, "sin campo de nombre");
  assert.doesNotMatch(fuente, /id="m"|type="email"|q\('#m'\)|A\.mail|maxlength="120"/, "sin input #m, sin su validación, sin su maxlength y sin guardar un mail");
  assert.doesNotMatch(q, /__send\('lead'/, "el quiz no llama a __send('lead')");
  assert.equal([...fuente.matchAll(/__send\(/g)].length, 0, "quiz-peso.js no envía nada con __send");
  assert.doesNotMatch(q, /Decinos cómo te llamás y tu mail/);
  assert.deepEqual([...q.matchAll(/sendBeacon\('([^']*)'/g)].map((m) => m[1]), ["/api/"], "el único envío posible es el de comun.js");
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  process.env.DATA_DIR = mkdtempSync(`${tmpdir()}/bcapi-peso-`);
  const { validar } = await import("../prueba-quiz/api/server.mjs");
  assert.equal(validar("lead", { nombre: "Ana", nivel: "", t: Date.now() }), null, "el servicio rechaza un lead sin mail: por eso no se manda");
  assert.equal(validar("lead", { nombre: "Ana", mail: "ana@correo.com", nivel: "", peso: 80 }), null, "el servicio rechaza campos de más");
});

test("peso: «cuerpo» y «meta» son tarjetas altas que llenan la pantalla, «zonas» son 5 filas en una columna y la primera pantalla es «cuerpo»", () => {
  const S0 = pantallas();
  assert.deepEqual(S0.filter((x) => x.alto).map((x) => x.k), ["cuerpo", "meta"], "solo cuerpo y meta llevan tarjetas altas");
  assert.deepEqual(S0.filter((x) => x.filas).map((x) => x.k), ["zonas"], "solo zonas lleva filas");
  assert.equal(S0.find((x) => x.k === "zonas").solo, 4, "«Todo un poco» sigue sin combinarse");
  assert.match(quizPeso, /if \(x\.solo !== undefined\) \{ if \(i === x\.solo\) sel\.clear\(\); else sel\.delete\(x\.solo\); \}/);
  assert.match(quizPeso, /forma\.classList\.toggle\('alto', !!\(x\.alto \|\| x\.filas\)\)/);
  const css = leer("prueba-quiz/src/peso/peso.css");
  assert.match(css, /\.scr\.alto \.grid\{grid-template-rows:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.scr\.filas \.grid\{grid-template-columns:minmax\(0,1fr\);grid-template-rows:repeat\(5,minmax\(0,1fr\)\)/);
});

test("peso: sin fetch/XHR/WebSocket/form y URLs externas solo las de DATOS y DATOS_PESO", () => {
  assert.doesNotMatch(html, /fetch\(|XMLHttpRequest|WebSocket|<form|navigator\.share|alert\(/);
  assert.doesNotMatch(html, /mercadopago|mercado pago|paypal|stripe/i);
  const permitidas = new Set(JSON.stringify([DATOS, DATOS_PESO]).match(/https?:\/\/[^"'\s<)\\]+/g) ?? []);
  const externas = new Set(html.match(/https?:\/\/[^"'\s<)]+/g) ?? []);
  assert.deepEqual([...externas].filter((u) => !permitidas.has(u)), [], "URLs externas que no vienen de los archivos de datos");
});

test("peso: sin emojis, sin testimonios inventados y datos con fuente", () => {
  assert.doesNotMatch(html, /\p{Extended_Pictographic}/u, "sin emojis");
  assert.doesNotMatch(textoPeso, /\p{Extended_Pictographic}/u, "sin emojis en src/peso");
  /* Testimonios: los carga el dueño (personas reales, con su permiso); cada uno con nombre, edad y ciudad, y texto. */
  assert.ok(DATOS_PESO.testimonios.length <= 3 && DATOS_PESO.testimonios.every((t: any) => t.nombre && /\d+ años · \S/.test(t.detalle) && t.texto.length > 20), "testimonios con nombre, edad · ciudad y texto");
  for (const [k, f] of Object.entries<any>(DATOS_PESO.fuentes)) if (f.verificada) assert.match(f.url, /^https:\/\//, `fuente ${k} con enlace`);
  assert.doesNotMatch(html, /Beast Camp/, "nombre público BeastCamp");
});

/* Las claves de los muñecos (o_sparring, o_competir…) son nombres de archivos de /img/, no texto que se vea: se sacan antes de buscar jerga. */
const clavesMuneco = readdirSync("prueba-quiz/sitio/img").map((f) => f.replace(/^muneco-|\.webp$/g, ""));
const sinClaves = (t: string) => clavesMuneco.reduce((a, k) => a.split(`'${k}'`).join("''"), t);

test("peso: palabras y promesas prohibidas ausentes en src/peso (en lo visible)", () => {
  const prohibidas = [
    /sin esfuerzo/i, /garantizad/i, /milagro/i, /quem[aá] grasa/i, /diagn[oó]stico/i,
    /-\s?\d+\s?kg en/i, /\bpeleador(?!es lo probaron este mes)/i, /sparring/i, /fighter/i, /competir/i, /amateur/i,
    /cuando el contador llega a cero/i, /la oferta desaparece/i, /no vas a volver a ver/i, /vuelve a/i,
    /ya bajaron/i,
  ];
  for (const f of fuentePeso) {
    const t = sinClaves(leer(`prueba-quiz/src/peso/${f}`));
    for (const re of prohibidas) assert.doesNotMatch(t, re, `${f}: ${re}`);
  }
});

test("peso: privacidad y funnel viejo intactos (peso, altura y edad solo viven en sessionStorage)", () => {
  assert.match(leer("prueba-quiz/sitio/legal/privacidad/index.html"), /no se envían a nuestros servidores/);
  assert.match(paginas["quiz-peso"], /if \(k !== 'lead' && k !== 'click'\) return/);
  for (const p of ["quiz", "oferta", "back1", "back2"]) assert.doesNotMatch(leer(`prueba-quiz/sitio/${p}/index.html`), /DATOS_PESO|CALC\b/);
});

test("peso: la pantalla de noticia es opcional (titular vacío = no aparece) y, si hay, lleva su fuente y su aviso", () => {
  const n = DATOS_PESO.noticia;
  assert.equal(typeof n.titular, "string");
  const q = paginas["quiz-peso"];
  assert.match(q, /\{ t: 'noticia' \}/, "la definición de la pantalla sigue en el quiz");
  if (n.titular) {
    assert.ok(n.fuente && /^https:\/\//.test(n.enlace) && n.aviso, "noticia con fuente, enlace y aviso");
  }
});

test("peso: videos como en el funnel original (hook, mail y oferta), nunca espejo, y precarga en ese orden", () => {
  for (const f of fuentePeso) assert.doesNotMatch(leer(`prueba-quiz/src/peso/${f}`), /espejo/i, `${f}: el video espejo muestra a una mujer`);
  for (const p of NUEVAS) assert.doesNotMatch(paginas[p], /espejo/i, `${p}: nunca el video espejo`);
  const q = paginas["quiz-peso"];
  assert.match(q, /k: 'cuerpo', video: 'hook'/, "la primera pantalla («cuerpo») lleva el video hook");
  assert.doesNotMatch(q, /\{ t: \'mail\'/, "sin pantalla de nombre");
  assert.match(q, /\{ t: 'perfil', video: 'oferta' \}/);
  /* precargar() igual que el de quiz.js: pósters e imágenes primero, después los videos en orden de uso. */
  assert.match(q, /const urls = \['oferta'\]\.map\(\(n\) => `\/media\/\$\{n\}\.jpg`\);/);
  assert.match(q, /await videoListo\(videoDe\('hook'\)\);\s*for \(const n of \['oferta'\]\)/);
  assert.match(q, /navigator\.connection && navigator\.connection\.saveData\) return/, "con ahorro de datos solo imágenes");
  assert.match(q, /urls\.push\(`\/img\/muneco-\$\{o\[1\]\}\.webp`\)/, "precarga los muñecos de todas las opciones");
  /* La cabeza de las páginas precarga lo primero que se ve, como en el funnel original. */
  const precargas = (h: string) => [...h.matchAll(/<link rel="preload" as="image" href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(precargas(q), ["/media/hook.jpg", "/img/muneco-n_empiezo.webp", "/img/muneco-n_seis.webp", "/img/muneco-n_anios.webp", "/img/muneco-n_mas.webp"]);
  for (const p of ["oferta-peso", "back1-peso", "back2-peso"]) assert.deepEqual(precargas(paginas[p]), ["/media/oferta.jpg"], `${p} precarga el póster de la oferta`);
});

/* Las pantallas del quiz, leídas del propio código armado (S0), para controlar los muñecos de cada opción. */
const quizPeso = paginas["quiz-peso"];
function leerBloque(re: RegExp, que: string): string {
  const m = quizPeso.match(re);
  assert.ok(m, `no encontré ${que} en quiz-peso.js: ¿cambió el formato?`);
  return m[1];
}
const claveMuneco = (k: string) => existsSync(`prueba-quiz/sitio/img/muneco-${k}.webp`);

/* Las pantallas, evaluadas desde el código armado (S0). */
const pantallas = (): any[] => new Function("MARCA", `return ${leerBloque(/const S0 = (\[[\s\S]*?\n  \]);/, "la lista de pantallas S0")};`)("Marcá todas las que quieras");

test("peso: todas las opciones son tarjetas con muñeco 3D, sin repetir dentro de una pantalla, y no quedan filas de texto", () => {
  const S0 = pantallas();
  const preguntas = S0.filter((x) => x.o);
  assert.equal(preguntas.length, 13, "13 pantallas con opciones (la edad es un deslizador)");
  for (const x of preguntas) {
    assert.equal(x.ilus, undefined, `${x.k}: sin figuras dibujadas (ilus): todas las opciones usan un muñeco de /img/`);
    const claves = x.o.map((o: string[]) => o[1]);
    assert.ok(claves.every((k: string) => k && claveMuneco(k)), `${x.k}: cada opción apunta a un muñeco que existe`);
    assert.equal(new Set(claves).size, claves.length, `${x.k}: sin muñecos repetidos dentro de la pantalla`);
  }
  assert.deepEqual(S0.find((x) => x.k === "meta").o.map((o: string[]) => o[1]), ["o_peso", "l_casa", "o_tecnica", "n_anios"], "meta usa muñecos (METAS ya no existe)");
  assert.deepEqual(S0.filter((x) => x.t === "medida").map((x) => [x.k, x.muneco]), [["edad", "n_seis"], ["altura", "c_guardia"], ["peso", "o_peso"], ["pesoMeta", "o_tecnica"]]);
  assert.ok(S0.filter((x) => x.t === "medida").every((x) => claveMuneco(x.muneco)));
  for (const t of ["info30", "infoboxeo"]) {
    const filas = new Function(`return ${leerBloque(/const ESCENAS = (\{[\s\S]*?\n  \});/, "ESCENAS")};`)()[t];
    assert.equal(filas.length, 3);
    assert.equal(new Set(filas.map((e: string[]) => e[0])).size, 3, `${t}: 3 muñecos distintos`);
    assert.ok(filas.every((e: string[]) => claveMuneco(e[0]) && /^e-(pies|guardia|resp)$/.test(e[1])), `${t}: muñecos que existen, con el movimiento de base.css`);
  }
  /* Misma tarjeta que quiz.js: .c B, chico con 5 o 6 opciones, casilla .chk en selección múltiple. */
  assert.match(quizPeso, /class="c B\$\{chico \? ' chico' : ''\}" data-i="\$\{i\}"/);
  assert.match(quizPeso, /tarjeta\(o, i, x\.chico \|\| x\.o\.length > 4, false\)/);
  assert.match(quizPeso, /tarjeta\(o, i, true, true\)/);
  assert.match(quizPeso, /<span class="chk"><\/span>/);
  assert.doesNotMatch(quizPeso, /class="f"|class="lista"|role="radio"|METAS/, "sin filas con radio ni siluetas de meta");
  assert.doesNotMatch(leer("prueba-quiz/src/peso/peso.css"), /(^|[}\s,])\.(f|lista|sil)\b/m, "sin estilos de filas ni de siluetas planas");
  /* La primera pantalla: video, píldora de personas, 4 tarjetas y la franja de regalo con su texto verdadero (sin «diagnóstico»). */
  const edad = S0[0];
  assert.deepEqual([edad.k, edad.video, edad.pill, edad.regalo, edad.o.length], ["cuerpo", "hook", true, true, 4]);
  assert.match(quizPeso, /<div class="gift">\$\{I_REGALO\}<span>Al terminar <b>te dejamos un regalo<\/b>\. Ya está reservado para vos\.<\/span><\/div>/);
  assert.doesNotMatch(quizPeso, /regaloFranja\(/, "regaloFranja() promete un diagnóstico que no existe");
});

/* Ancho y alto de un WebP leídos del encabezado (VP8 con pérdida, VP8L sin pérdida o VP8X extendido). */
function dimensionesWebp(ruta: string): { ancho: number; alto: number } {
  const b = readFileSync(ruta);
  assert.equal(b.toString("latin1", 0, 4) + b.toString("latin1", 8, 12), "RIFFWEBP", `${ruta}: no es un WebP`);
  const tipo = b.toString("latin1", 12, 16);
  if (tipo === "VP8 ") return { ancho: b.readUInt16LE(26) & 0x3fff, alto: b.readUInt16LE(28) & 0x3fff };
  if (tipo === "VP8L") { const v = b.readUInt32LE(21); return { ancho: (v & 0x3fff) + 1, alto: ((v >> 14) & 0x3fff) + 1 }; }
  if (tipo === "VP8X") return { ancho: b.readUIntLE(24, 3) + 1, alto: b.readUIntLE(27, 3) + 1 };
  throw new Error(`${ruta}: formato WebP desconocido (${tipo})`);
}

/* «¿Cómo ves tu cuerpo hoy?»: el mismo boxeador, sin definición muscular, en cuatro contexturas. Son muñecos propios de este funnel. */
test("peso: «cuerpo» usa cuatro muñecos 3D propios (c_delgado, c_normal, c_kilos y c_sobrepeso): en la pantalla, en la precarga y como WebP de 360x480", () => {
  const cuerpo = pantallas().find((x) => x.k === "cuerpo");
  assert.deepEqual(cuerpo.o, [["Delgado con algo de panza", "c_delgado"], ["Normal", "c_normal"], ["Con kilos de más", "c_kilos"], ["Con bastante sobrepeso", "c_sobrepeso"]]);
  assert.equal(cuerpo.ilus, undefined, "«cuerpo» ya no lleva figuras dibujadas");
  assert.doesNotMatch(quizPeso, /CUERPOS|\bilus\b/, "ya no queda código de figuras dibujadas");
  assert.ok(!existsSync("prueba-quiz/src/peso/ilustraciones-peso.js"), "ilustraciones-peso.js ya no se usa");
  assert.doesNotMatch(leer("prueba-quiz/scripts/construir-quiz.mjs"), /ilustraciones-peso/, "el armado ya no lo incluye");
  assert.doesNotMatch(leer("README.md"), /ilustraciones-peso|CUERPOS/, "el README ya no lo menciona");
  /* La precarga recorre todas las opciones, también las de «cuerpo». */
  assert.match(quizPeso, /if \(x\.o\) x\.o\.forEach\(\(o\) => urls\.push\(`\/img\/muneco-\$\{o\[1\]\}\.webp`\)\);/);
  /* Las claves nuevas no están en CLAVES_MUNECO (ilustraciones.js es del otro funnel y no se toca): se piden con img3d(clave), nunca con MUNECO[...]. */
  assert.doesNotMatch(leer("prueba-quiz/src/ilustraciones.js"), /c_delgado|c_normal|c_kilos|c_sobrepeso/);
  assert.doesNotMatch(leer("prueba-quiz/src/peso/quiz-peso.js"), /MUNECO\[/);
  assert.match(quizPeso, /\$\{img3d\(o\[1\]\)\}<b>/, "la tarjeta pide el muñeco con img3d(clave)");
  for (const k of ["c_delgado", "c_normal", "c_kilos", "c_sobrepeso"]) {
    const ruta = `prueba-quiz/sitio/img/muneco-${k}.webp`;
    assert.ok(existsSync(ruta), `falta ${ruta}: la pantalla «cuerpo» mostraría una imagen rota`);
    assert.deepEqual(dimensionesWebp(ruta), { ancho: 360, alto: 480 }, `${k}: 360x480 como los demás muñecos`);
    const kb = statSync(ruta).size / 1024;
    assert.ok(kb >= 6 && kb <= 20, `${k}: pesa ${kb.toFixed(1)} KB; los demás muñecos pesan entre 10 y 19 KB`);
  }
});

test("peso: la oferta es larga (disco, lo que vimos, semana a semana, precio, garantía, preguntas y cierre) y los rescates son cortos y van al descuento", () => {
  const of = leer("prueba-quiz/src/peso/oferta-peso.js");
  const oferta = of.match(/function oferta\(\) \{[\s\S]*?\n\}/)![0];
  const orden = ["tarjetaMini()", "ya está armado", "bloqueHeroe()", "loQueVimos()", "/media/hd/oferta.mp4", "bloqueGrafico()", "bloqueCita()", "bloqueLinea()", "bloquePorQue()", "bloqueIncluye()", "class=\"tm\"", "botonCompra(", "bloqueComparar()", "bloqueTestimoniosPeso()", "bloqueAntesDespues()", "bloqueGarantia()", "bloqueFaq()", "po-fin"];
  let desde = 0;
  for (const t of orden) { const i = oferta.indexOf(t, desde); assert.ok(i >= 0, `oferta: falta «${t}» o está fuera de orden`); desde = i + t.length; }
  assert.doesNotMatch(oferta, /class="tbar/, "la oferta no lleva la barra de tiempo arriba: el tiempo va en la barra de compra de abajo");
  const rescate = of.match(/function rescate\(\) \{[\s\S]*?\n\}/)![0];
  for (const t of ["class=\"tbar up po-tbar\"", "CFG.titulo2", "tarjetaPrecio", "Con BeastCamp Sombra vas a poder:", "bloqueGarantia()"]) assert.ok(rescate.includes(t), `rescate: falta «${t}»`);
  assert.doesNotMatch(rescate, /bloqueFaq|bloqueLinea|bloqueGrafico/, "los rescates son cortos");
  const CFG = new Function(`return ${of.match(/const CFG = (\{[\s\S]*?\n\})\[PAGINA\];/)![1]};`)();
  assert.equal(CFG.oferta.barra, undefined);
  assert.ok(CFG.back1.barra && CFG.back2.barra);
  /* Barra de compra abajo: precio + botón, aparece al deslizar un poco, con listener pasivo y transición que respeta movimiento reducido. */
  assert.match(of, /k\.className = 'sticky po-st oculta';/);
  assert.match(of, /const revisaBarra = \(\) => k\.classList\.toggle\('oculta', window\.scrollY < 60\);/);
  assert.match(of, /addEventListener\('scroll', revisaBarra, \{ passive: true \}\)/);
  const oc = leer("prueba-quiz/src/peso/peso-oferta.css");
  assert.match(oc, /\.sticky\.oculta\{transform:translateY\(calc\(100% \+ 40px\)\);visibility:hidden;pointer-events:none/);
  assert.match(oc, /prefers-reduced-motion:reduce/);
  /* Las animaciones de entrada solo esconden con JS y sin movimiento reducido: sin eso todo queda visible. */
  assert.match(oc, /\.rvjs \.rv\{opacity:0/);
  assert.match(of, /if \(!quieto && 'IntersectionObserver' in window\) \{\s*document\.documentElement\.classList\.add\('rvjs'\);/);
  assert.match(of, /^arrancaContador\(PAGINA\);$/m, "oferta-peso.js llama a arrancaContador(PAGINA)");
  for (const p of ["oferta-peso", "back1-peso", "back2-peso"]) {
    assert.match(paginas[p], /^arrancaContador\(PAGINA\);$/m, `${p}: llama a arrancaContador(PAGINA)`);
    assert.match(paginas[p], /class="tm">10:00</, `${p}: tiene .tm`);
    assert.match(paginas[p], /const CICLOS = \{ oferta: 600, back1: 597, back2: 297 \}/, `${p}: contadores 10:00, 09:57 y 04:57`);
  }
  for (const t of ["¿Incluye dieta?", "No prometemos una cifra.", "No es una promesa."]) assert.ok(of.includes(t), `sigue «${t}»`);
});

test("peso: las páginas armadas salen exactas de prueba-quiz/src (volver a armarlas no cambia nada)", async () => {
  const { execFileSync } = await import("node:child_process");
  const antes = NUEVAS.map((p) => leer(`prueba-quiz/sitio/${p}/index.html`));
  execFileSync(process.execPath, ["prueba-quiz/scripts/construir-quiz.mjs"]);
  assert.deepEqual(NUEVAS.map((p) => leer(`prueba-quiz/sitio/${p}/index.html`)), antes);
});
