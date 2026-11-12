// Funnel de bajar de peso (/quiz-peso/). Recorre el quiz en un navegador real en varios tamaños de ventana y comprueba, en CADA pantalla:
//  - que no haya scroll vertical (todas las opciones se ven de entrada),
//  - que ningún elemento grande tenga fondo negro u oscuro,
//  - que todas las opciones sean tarjetas con muñeco (sin filas de texto), sin muñecos repetidos y sin imágenes rotas,
//  - que no haya errores de consola ni pedidos a sitios externos, ni pedidos del video «espejo» (muestra a una mujer).
// «cuerpo» y «meta» son 4 tarjetas altas (2x2) que llenan todo el alto, «causas» y «frenos» son 6 (2x3), «zonas» son 5 filas en una columna y «forma» y «actividad» 4 filas sin casilla,
// el botón de avanzar de cada pantalla (zonas, causas, frenos, info30, infoboxeo, medidas, experto, mail y perfil) queda siempre en el mismo lugar, justo encima del pie legal, «mail» pide solo el nombre y no sale ningún lead, y la barra fija de la oferta aparece recién al pasar «Por qué te sirve».
// También mira la primera pantalla (video hook, prueba social y regalo), los cuatro muñecos de «cuerpo» (360x480, fondo blanco puro), los videos de mail y perfil,
// y los bloques de /oferta-peso/, /back1-peso/ y /back2-peso/ con su contador (el mismo de /oferta/: barra, barra fija y reinicio solo).
// Necesita Chrome o Edge instalado (variable CHROME_PATH para cambiar la ruta). Si no lo encuentra, el test se saltea.
// Con CAPTURAS_DIR=carpeta guarda una captura por pantalla y por tamaño.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync, mkdirSync } from "node:fs";
import { extname, join } from "node:path";
import { test } from "node:test";
import { chromium, type Page } from "playwright-core";

const CHROMES = [process.env.CHROME_PATH, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/opt/pw-browsers/chromium"].filter(Boolean) as string[];
const chrome = CHROMES.find((c) => existsSync(c));
/* El peso y la altura se eligen con un deslizador (no se escriben): mueve el valor y avisa como si el usuario lo deslizara. */
async function setRango(p: Page, v: string) { await p.evaluate((x) => { const i = document.querySelector("#n") as HTMLInputElement; i.value = x; i.dispatchEvent(new Event("input", { bubbles: true })); }, v); }
const TIPOS: Record<string, string> = { ".html": "text/html; charset=utf-8", ".mp4": "video/mp4", ".jpg": "image/jpeg", ".webp": "image/webp", ".txt": "text/plain" };
const TAMANOS = [[1366, 620], [1280, 600], [1920, 1080], [390, 844], [360, 640], [425, 812]] as const;   // 425x812 es el celular del usuario
const REGALO = "Al terminar te dejamos un regalo. Ya está reservado para vos.";
const CUERPO = ["c_delgado", "c_normal", "c_kilos", "c_sobrepeso"];   // «¿Cómo ves tu cuerpo hoy?»: el mismo boxeador en cuatro contexturas
/* Frases de barra y ciclo del contador de cada página: los mismos de oferta.js y comun.js. */
const BARRAS: Record<string, string> = { "oferta-peso": "Tu precio de lanzamiento está reservado por", "back1-peso": "ESPERÁ — TU DESCUENTO ESTÁ RESERVADO POR", "back2-peso": "ÚLTIMA OPORTUNIDAD — SE ACABA EN" };
const CICLO: Record<string, number> = { "oferta-peso": 600, "back1-peso": 597, "back2-peso": 297 };
const segundos = (t: string | null) => (t && /^\d\d:\d\d$/.test(t) ? +t.slice(0, 2) * 60 + +t.slice(3) : NaN);

function servidor(conRelleno: boolean) {
  const relleno = readFileSync("vista-previa-local/datos-vista-previa.js", "utf8");
  return createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://x");
    let f = join("prueba-quiz/sitio", decodeURIComponent(u.pathname));
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
    if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    let cuerpo: Buffer | string = readFileSync(f);
    if (conRelleno && extname(f) === ".html") cuerpo = cuerpo.toString("utf8").replace(/\/\*DATOS-INICIO\*\/[\s\S]*?\/\*DATOS-FIN\*\//, () => relleno);
    res.writeHead(200, { "content-type": TIPOS[extname(f)] ?? "application/octet-stream" });
    res.end(cuerpo);
  });
}

type Hallazgo = { pantalla: string; problema: string };
type Opciones = { tarjetas?: number; escenas?: number; medida?: boolean; claves?: string[] };

async function medir(p: Page, nombre: string, hallazgos: Hallazgo[], captura: (n: string) => Promise<void>, o: Opciones = {}) {
  await p.waitForTimeout(450);
  await p.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 5000 }).catch(() => {});   // máquinas lentas: que terminen de bajar los muñecos antes de medir
  const r = await p.evaluate(() => {
    const exceso = document.scrollingElement!.scrollHeight - window.innerHeight;
    const area = innerWidth * innerHeight;
    const oscuros: string[] = [];
    document.querySelectorAll("body *").forEach((el) => {
      const tag = el.tagName;
      if (["VIDEO", "IMG", "SVG", "PATH", "CIRCLE", "RECT", "G", "ELLIPSE", "TEXT", "BUTTON", "A", "INPUT"].includes(tag.toUpperCase())) return;
      const b = el.getBoundingClientRect();
      if (b.width * b.height < area * 0.12) return;
      const cs = getComputedStyle(el);
      const m = cs.backgroundColor.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/);
      if (!m) return;
      const a = m[4] === undefined ? 1 : +m[4];
      const lum = (0.2126 * +m[1] + 0.7152 * +m[2] + 0.0722 * +m[3]) / 255;
      if (a > 0.5 && lum < 0.3) oscuros.push(`${tag.toLowerCase()}#${(el as HTMLElement).id}.${(el as HTMLElement).className}`);
    });
    const rotas = [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.src.slice(0, 70));
    const tarjetas = [...document.querySelectorAll(".c")];
    const imgs = tarjetas.map((c) => c.querySelector("img.im3d") as HTMLImageElement | null);
    const munecos = imgs.map((i) => i?.src ?? "");
    /* Esquinas de cada muñeco ya decodificado: con mix-blend-mode: multiply solo el blanco puro se funde con la tarjeta. */
    const esquinas = imgs.map((i) => {
      if (!i || !i.naturalWidth) return [];
      const c = document.createElement("canvas"); c.width = i.naturalWidth; c.height = i.naturalHeight;
      const g = c.getContext("2d")!; g.drawImage(i, 0, 0);
      return [[0, 0], [c.width - 1, 0], [0, c.height - 1], [c.width - 1, c.height - 1]].map(([x, y]) => Array.from(g.getImageData(x, y, 1, 1).data.slice(0, 3)));
    });
    const escenas = [...document.querySelectorAll(".ill img.esc3d")].map((i) => (i as HTMLImageElement).src);
    return {
      exceso, oscuros, rotas,
      tarjetas: tarjetas.length,
      sinMuneco: munecos.filter((s) => !s).length,
      archivos: munecos.map((s) => s.split("/").pop() ?? ""),
      tamanos: imgs.map((i) => (i ? `${i.naturalWidth}x${i.naturalHeight}` : "")),
      esquinas,
      repetidos: munecos.filter((s, i) => s && munecos.indexOf(s) !== i).length,
      escenas: escenas.length, escenasRepetidas: escenas.filter((s, i) => escenas.indexOf(s) !== i).length,
      filas: document.querySelectorAll(".f, .lista").length,
      medida: !!document.querySelector("img.mu"),
    };
  });
  if (r.exceso > 1) hallazgos.push({ pantalla: nombre, problema: `scroll vertical de ${r.exceso}px` });
  if (r.oscuros.length) hallazgos.push({ pantalla: nombre, problema: `fondo oscuro grande: ${r.oscuros.join(", ")}` });
  if (r.rotas.length) hallazgos.push({ pantalla: nombre, problema: `imágenes que no cargaron: ${r.rotas.join(", ")}` });
  if (r.filas) hallazgos.push({ pantalla: nombre, problema: "quedaron filas de texto (.f o .lista) en vez de tarjetas con muñeco" });
  if (o.tarjetas !== undefined) {
    if (r.tarjetas !== o.tarjetas) hallazgos.push({ pantalla: nombre, problema: `se esperaban ${o.tarjetas} tarjetas y hay ${r.tarjetas}` });
    if (r.sinMuneco) hallazgos.push({ pantalla: nombre, problema: `${r.sinMuneco} tarjetas sin muñeco` });
    if (r.repetidos) hallazgos.push({ pantalla: nombre, problema: `${r.repetidos} muñecos repetidos en la misma pantalla` });
  }
  if (o.claves) {
    const esperados = o.claves.map((k) => `muneco-${k}.webp`);
    if (JSON.stringify(r.archivos) !== JSON.stringify(esperados)) hallazgos.push({ pantalla: nombre, problema: `los muñecos son ${r.archivos.join(", ")} y deberían ser ${esperados.join(", ")}` });
    if (r.tamanos.some((t) => t !== "360x480")) hallazgos.push({ pantalla: nombre, problema: `los muñecos no miden 360x480: ${r.tamanos.join(", ")}` });
    const sucias = r.esquinas.filter((e) => e.length !== 4 || e.some((px) => px.some((v) => v < 253)));
    if (sucias.length) hallazgos.push({ pantalla: nombre, problema: `${sucias.length} muñecos sin fondo blanco puro en las esquinas: ${JSON.stringify(r.esquinas)}` });
  }
  if (o.escenas !== undefined && (r.escenas !== o.escenas || r.escenasRepetidas)) hallazgos.push({ pantalla: nombre, problema: `se esperaban ${o.escenas} filas con muñeco animado distintos y hay ${r.escenas} (${r.escenasRepetidas} repetidos)` });
  if (o.medida && !r.medida) hallazgos.push({ pantalla: nombre, problema: "la pantalla de medida no tiene muñeco" });
  await captura(nombre);
}

/* Los bloques de la oferta y de los rescates, en el orden del funnel original (oferta.js). */
async function revisarOferta(p: Page, pagina: string, hallazgos: Hallazgo[]) {
  const r = await p.evaluate(() => {
    const txt = document.body.innerText;
    const v = document.querySelector(".vid video");
    const sticky = document.querySelector(".sticky");
    return {
      txt,
      video: v ? v.getAttribute("src") : null, poster: v ? v.getAttribute("poster") : null,
      sello: !!document.querySelector(".box.sello svg"), tbar: !!document.querySelector(".tbar"),
      vs: !!document.querySelector(".vs .on"), pasos: document.querySelectorAll(".box .st").length, sem: document.querySelectorAll(".box .sem").length,
      garantia: !!document.querySelector(".garantia svg"), faq: document.querySelectorAll(".faq details").length,
      cta: document.querySelectorAll(".cta[data-reservar]").length, sticky: !!sticky && !!sticky.querySelector(".cta[data-reservar]"),
      contador: document.querySelectorAll(".tm").length,
      barra: document.querySelector(".tbar span")?.textContent ?? null, tmBarra: document.querySelector(".tbar .tm")?.textContent ?? null,
      fijaTxt: sticky?.querySelector("span")?.firstChild?.textContent ?? null, tmFija: sticky?.querySelector(".tm")?.textContent ?? null,
    };
  });
  const falla = (problema: string) => hallazgos.push({ pantalla: pagina, problema });
  if (r.video !== "/media/hd/oferta.mp4" || r.poster !== "/media/oferta.jpg") falla(`falta el video de la oferta con su póster (${r.video} · ${r.poster})`);
  if (!r.tbar) falla("falta la barra superior .tbar");
  if (!r.sello) falla("falta el sello con escudo");
  if (!r.vs) falla("falta el antes/después");
  if (r.pasos !== 13) falla(`los pasos .st (qué incluye 6, cómo funciona 3, por qué te sirve 4) son ${r.pasos}`);
  if (r.sem !== 4) falla(`faltan las 4 semanas .sem: ${r.sem}`);
  if (!r.garantia) falla("falta la garantía");
  if (r.faq < 7) falla(`faltan preguntas frecuentes: ${r.faq}`);
  if (r.cta < 1 || !r.sticky) falla("falta el botón de reserva o la barra fija");
  /* Contador igual al de oferta.js: uno en la barra de arriba y otro en la barra fija, con la misma cuenta y la frase de cada página. */
  if (r.barra !== BARRAS[pagina]) falla(`la barra dice «${r.barra}» y debería decir «${BARRAS[pagina]}»`);
  if (r.contador !== 2) falla(`el contador .tm debería estar en la barra y en la barra fija (2) y hay ${r.contador}`);
  if (!(segundos(r.tmBarra) >= 1 && segundos(r.tmBarra) <= CICLO[pagina])) falla(`el contador de la barra no es un mm:ss dentro del ciclo de ${CICLO[pagina]} s: «${r.tmBarra}»`);
  if (r.tmFija !== r.tmBarra) falla(`la barra fija marca «${r.tmFija}» y la de arriba «${r.tmBarra}»`);
  if (r.fijaTxt !== "Oferta termina en") falla(`la barra fija dice «${r.fijaTxt}» y debería decir «Oferta termina en»`);
  const orden = ["HOY", "TU META", "Tu camino hasta tu meta", "Hecho para arrancar de cero", ...(pagina === "oferta-peso" ? ["Por qué arrancar sin plan te frena"] : []), "Plan de 4 semanas de shadowboxing en casa", "Qué incluye", "Así cambia tu forma de arrancar", "Cómo funciona", "Qué hacés cada semana", "Por qué te sirve", "Valor total", "Garantía de 30 días", "Preguntas frecuentes"];
  let desde = 0;
  for (const t of orden) {
    const i = r.txt.indexOf(t, desde);
    if (i < 0) { falla(`falta «${t}» o está fuera de orden`); break; }
    desde = i + t.length;
  }
  if (pagina !== "oferta-peso" && r.txt.includes("Por qué arrancar sin plan te frena")) falla("el rescate no debería llevar «Por qué arrancar sin plan te frena» (igual que en el funnel original)");
}

/* Pantallas que llenan el alto: entre el título y el pie legal no queda vacío (a lo sumo el margen de unos pocos píxeles). */
async function revisarAlto(p: Page, nombre: string, hallazgos: Hallazgo[]) {
  const r = await p.evaluate(() => {
    const rc = (e: Element) => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, b: b.bottom, r: b.right }; };
    const tarjetas = [...document.querySelectorAll(".c")].map((c) => {
      const i = c.querySelector("img.im3d")!, t = c.querySelector("b")!;
      return { c: rc(c), i: rc(i), t: rc(t), cx: c.getBoundingClientRect().left + c.getBoundingClientRect().width / 2 };
    });
    return { tarjetas, h2: rc(document.querySelector("h2")!), ft: rc(document.querySelector(".ft")!), grid: rc(document.querySelector(".grid")!) };
  });
  const falla = (problema: string) => hallazgos.push({ pantalla: nombre, problema });
  const t = r.tarjetas;
  if (t.length !== 4) return falla(`se esperaban 4 tarjetas y hay ${t.length}`);
  /* Se agrupa con tolerancia: las figuras se mecen unos píxeles y una tarjeta con el puntero encima sube 2 px. */
  const grupos = (v: number[]) => [...v].sort((p, q) => p - q).reduce((n, x, i, a) => (i && x - a[i - 1] <= 6 ? n : n + 1), 0);
  const xs = { size: grupos(t.map((c) => c.c.x)) }, ys = { size: grupos(t.map((c) => c.c.y)) };
  if (xs.size !== 2 || ys.size !== 2) falla(`no es una cuadrícula de 2x2 (columnas ${xs.size}, filas ${ys.size})`);
  if (t.some((c) => Math.abs(c.c.h - t[0].c.h) > 1 || Math.abs(c.c.w - t[0].c.w) > 1)) falla("las cuatro tarjetas no miden lo mismo");
  const fondo = Math.max(...t.map((c) => c.c.b));
  if (fondo > r.ft.y + 1) falla(`las tarjetas llegan hasta ${Math.round(fondo)}px y el pie empieza en ${Math.round(r.ft.y)}px: se pisan`);
  if (r.ft.y - fondo > 20) falla(`queda un vacío de ${Math.round(r.ft.y - fondo)}px entre las tarjetas y el pie legal: deberían llenar todo el alto`);
  if (Math.min(...t.map((c) => c.c.y)) - r.h2.b > 24) falla("queda un vacío entre el título y las tarjetas");
  for (const c of t) {
    if (c.i.b > c.t.y + 1) falla("el muñeco no está arriba del texto");
    if (Math.abs(c.i.x + c.i.w / 2 - c.cx) > 2 || Math.abs(c.t.x + c.t.w / 2 - c.cx) > 2) falla("el muñeco y el texto no están centrados en la tarjeta");
    if (c.i.h < c.c.h * 0.5) falla(`el muñeco es chico: ${Math.round(c.i.h)}px en una tarjeta de ${Math.round(c.c.h)}px`);
    if (c.i.w < 60 || c.i.h < 90) falla(`el muñeco mide ${Math.round(c.i.w)}x${Math.round(c.i.h)}px: se ve chico`);
  }
}

/* «zonas»: una columna con 5 filas iguales que llenan el alto, muñeco grande, casilla a la derecha y «Continuar» justo encima del pie legal.
   «forma» y «actividad» (conCasilla = false): 4 filas iguales con el mismo aspecto, sin casilla ni botón y sin espacio reservado a la derecha; llenan el alto hasta el pie legal. */
async function revisarFilas(p: Page, nombre: string, hallazgos: Hallazgo[], cantidad = 5, conCasilla = true) {
  const r = await p.evaluate(() => {
    const rc = (e: Element | null) => { const b = e ? e.getBoundingClientRect() : new DOMRect(0, 0, 0, 0); return { x: b.left, y: b.top, w: b.width, h: b.height, b: b.bottom, r: b.right }; };
    const filas = [...document.querySelectorAll(".c")].map((c) => ({ c: rc(c), i: rc(c.querySelector("img.im3d")!), t: rc(c.querySelector("b")!), k: rc(c.querySelector(".chk")), hayChk: !!c.querySelector(".chk"), fs: parseFloat(getComputedStyle(c.querySelector("b")!).fontSize) }));
    return { filas, ft: rc(document.querySelector(".ft")!), cta: rc(document.querySelector("#seguir")), hayCta: !!document.querySelector("#seguir"), h2: rc(document.querySelector("h2")!), ancho: innerWidth };
  });
  const falla = (problema: string) => hallazgos.push({ pantalla: nombre, problema });
  const f = r.filas;
  if (f.length !== cantidad) return falla(`se esperaban ${cantidad} filas y hay ${f.length}`);
  if (!conCasilla && (r.hayCta || f.some((x) => x.hayChk))) falla("esta pantalla avanza al tocar una opción: no lleva casilla ni botón");
  if (new Set(f.map((x) => Math.round(x.c.x / 8))).size !== 1 || new Set(f.map((x) => Math.round(x.c.w / 8))).size !== 1) falla("las filas no están en una sola columna del mismo ancho");
  if (f.some((x, i) => i && x.c.y < f[i - 1].c.b - 0.5)) falla("las filas se pisan o no van una debajo de otra");
  if (f.some((x) => Math.abs(x.c.h - f[0].c.h) > 1)) falla(`las ${cantidad} filas no miden lo mismo`);
  if (f[0].c.w < Math.min(r.ancho * 0.8, 440)) falla(`las filas no ocupan todo el ancho: ${Math.round(f[0].c.w)}px`);
  if (f[0].c.y - r.h2.b > 40) falla("queda un vacío entre el título y las filas");
  for (const x of f) {
    if (x.i.h < 50 || x.i.h < x.c.h * 0.7 || x.i.y < x.c.y - 1 || x.i.b > x.c.b + 1) falla(`el muñeco no se ve grande dentro de la fila: ${Math.round(x.i.w)}x${Math.round(x.i.h)}px en ${Math.round(x.c.h)}px de alto`);
    if (conCasilla && (x.k.x < x.t.r || x.k.r > x.c.r + 1 || Math.abs(x.k.y + x.k.h / 2 - (x.c.y + x.c.h / 2)) > 2)) falla("la casilla no está a la derecha, centrada en la fila");
    if (!conCasilla && x.c.r - x.t.r > 30) falla(`queda un espacio de ${Math.round(x.c.r - x.t.r)}px reservado a la derecha del texto: sin casilla no hace falta`);
    if (x.t.x < x.i.r - 1) falla("el texto pisa al muñeco");
    if (x.fs < 14) falla(`el texto mide ${x.fs}px: poco legible`);
  }
  if (!conCasilla) {
    if (r.ft.y < f[cantidad - 1].c.b - 1) falla(`las filas llegan hasta ${Math.round(f[cantidad - 1].c.b)}px y el pie empieza en ${Math.round(r.ft.y)}px: se pisan`);
    if (r.ft.y - f[cantidad - 1].c.b > 20) falla(`queda un vacío de ${Math.round(r.ft.y - f[cantidad - 1].c.b)}px entre las filas y el pie legal: deberían llenar todo el alto`);
    return;
  }
  if (r.cta.y < f[cantidad - 1].c.b || r.cta.y - f[cantidad - 1].c.b > 16) falla(`«Continuar» no queda justo debajo de las filas (${Math.round(f[cantidad - 1].c.b)}px → ${Math.round(r.cta.y)}px)`);
  if (r.cta.b > r.ft.y + 1 || r.ft.y - r.cta.b > 16) falla(`«Continuar» termina en ${Math.round(r.cta.b)}px y el pie legal empieza en ${Math.round(r.ft.y)}px: no queda justo encima`);
}

/* «causas» y «frenos»: 6 tarjetas altas en 2 columnas x 3 filas iguales que llenan el alto, con el muñeco arriba y el texto de 2 líneas abajo, ambos centrados, la casilla arriba a la derecha sin pisar el texto y «Continuar» fijo abajo. */
async function revisarGrilla6(p: Page, nombre: string, hallazgos: Hallazgo[]) {
  const r = await p.evaluate(() => {
    const rc = (e: Element | null) => { const b = e ? e.getBoundingClientRect() : new DOMRect(0, 0, 0, 0); return { x: b.left, y: b.top, w: b.width, h: b.height, b: b.bottom, r: b.right }; };
    const tarjetas = [...document.querySelectorAll(".c")].map((c) => {
      const t = c.querySelector("b")!, cs = getComputedStyle(t), cb = c.getBoundingClientRect();
      return { c: rc(c), i: rc(c.querySelector("img.im3d")), t: rc(t), k: rc(c.querySelector(".chk")), cx: cb.left + cb.width / 2, fs: parseFloat(cs.fontSize), lh: parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2, pr: parseFloat(cs.paddingRight) };
    });
    return { tarjetas, ft: rc(document.querySelector(".ft")!), cta: rc(document.querySelector("#seguir")), sub: rc(document.querySelector(".sub")), h2: rc(document.querySelector("h2")!) };
  });
  const falla = (problema: string) => hallazgos.push({ pantalla: nombre, problema });
  const t = r.tarjetas;
  if (t.length !== 6) return falla(`se esperaban 6 tarjetas y hay ${t.length}`);
  const grupos = (v: number[]) => [...v].sort((x, y) => x - y).reduce((n, x, i, a) => n + (i && x - a[i - 1] > 8 ? 1 : 0), 1);   // valores que se separan más de 8 px son otra columna o fila
  const xs = grupos(t.map((c) => c.c.x)), ys = grupos(t.map((c) => c.c.y));
  if (xs !== 2 || ys !== 3) falla(`no es una cuadrícula de 2x3 (columnas ${xs}, filas ${ys})`);
  if (t.some((c) => Math.abs(c.c.h - t[0].c.h) > 1 || Math.abs(c.c.w - t[0].c.w) > 1)) falla("las seis tarjetas no miden lo mismo");
  const fondo = Math.max(...t.map((c) => c.c.b));
  if (r.cta.y < fondo || r.cta.y - fondo > 16) falla(`«Continuar» no queda justo debajo de las tarjetas (${Math.round(fondo)}px → ${Math.round(r.cta.y)}px)`);
  if (Math.min(...t.map((c) => c.c.y)) - r.sub.b > 24) falla("queda un vacío entre el subtítulo y las tarjetas");
  for (const c of t) {
    if (c.i.b > c.t.y + 1) falla("el muñeco no está arriba del texto");
    if (Math.abs(c.i.x + c.i.w / 2 - c.cx) > 2 || Math.abs(c.t.x + c.t.w / 2 - c.cx) > 2) falla("el muñeco y el texto no están centrados en la tarjeta");
    if (c.pr > 0) falla(`el texto tiene ${c.pr}px de relleno a la derecha y queda descentrado`);
    if (c.t.h > c.lh * 2 + 3) falla(`el texto ocupa ${Math.round(c.t.h)}px: más de 2 líneas`);
    if (Math.abs(c.t.h - t[0].t.h) > 1) falla("los textos de las tarjetas no tienen el mismo alto");
    if (c.i.h < c.c.h * 0.4 || c.i.h < 60) falla(`el muñeco es chico: ${Math.round(c.i.w)}x${Math.round(c.i.h)}px en una tarjeta de ${Math.round(c.c.h)}px`);
    if (c.k.x < c.c.x + c.c.w / 2 || c.k.y > c.c.y + 16 || c.k.r > c.c.r) falla("la casilla no está arriba a la derecha de la tarjeta");
    if (c.k.b > c.t.y && c.k.r > c.t.x && c.k.x < c.t.r) falla("la casilla pisa el texto");
    if (c.fs < 12) falla(`el texto mide ${c.fs}px: poco legible`);
  }
  if (r.cta.b > r.ft.y + 1 || r.ft.y - r.cta.b > 16) falla(`«Continuar» termina en ${Math.round(r.cta.b)}px y el pie legal empieza en ${Math.round(r.ft.y)}px: no queda justo encima`);
}

/* Botón de avanzar de cada pantalla que lo tiene: dentro de la ventana, sin scroll y terminando a 16 px o menos del pie legal. Devuelve dónde termina, para comparar entre pantallas. */
async function revisarBoton(p: Page, nombre: string, hallazgos: Hallazgo[], sel = "#seguir") {
  const r = await p.evaluate((s) => {
    const c = document.querySelector(s)?.getBoundingClientRect(), f = document.querySelector(".ft")!.getBoundingClientRect();
    return { cta: c ? { y: c.top, b: c.bottom, x: c.left, r: c.right } : null, ft: f.top, alto: innerHeight, ancho: innerWidth, exceso: document.scrollingElement!.scrollHeight - innerHeight };
  }, sel);
  const falla = (problema: string) => hallazgos.push({ pantalla: nombre, problema });
  if (!r.cta) { falla(`no encuentro el botón ${sel}`); return NaN; }
  if (r.cta.b > r.ft + 1 || r.ft - r.cta.b > 16) falla(`el botón termina en ${Math.round(r.cta.b)}px y el pie legal empieza en ${Math.round(r.ft)}px: no queda a 16 px o menos encima`);
  if (r.cta.y < 0 || r.cta.b > r.alto || r.cta.x < 0 || r.cta.r > r.ancho) falla(`el botón (${Math.round(r.cta.y)}-${Math.round(r.cta.b)}px) no está dentro de la ventana de ${r.alto}px sin scrollear`);
  if (r.exceso > 1) falla(`hay scroll vertical de ${r.exceso}px`);
  return r.cta.b;
}

/* Pantallas informativas: las 3 filas .ill iguales se reparten el alto, el muñeco crece con la fila y entre el título y el botón no queda un vacío. */
async function revisarInformativa(p: Page, nombre: string, hallazgos: Hallazgo[]) {
  const r = await p.evaluate(() => {
    const rc = (e: Element | null) => { const b = e ? e.getBoundingClientRect() : new DOMRect(0, 0, 0, 0); return { x: b.left, y: b.top, w: b.width, h: b.height, b: b.bottom, r: b.right }; };
    const ill = [...document.querySelectorAll(".ill")].map((e) => ({ c: rc(e), i: rc(e.querySelector("img")), t: rc(e.querySelector("div")) }));
    return { ill, h2: rc(document.querySelector("h2")), cta: rc(document.querySelector("#seguir")), previo: rc(document.querySelector("#seguir")!.previousElementSibling), ancho: innerWidth };
  });
  const falla = (problema: string) => hallazgos.push({ pantalla: nombre, problema });
  const f = r.ill;
  if (f.length !== 3) return falla(`se esperaban 3 filas y hay ${f.length}`);
  if (f.some((x) => Math.abs(x.c.h - f[0].c.h) > 1 || Math.abs(x.c.w - f[0].c.w) > 1)) falla("las tres filas no miden lo mismo");
  if (f.some((x, i) => i && x.c.y < f[i - 1].c.b)) falla("las filas se pisan");
  if (f[0].c.y - r.h2.b > 24) falla("queda un vacío entre el título y la primera fila");
  if (f[0].c.r > r.ancho + 1) falla("las filas se salen de la ventana");
  for (const x of f) {
    /* Los muñecos se mecen o se inflan unos píxeles (e-guardia, e-resp): se tolera esa animación. */
    if (x.i.h < 50 || x.i.h < x.c.h * 0.7 || x.i.y < x.c.y - 10 || x.i.b > x.c.b + 10) falla(`el muñeco no crece con la fila: ${Math.round(x.i.w)}x${Math.round(x.i.h)}px en ${Math.round(x.c.h)}px de alto`);
    if (x.t.x < x.i.r - 12 || x.t.r > x.c.r + 1) falla("el texto pisa al muñeco o se sale de la fila");
    if (x.t.y < x.c.y - 1 || x.t.b > x.c.b + 1) falla(`el texto mide ${Math.round(x.t.h)}px y no entra en la fila de ${Math.round(x.c.h)}px`);
  }
  /* Lo último antes del botón (la última fila, o la cita y el cierre) queda pegado a él: el sobrante está en las filas, no en un vacío. */
  if (r.cta.y - r.previo.b > 24) falla(`quedan ${Math.round(r.cta.y - r.previo.b)}px entre lo último de la pantalla y el botón`);
}

/* «medida»: título arriba, muñeco que usa el alto sobrante (o se achica), campo, mensaje con su lugar reservado y botón fijo. Nada se pisa. */
async function revisarMedida(p: Page, nombre: string, hallazgos: Hallazgo[]) {
  const r = await p.evaluate(() => {
    const rc = (e: Element | null) => { const b = e ? e.getBoundingClientRect() : new DOMRect(0, 0, 0, 0); return { x: b.left, y: b.top, w: b.width, h: b.height, b: b.bottom, r: b.right }; };
    return { h2: rc(document.querySelector("h2")), sub: rc(document.querySelector(".sub")), mu: rc(document.querySelector("img.mu")), nbox: rc(document.querySelector(".slid")), msg: rc(document.querySelector(".msg")), cta: rc(document.querySelector("#seguir")), msgScroll: (document.querySelector(".msg") as HTMLElement).scrollHeight, ancho: innerWidth };
  });
  const falla = (problema: string) => hallazgos.push({ pantalla: nombre, problema });
  if (r.h2.y > 40) falla(`el título no queda arriba: empieza en ${Math.round(r.h2.y)}px`);
  if (r.mu.y < r.sub.b - 1) falla("el muñeco pisa el subtítulo");
  if (r.mu.b > r.nbox.y + 1) falla("el muñeco pisa el campo");
  if (r.mu.h < 80) falla(`el muñeco mide ${Math.round(r.mu.h)}px de alto: demasiado chico`);
  if (r.mu.h > 441) falla(`el muñeco mide ${Math.round(r.mu.h)}px: pasa el tope`);
  if (r.nbox.b > r.msg.y + 1 || r.msg.b > r.cta.y + 1) falla("el campo, el mensaje y el botón se pisan");
  if (r.msgScroll > r.msg.h + 1) falla(`el mensaje (${r.msgScroll}px) no entra en su lugar reservado (${Math.round(r.msg.h)}px) y empuja o tapa lo de abajo`);
  if (r.cta.y - r.msg.b > 40) falla(`quedan ${Math.round(r.cta.y - r.msg.b)}px entre el mensaje y el botón`);
}

/* «experto», «mail» y «perfil»: el contenido queda repartido entre el título y el botón; ningún hueco entre elementos consecutivos pasa de `max` px. */
async function revisarReparto(p: Page, nombre: string, hallazgos: Hallazgo[], maxCelu: number) {
  const r = await p.evaluate(() => {
    const hijos = [...document.querySelector(".scr")!.children].filter((e) => getComputedStyle(e).display !== "none").map((e) => { const b = e.getBoundingClientRect(); return { c: e.className || e.tagName, y: b.top, b: b.bottom }; });
    return { hijos, celu: innerWidth < 900, alto: innerHeight };
  });
  const max = r.celu ? maxCelu : Math.max(maxCelu, r.alto * 0.25);   // en compu la ventana es mucho más ancha que alta: se tolera hasta un cuarto del alto
  let mayor = 0, donde = "";
  r.hijos.forEach((h, i) => { if (i) { const g = h.y - r.hijos[i - 1].b; if (g > mayor) { mayor = g; donde = `${r.hijos[i - 1].c} → ${h.c}`; } } });
  if (mayor > max) hallazgos.push({ pantalla: nombre, problema: `queda un vacío de ${Math.round(mayor)}px (${donde}): el contenido no está repartido entre el título y el botón (máximo ${max}px)` });
}

/* Barra fija de la oferta: fuera de pantalla y sin recibir toques al cargar; visible al pasar el final de «Por qué te sirve»; oculta otra vez al subir. */
async function revisarBarra(p: Page, pagina: string, hallazgos: Hallazgo[]) {
  const estado = () => p.evaluate(() => {
    const k = document.querySelector(".sticky") as HTMLElement, b = k.getBoundingClientRect(), cs = getComputedStyle(k);
    const x = Math.min(innerWidth - 5, b.left + b.width - 40), y = Math.min(innerHeight - 4, Math.max(0, b.top + b.height / 2));
    const arriba = document.elementFromPoint(x, y);
    return { top: b.top, bottom: b.bottom, alto: innerHeight, vis: cs.visibility, toques: cs.pointerEvents, tocaBarra: !!arriba && !!arriba.closest(".sticky"), oculta: k.classList.contains("oculta") };
  });
  const falla = (problema: string) => hallazgos.push({ pantalla: pagina, problema });
  const fin = () => p.evaluate(() => { const q = document.getElementById("por-que")!; return { b: q.getBoundingClientRect().bottom + scrollY, ok: /Por qué te sirve/.test(q.textContent ?? "") }; });
  const a = (await fin());
  if (!a.ok) return falla("no encuentro el bloque «Por qué te sirve» (#por-que)");
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(500);
  let e = await estado();
  if (e.top < e.alto || e.vis !== "hidden" || e.toques !== "none" || e.tocaBarra || !e.oculta) falla(`al cargar la barra fija debería estar fuera de pantalla y sin recibir toques: ${JSON.stringify(e)}`);
  /* La barra entra recién cuando el final del bloque quedó por encima de ella: nunca le tapa las últimas líneas. */
  const umbral = a.b - (await p.evaluate(() => innerHeight - (document.querySelector(".sticky") as HTMLElement).offsetHeight));
  await p.evaluate((y) => scrollTo(0, y), umbral - 20); await p.waitForTimeout(500);
  e = await estado();
  if (e.vis !== "hidden" || !e.oculta) falla("la barra fija aparece antes de terminar «Por qué te sirve» y le tapa el final");
  await p.evaluate((y) => scrollTo(0, y), umbral + 20); await p.waitForTimeout(600);
  e = await estado();
  if (e.vis !== "visible" || e.toques === "none" || e.oculta || e.bottom > e.alto + 1 || e.top >= e.alto) falla(`pasado «Por qué te sirve» la barra fija debería verse: ${JSON.stringify(e)}`);
  const finBloque = await p.evaluate(() => document.getElementById("por-que")!.getBoundingClientRect().bottom);
  if (finBloque > e.top + 1) falla(`la barra fija tapa el final de «Por qué te sirve»: el bloque termina en ${Math.round(finBloque)}px y la barra empieza en ${Math.round(e.top)}px`);
  await p.evaluate(() => scrollTo(0, document.scrollingElement!.scrollHeight)); await p.waitForTimeout(500);
  if ((await estado()).vis !== "visible") falla("la barra fija debería seguir visible al llegar al final de la página");
  await p.evaluate((y) => scrollTo(0, y), a.b - (await p.evaluate(() => innerHeight)) - 80); await p.waitForTimeout(600);
  e = await estado();
  if (e.vis !== "hidden" || e.toques !== "none" || e.tocaBarra || e.top < e.alto) falla(`al subir por encima de «Por qué te sirve» la barra fija debería ocultarse otra vez: ${JSON.stringify(e)}`);
  await p.evaluate(() => scrollTo(0, 0));
}

async function recorrer(browser: Awaited<ReturnType<typeof chromium.launch>>, base: string, ancho: number, alto: number, vista: boolean, dirCapturas?: string) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, isMobile: ancho < 500, hasTouch: ancho < 500 });
  const p = await ctx.newPage();
  const hallazgos: Hallazgo[] = [];
  const errores: string[] = [];
  const externos: string[] = [];
  const espejo: string[] = [];
  const envios: string[] = [];
  /* Espía de window.__send: comun.js lo define después, así que se intercepta al asignarlo. */
  await p.addInitScript(() => {
    let real: any; (window as any).__llamadas = [];
    Object.defineProperty(window, "__send", { configurable: true, get: () => real && ((k: string, d: unknown) => { (window as any).__llamadas.push(k); return real(k, d); }), set: (f) => { real = f; } });
  });
  p.on("pageerror", (e) => errores.push(String(e)));
  p.on("console", (m) => { if (m.type() === "error" && !/404|favicon/.test(m.text())) errores.push(m.text()); });
  p.on("request", (r) => { if (!r.url().startsWith(base) && !r.url().startsWith("data:")) externos.push(r.url()); if (/espejo/i.test(r.url())) espejo.push(r.url()); });
  await p.route("**/api/*", (r) => { envios.push(`${r.request().url().replace(base, "")} ${r.request().postData() ?? ""}`); return r.fulfill({ status: 204 }); });
  let n = 0;
  const captura = async (nombre: string) => { if (dirCapturas) { mkdirSync(dirCapturas, { recursive: true }); await p.screenshot({ path: `${dirCapturas}/peso-${ancho}x${alto}-${vista ? "vp" : "prod"}-${String(++n).padStart(2, "0")}-${nombre.replace(/\W+/g, "-")}.png` }); } };
  const m = (nombre: string, o?: Opciones) => medir(p, nombre, hallazgos, captura, o);
  const clic = async (sel: string) => { await p.click(sel); await p.waitForTimeout(520); };
  const titulo = () => p.evaluate(() => document.querySelector("h2")?.textContent ?? "");
  const video = (sel = "#bg video") => p.evaluate((s) => (document.querySelector(s) as HTMLVideoElement | null)?.src ?? "", sel);
  const falla = (pantalla: string, problema: string) => hallazgos.push({ pantalla, problema });

  await p.goto(`${base}/quiz-peso/`);
  await m("edad", { tarjetas: 4 });
  /* Primera pantalla: video hook, prueba social (solo con datos), 4 tarjetas con muñeco y la franja de regalo con su texto verdadero. */
  if (!(await video()).endsWith("/media/hd/hook.mp4")) falla("edad", "la primera pantalla no usa el video hook");
  const hook = await p.evaluate(() => ({ pill: !!document.querySelector(".pill"), regalo: document.querySelector(".gift")?.textContent?.trim() ?? "", icono: !!document.querySelector(".gift svg") }));
  const hayPersonas = !!(await p.evaluate("DATOS_PESO.personas"));
  if (hook.pill !== hayPersonas) falla("edad", `la píldora de personas ${hayPersonas ? "falta aunque hay cifra de personas" : "aparece sin cifra real"}`);
  if (vista && !hayPersonas) falla("edad", "los datos de relleno deberían traer la cifra de personas");
  if (hook.regalo !== REGALO || !hook.icono) falla("edad", `la franja de regalo no dice lo acordado: «${hook.regalo}»`);
  await p.click(".c >> nth=1", { clickCount: 2 }); await p.waitForTimeout(520);   // doble toque: pasa una sola pantalla
  if (!/cuerpo/.test(await titulo())) falla("edad", `un doble toque saltó de pantalla: ahora dice «${await titulo()}»`);
  await m("cuerpo", { tarjetas: 4, claves: CUERPO }); await revisarAlto(p, "cuerpo", hallazgos); await clic(".c >> nth=2");
  await m("meta", { tarjetas: 4 }); await revisarAlto(p, "meta", hallazgos); await clic(".c >> nth=1");
  const botones: Record<string, number> = {};
  const boton = async (pantalla: string, sel = "#seguir") => { botones[pantalla] = await revisarBoton(p, pantalla, hallazgos, sel); };
  await m("zonas", { tarjetas: 5 }); await revisarFilas(p, "zonas", hallazgos); await boton("zonas");
  await p.click(".c >> nth=0"); await p.click(".c >> nth=4");
  if ((await p.$$(".c.on")).length !== 1 || !(await p.$eval(".c >> nth=4", (e) => e.classList.contains("on")))) falla("zonas", "«Todo un poco» no desmarca las zonas puntuales");
  await p.click(".c >> nth=0");
  if ((await p.$$(".c.on")).length !== 1 || !(await p.$eval(".c >> nth=0", (e) => e.classList.contains("on")))) falla("zonas", "marcar una zona puntual no desmarca «Todo un poco»");
  await revisarFilas(p, "zonas-con-seleccion", hallazgos);
  await p.click(".c >> nth=2"); await clic("#seguir");
  await m("forma", { tarjetas: 4 }); await revisarFilas(p, "forma", hallazgos, 4, false); await clic(".c >> nth=0");
  await m("publicacion"); await clic("#seguir");   // slide de la publicación: dos botones abajo (el de arriba avanza)
  await m("exp", { tarjetas: 4 }); await clic(".c >> nth=0");
  await m("info30", { escenas: 3 }); await revisarInformativa(p, "info30", hallazgos); await boton("info30"); await clic("#seguir");
  await m("actividad", { tarjetas: 4 }); await revisarFilas(p, "actividad", hallazgos, 4, false); await clic(".c >> nth=1");
  await m("escaleras", { tarjetas: 3 }); await clic(".c >> nth=1");
  await m("dia", { tarjetas: 4 }); await clic(".c >> nth=0");
  await m("sueno", { tarjetas: 4 }); await clic(".c >> nth=1");
  await m("causas", { tarjetas: 6 }); await revisarGrilla6(p, "causas", hallazgos); await p.click(".c >> nth=0"); await p.click(".c >> nth=3"); await revisarGrilla6(p, "causas-con-seleccion", hallazgos); await boton("causas"); await clic("#seguir");
  if (await p.$("#seguir2")) { await m("noticia"); await clic("#seguir"); }
  await m("infoboxeo", { escenas: 3 }); await revisarInformativa(p, "infoboxeo", hallazgos); await boton("infoboxeo"); await clic("#seguir");
  await m("frenos", { tarjetas: 6 }); await revisarGrilla6(p, "frenos", hallazgos); await p.click(".c >> nth=0"); await p.click(".c >> nth=2"); await revisarGrilla6(p, "frenos-con-seleccion", hallazgos); await boton("frenos"); await clic("#seguir");
  await m("tiempo", { tarjetas: 3 }); await clic(".c >> nth=1");
  await m("altura", { medida: true }); await revisarMedida(p, "altura", hallazgos); await boton("altura"); await setRango(p, "175"); await p.waitForTimeout(100); await revisarMedida(p, "altura-con-valor", hallazgos); await boton("altura-con-valor"); await clic("#seguir");
  await m("peso", { medida: true }); await revisarMedida(p, "peso", hallazgos); await boton("peso");
  await setRango(p, "57"); await p.waitForTimeout(150);
  if (!(await p.isDisabled("#seguir"))) falla("peso", "peso igual al mínimo sano deja pasar a una meta imposible");
  await setRango(p, "92"); await p.waitForTimeout(150); await m("peso-con-imc", { medida: true }); await revisarMedida(p, "peso-con-imc", hallazgos); await boton("peso-con-imc"); await clic("#seguir");
  await m("pesometa", { medida: true }); await revisarMedida(p, "pesometa", hallazgos); await boton("pesometa");
  await setRango(p, "50"); await p.waitForTimeout(150);
  if (!(await p.isDisabled("#seguir"))) falla("pesometa", "meta por debajo del mínimo sano no deshabilita el botón");
  await m("pesometa-bajo-minimo", { medida: true }); await revisarMedida(p, "pesometa-bajo-minimo", hallazgos); await boton("pesometa-bajo-minimo");
  await setRango(p, "92"); await p.waitForTimeout(150);
  if (!(await p.isDisabled("#seguir"))) falla("pesometa", "meta igual al peso actual no deshabilita el botón");
  await setRango(p, "80"); await p.waitForTimeout(150);
  if (await p.isDisabled("#seguir")) falla("pesometa", "una meta válida deja el botón deshabilitado");
  await m("pesometa-ok", { medida: true }); await revisarMedida(p, "pesometa-ok", hallazgos); await boton("pesometa-ok"); await clic("#seguir");
  await m("evento", { tarjetas: 4 }); await clic(".c >> nth=0");
  await m("experto"); await boton("experto"); await revisarReparto(p, "experto", hallazgos, 90); await clic("#seguir");
  await p.waitForTimeout(520);
  await p.waitForSelector(".velo", { timeout: 20000 }); await m("carga-pop1"); await p.click(".velo button >> nth=0");
  await p.waitForSelector(".velo", { timeout: 20000 }); await m("carga-pop2"); await p.click(".velo button >> nth=0");
  await p.waitForSelector("#ver", { timeout: 20000 }); await m("perfil"); await boton("perfil", "#ver"); await revisarReparto(p, "perfil", hallazgos, 90);
  /* Celular chico con las barras del navegador: el perfil no se puede achicar, así que la página crece y, al final del scroll, el botón nunca queda debajo del pie legal. */
  await p.setViewportSize({ width: 375, height: 553 }); await p.waitForTimeout(150);
  await p.evaluate(() => scrollTo(0, document.scrollingElement!.scrollHeight)); await p.waitForTimeout(150);
  const perfilBajo = await p.evaluate(() => { const c = document.querySelector("#ver")!.getBoundingClientRect(), f = document.querySelector(".ft")!.getBoundingClientRect(); return { b: c.bottom, ft: f.top, alto: innerHeight }; });
  if (perfilBajo.b > perfilBajo.ft + 1 || perfilBajo.b > perfilBajo.alto) falla("perfil", `en una ventana de 375x553 el botón termina en ${Math.round(perfilBajo.b)}px y el pie legal empieza en ${Math.round(perfilBajo.ft)}px: queda tapado`);
  await p.setViewportSize({ width: ancho, height: alto }); await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(150);
  /* El botón de avanzar queda en el mismo lugar en TODAS las pantallas que lo tienen. */
  const finales = Object.entries(botones).filter(([, v]) => !Number.isNaN(v));
  if (finales.some(([, v]) => Math.abs(v - finales[0][1]) > 1.5)) falla("botones", `el botón no queda siempre en el mismo lugar: ${finales.map(([k, v]) => `${k} ${Math.round(v)}px`).join(", ")}`);
  if (!(await video()).endsWith("/media/hd/oferta.mp4")) falla("perfil", "el perfil no usa el video oferta");
  const perfil = await p.evaluate(() => ({ tag: !!document.querySelector(".tag"), imc: !!document.querySelector(".box .imcb"), graf: !!document.querySelector(".box .graf") }));
  if (!perfil.tag || !perfil.imc || !perfil.graf) falla("perfil", `el perfil perdió el .tag, la barra de IMC o la proyección dentro de los .box (${JSON.stringify(perfil)})`);
  const llamadas: string[] = await p.evaluate(() => (window as any).__llamadas);
  if (llamadas.includes("lead")) falla("mail", `el quiz llamó a __send('lead'): ${llamadas.join(", ")}`);
  await p.click("#ver");
  await p.waitForURL("**/oferta-peso/**"); await p.waitForTimeout(600);
  await captura("oferta");
  await p.screenshot({ path: dirCapturas ? `${dirCapturas}/peso-${ancho}x${alto}-${vista ? "vp" : "prod"}-oferta-completa.png` : undefined, fullPage: true }).catch(() => {});
  await revisarOferta(p, "oferta-peso", hallazgos);
  await revisarBarra(p, "oferta-peso", hallazgos);
  /* Los rescates comparten la plantilla: mismos bloques (salvo «Por qué arrancar sin plan te frena», que solo va en la oferta). */
  for (const rescate of ["back1-peso", "back2-peso"]) {
    await p.goto(`${base}/${rescate}/`); await p.waitForTimeout(500);
    await revisarOferta(p, rescate, hallazgos);
    await revisarBarra(p, rescate, hallazgos);
    await p.screenshot({ path: dirCapturas ? `${dirCapturas}/peso-${ancho}x${alto}-${vista ? "vp" : "prod"}-${rescate}-completa.png` : undefined, fullPage: true }).catch(() => {});
  }
  /* Entrada directa, sin haber hecho el quiz: se ocultan solo las piezas personales y el resto de la página queda completo. */
  const ctx2 = await browser.newContext({ viewport: { width: ancho, height: alto }, isMobile: ancho < 500, hasTouch: ancho < 500 });
  const p2 = await ctx2.newPage();
  p2.on("pageerror", (e) => errores.push(String(e)));
  p2.on("console", (m) => { if (m.type() === "error" && !/404|favicon/.test(m.text())) errores.push(m.text()); });
  await p2.route("**/api/*", (r) => r.fulfill({ status: 204 }));
  /* El contador de oferta arranca casi en cero (faltan 5 s: margen para que una carga lenta no lo reinicie antes de leerlo) para comprobar que se reinicia solo, como el de /oferta/. */
  await p2.addInitScript(() => { try { sessionStorage.setItem("bc_t0_oferta", String(Math.floor(Date.now() / 1000) - 595)); } catch (e) {} });
  await p2.goto(`${base}/oferta-peso/`); await p2.waitForTimeout(400);
  const cuenta = await p2.evaluate(() => document.querySelector(".tbar .tm")?.textContent ?? "");
  if (!(segundos(cuenta) >= 1 && segundos(cuenta) <= 5)) falla("oferta-peso", `el contador debería arrancar entre 00:05 y 00:01 y marca «${cuenta}»`);
  const directa = await p2.evaluate(() => ({ h1: document.querySelector("h1")?.textContent ?? "", personal: !!document.querySelector(".po-hoy, .po-graf"), video: !!document.querySelector(".vid video"), pasos: document.querySelectorAll(".box .st").length }));
  if (directa.personal || !directa.video || directa.pasos !== 13 || directa.h1 !== "Tu plan para bajar de peso ya está armado.") falla("oferta-peso", `la entrada directa no queda bien: ${JSON.stringify(directa)}`);
  await p2.waitForFunction(() => { const t = document.querySelector(".tbar .tm")?.textContent ?? ""; return /^\d\d:\d\d$/.test(t) && +t.slice(0, 2) * 60 + +t.slice(3) > 590; }, null, { timeout: 6000 })
    .catch(() => falla("oferta-peso", "el contador no se reinició solo al llegar a cero"));
  /* Con movimiento reducido la barra fija no anima su entrada. */
  await p2.emulateMedia({ reducedMotion: "reduce" });
  const dur = await p2.evaluate(() => getComputedStyle(document.querySelector(".sticky")!).transitionDuration);
  if (!/^0s(, 0s)*$/.test(dur)) falla("oferta-peso", `con prefers-reduced-motion la barra fija no debería animarse: ${dur}`);
  await ctx2.close();
  /* Sin mail no hay lead: en todo el recorrido no sale ningún pedido a /api/lead (ni a ningún otro /api/ del quiz). */
  const lead = envios.filter((e) => e.startsWith("/api/lead"));
  if (lead.length) falla("mail", `salió un lead sin que el quiz pida mail: ${lead.join(" | ")}`);
  if (envios.length) falla("mail", `el quiz no debería enviar nada al servidor: ${envios.join(" | ")}`);
  await ctx.close();
  return { hallazgos, errores, externos, espejo };
}

test("quiz-peso: en cada pantalla y en 5 tamaños de ventana no hay scroll vertical ni fondos oscuros grandes, todo son tarjetas con muñeco y los videos son los del funnel", { skip: chrome ? false : "no hay Chrome/Edge instalado", timeout: 300000 }, async () => {
  const browser = await chromium.launch({ executablePath: chrome });
  try {
    for (const conRelleno of [true, false]) {
      const srv = servidor(conRelleno);
      await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
      const base = `http://127.0.0.1:${(srv.address() as { port: number }).port}`;
      try {
        const tamanos = conRelleno ? TAMANOS : TAMANOS.filter(([w]) => w === 1366 || w === 360);
        const res = await Promise.all(tamanos.map(([w, h]) => recorrer(browser, base, w, h, conRelleno, process.env.CAPTURAS_DIR)));
        res.forEach((r, i) => {
          const et = `${tamanos[i][0]}x${tamanos[i][1]}${conRelleno ? " (con datos de relleno)" : " (datos reales, vacíos)"}`;
          assert.deepEqual(r.hallazgos.map((h) => `${et} · ${h.pantalla}: ${h.problema}`), []);
          assert.deepEqual(r.errores, [], `${et}: errores de consola`);
          assert.deepEqual(r.externos, [], `${et}: pedidos a sitios externos`);
          assert.deepEqual(r.espejo, [], `${et}: este funnel nunca pide el video espejo`);
        });
      } finally {
        srv.close();
      }
    }
  } finally {
    await browser.close();
  }
});
