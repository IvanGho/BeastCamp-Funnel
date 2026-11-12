// Pulido de los dos funnels (auditoría visual): lo que se arregló y tiene que seguir arreglado.
//  - el pie legal de las ofertas va al final de la página, sin posición fija, y la barra de abajo no lo tapa;
//  - cada pantalla del quiz lleva el foco a su título, #app anuncia los cambios y los campos tienen etiqueta;
//  - el botón principal es de letra grande (contraste mínimo de texto grande) y su brillo se anima solo con transform;
//  - el perfil de peso entra sin scroll en 360x640 con varias alturas, pesos y nombres, y no salta de diseño;
//  - los tres muñecos grandes de las medidas tienen su versión @2x.
// Necesita Chrome o Edge (variable CHROME_PATH). Si no lo encuentra, los tests de navegador se saltean.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { test } from "node:test";
import { chromium, type Page } from "playwright-core";

const CHROMES = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
const chrome = CHROMES.find((c): c is string => !!c && existsSync(c));
const TIPOS: Record<string, string> = { ".html": "text/html; charset=utf-8", ".mp4": "video/mp4", ".jpg": "image/jpeg", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".txt": "text/plain" };
const saltar = chrome ? false : "no hay Chrome/Edge instalado";

async function conServidor<T>(fn: (base: string) => Promise<T>): Promise<T> {
  const relleno = readFileSync("vista-previa-local/datos-vista-previa.js", "utf8");
  const srv = createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://x");
    let f = join("prueba-quiz/sitio", decodeURIComponent(u.pathname));
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
    if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    let cuerpo: Buffer | string = readFileSync(f);
    if (extname(f) === ".html") cuerpo = cuerpo.toString("utf8").replace(/\/\*DATOS-INICIO\*\/[\s\S]*?\/\*DATOS-FIN\*\//, () => relleno);   // con datos de relleno se ven todos los bloques
    res.writeHead(200, { "content-type": TIPOS[extname(f)] ?? "application/octet-stream" });
    res.end(cuerpo);
  });
  await new Promise<void>((ok) => srv.listen(0, "127.0.0.1", ok));
  try { return await fn(`http://127.0.0.1:${(srv.address() as { port: number }).port}`); }
  finally { await new Promise((ok) => { srv.close(ok); srv.closeAllConnections?.(); }); }
}

const celular = (b: Awaited<ReturnType<typeof chromium.launch>>, ancho = 390, alto = 844, extra = {}) =>
  b.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, ...extra });

const OFERTAS = ["/oferta/", "/back1/", "/back2/", "/oferta-peso/", "/back1-peso/", "/back2-peso/"];

test("ofertas: el pie legal va al final de la página, sin posición fija, y la barra de abajo no lo tapa", { skip: saltar, timeout: 120000 }, async () => {
  await conServidor(async (base) => {
    const b = await chromium.launch({ executablePath: chrome });
    try {
      for (const [ancho, alto] of [[390, 844], [360, 640]] as const) {
        const ctx = await celular(b, ancho, alto);
        const p = await ctx.newPage();
        for (const ruta of OFERTAS) {
          await p.goto(base + ruta, { waitUntil: "load" }); await p.waitForTimeout(500);
          const r = await p.evaluate(() => {
            const ft = document.querySelector("footer.ft") as HTMLElement | null;
            return { n: document.querySelectorAll("footer.ft").length, pos: ft && getComputedStyle(ft).position, dentro: !!ft && !!ft.closest("#app"), ultimo: !!ft && ft.parentElement!.lastElementChild === ft };
          });
          const donde = `${ruta} ${ancho}x${alto}`;
          assert.equal(r.n, 1, `${donde}: un solo pie legal`);
          assert.notEqual(r.pos, "fixed", `${donde}: el pie no puede ser fijo`);
          assert.ok(r.dentro && r.ultimo, `${donde}: el pie es lo último de #app`);
          await p.evaluate(() => scrollTo(0, document.scrollingElement!.scrollHeight)); await p.waitForTimeout(700);
          const tapa = await p.evaluate(() => [...document.querySelectorAll("footer.ft a")].map((a) => {
            const c = a.getBoundingClientRect(); const x = c.left + c.width / 2, y = c.top + c.height / 2;
            const arriba = document.elementFromPoint(x, y);
            return { dentro: y > 0 && y < innerHeight, libre: arriba === a || a.contains(arriba) };
          }));
          assert.equal(tapa.length, 2, `${donde}: los dos enlaces legales`);
          for (const t of tapa) assert.ok(t.dentro && t.libre, `${donde}: al llegar al final los enlaces legales se ven y se pueden tocar (${JSON.stringify(t)})`);
        }
        await ctx.close();
      }
    } finally { await b.close(); }
  });
});

/* Contraste WCAG de dos colores «rgb(r, g, b)». */
const luz = (rgb: number[]) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]); };
const contraste = (a: number[], b: number[]) => { const [x, y] = [luz(a), luz(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

test("botón principal y textos verdes: letra grande en el botón y verde oscuro (o gris #5b665e) en los textos chicos", { skip: saltar, timeout: 120000 }, async () => {
  await conServidor(async (base) => {
    const b = await chromium.launch({ executablePath: chrome });
    try {
      const ctx = await celular(b);
      const p = await ctx.newPage();
      await p.goto(base + "/back1/", { waitUntil: "load" }); await p.waitForTimeout(500);
      const r = await p.evaluate(() => {
        const cta = document.querySelector(".cta:not(.s)") as HTMLElement;
        const cs = getComputedStyle(cta);
        const color = (sel: string) => { const e = document.querySelector(sel); return e ? getComputedStyle(e).color.match(/[\d.]+/g)!.slice(0, 3).map(Number) : null; };
        return { fs: parseFloat(cs.fontSize), fw: parseInt(cs.fontWeight), grad: cs.backgroundImage, alto: cta.getBoundingClientRect().height, sem: color(".sem b"), tag: color(".pill"), sticky: color(".sticky b"), pie: color("footer.ft"), enlace: color("footer.ft a"), fu: color(".badge") };
      });
      assert.ok(r.fs >= 18.66 && r.fw >= 700, `el botón es texto grande (≥ 18,66 px en negrita): ${r.fs}px/${r.fw}`);
      const cols = [...r.grad.matchAll(/rgb\((\d+), (\d+), (\d+)\)/g)].map((m) => [+m[1], +m[2], +m[3]]);
      assert.ok(cols.length >= 2, "el botón lleva un degradado verde");
      for (const c of cols) assert.ok(contraste([255, 255, 255], c) >= 3, `blanco sobre ${c} pasa el mínimo de texto grande (3:1)`);
      assert.deepEqual(cols[0], [22, 163, 74], "arriba conserva el verde de marca #16A34A");
      for (const k of ["sem", "tag", "sticky"] as const) { const c = r[k]; assert.ok(c, `hay ${k}`); assert.ok(contraste(c!, [244, 247, 245]) >= 4.5 || contraste(c!, [255, 255, 255]) >= 4.5, `${k} (${c}) tiene contraste de texto chico`); }
      for (const k of ["pie", "enlace"] as const) assert.ok(contraste(r[k]!, [255, 255, 255]) >= 4.5, `el pie legal (${k}) tiene contraste de texto chico`);
      assert.ok(r.alto >= 54 && r.alto <= 80, `el botón mantiene su alto (${r.alto}px)`);
      await ctx.close();
    } finally { await b.close(); }
  });
});

test("brillo del botón: se anima solo con transform (sin layout) y con movimiento reducido no se anima nada", { skip: saltar, timeout: 120000 }, async () => {
  await conServidor(async (base) => {
    const b = await chromium.launch({ executablePath: chrome });
    try {
      for (const reducido of [false, true]) {
        const ctx = await celular(b, 390, 844, { reducedMotion: reducido ? "reduce" : "no-preference" });
        const p = await ctx.newPage();
        for (const ruta of ["/oferta/", "/oferta-peso/"]) {
          await p.goto(base + ruta, { waitUntil: "load" }); await p.waitForTimeout(400);
          const an = await p.evaluate(() => document.getAnimations().filter((a) => (a as CSSAnimation).animationName === "brillo").map((a) => {
            const props = new Set<string>(); (a.effect as KeyframeEffect).getKeyframes().forEach((k) => Object.keys(k).forEach((x) => props.add(x)));
            return { props: [...props] };
          }));
          if (reducido) assert.equal(an.length, 0, `${ruta}: con movimiento reducido el brillo no se anima`);
          else {
            assert.ok(an.length >= 1, `${ruta}: el brillo se anima`);
            for (const a of an) assert.ok(a.props.includes("transform") && !a.props.includes("left"), `${ruta}: el brillo anima transform, no left (${a.props})`);
          }
        }
        await ctx.close();
      }
    } finally { await b.close(); }
  });
});

test("quiz: cada pantalla lleva el foco a su título, #app anuncia los cambios y los campos del mail tienen etiqueta", { skip: saltar, timeout: 180000 }, async () => {
  await conServidor(async (base) => {
    const b = await chromium.launch({ executablePath: chrome });
    try {
      for (const [ruta, escritorio] of [["/quiz/", false], ["/quiz-peso/", false], ["/quiz/", true]] as const) {
        const ctx = escritorio ? await b.newContext({ viewport: { width: 1280, height: 800 } }) : await celular(b);
        const p = await ctx.newPage();
        await p.goto(base + ruta, { waitUntil: "load" }); await p.waitForTimeout(400);
        assert.equal(await p.getAttribute("#app", "aria-live"), "polite", `${ruta}: #app anuncia los cambios`);
        for (let i = 0; i < 2; i++) {
          await p.click(".c >> nth=0"); await p.waitForTimeout(700);
          const r = await p.evaluate(() => ({ tag: document.activeElement?.tagName, nivel: document.activeElement?.getAttribute("aria-level"), texto: document.activeElement?.textContent, y: scrollY, titulo: document.querySelector("#app h2")?.textContent }));
          assert.equal(r.tag, "H2", `${ruta}: tras elegir una opción el foco está en el título (${r.tag})`);
          assert.equal(r.nivel, "1", `${ruta}: el título es de primer nivel para los lectores de pantalla`);
          assert.equal(r.texto, r.titulo, `${ruta}: el foco está en el título de la pantalla nueva`);
          assert.equal(r.y, 0, `${ruta}: enfocar el título no mueve la pantalla`);
        }
        await ctx.close();
      }
      /* Mail del quiz de peleadores: etiquetas, tipo de teclado y aviso accesible. */
      const ctx = await celular(b);
      const p = await ctx.newPage();
      await p.goto(base + "/quiz/", { waitUntil: "load" });
      for (let v = 0; v < 30; v++) {
        await p.waitForTimeout(650);   // 320 ms de onda + 170 ms de salida de la pantalla
        if (await p.$("#m")) break;
        if (await p.$("#seguir:not([disabled])")) { await p.click("#seguir"); continue; }
        if (await p.$("#seguir[disabled]")) { await p.click(".c >> nth=0"); await p.click("#seguir"); continue; }
        if (await p.$(".c")) { await p.click(".c >> nth=0"); continue; }
      }
      const campos = await p.evaluate(() => ({ nm: document.querySelector("#nm")?.getAttribute("aria-label"), m: document.querySelector("#m")?.getAttribute("aria-label"), modo: document.querySelector("#m")?.getAttribute("inputmode") }));
      assert.deepEqual(campos, { nm: "Tu nombre o apodo", m: "Tu mail", modo: "email" });
      await p.fill("#m", "esto no es un mail"); await p.click("#seguir"); await p.waitForTimeout(200);
      const err = await p.evaluate(() => ({ inv: document.querySelector("#m")?.getAttribute("aria-invalid"), rol: document.querySelector("#mailerr")?.getAttribute("role"), texto: document.querySelector("#mailerr")?.textContent, scroll: document.scrollingElement!.scrollHeight - innerHeight }));
      assert.equal(err.inv, "true"); assert.equal(err.rol, "alert"); assert.match(err.texto ?? "", /Revisá el mail/);
      assert.ok(err.scroll <= 0, `con el aviso del mail inválido la pantalla sigue sin scroll (${err.scroll}px)`);
      await ctx.close();
    } finally { await b.close(); }
  });
});

/* Lleva el quiz de peso hasta el perfil con la altura, el peso y la meta dados; devuelve el CLS acumulado desde que entra la carga. */
async function hastaElPerfil(p: Page, alt: number, peso: number, meta: number, nombre: string) {
  for (let v = 0; v < 50; v++) {
    await p.waitForTimeout(v === 0 ? 150 : 650);
    const info = await p.evaluate(() => {
      const s = document.querySelector("#app .scr"); if (!s) return null;
      const h = s.querySelector("h2")?.textContent ?? "";
      return { c: s.querySelectorAll(".c").length, seguir: !!s.querySelector("#seguir"), n: !!s.querySelector("#n"), nm: !!s.querySelector("#nm"), ver: !!s.querySelector("#ver"), ring: !!s.querySelector(".ring"), h };
    });
    if (!info) continue;
    if (info.ver) return;
    if (info.ring) {
      await p.evaluate(() => { (window as any).__cls.length = 0; });                      // el CLS que importa es el de la carga al perfil
      for (let k = 0; k < 2; k++) { await p.waitForSelector(".velo button", { timeout: 25000 }); await p.waitForTimeout(300); await p.click(".velo button >> nth=0"); await p.waitForTimeout(300); }
      await p.waitForSelector("#ver", { timeout: 30000 }); await p.waitForTimeout(600); return;
    }
    if (info.n) { await p.evaluate((x) => { const i = document.querySelector("#n") as HTMLInputElement; i.value = x; i.dispatchEvent(new Event("input", { bubbles: true })); }, String(/medís/i.test(info.h) ? alt : /pesás/i.test(info.h) ? peso : meta)); await p.waitForTimeout(150); await p.click("#seguir"); continue; }
    if (info.nm) { await p.fill("#nm", nombre); await p.click("#seguir"); continue; }
    if (info.c && info.seguir) { await p.click(".c >> nth=0"); await p.click(".c >> nth=2"); await p.click("#seguir"); continue; }
    if (info.c) { await p.click(".c >> nth=1"); continue; }      // en «evento» la opción 1 («Un casamiento o evento») deja la línea más larga en el perfil
    if (info.seguir) { await p.click("#seguir"); continue; }
  }
  throw new Error("no se llegó al perfil");
}

test("perfil de peso: en 360x640 entra sin scroll con 3 combinaciones de altura, peso y meta y nombres de 1 y 12 letras, y el CLS es menor a 0,1", { skip: saltar, timeout: 400000 }, async () => {
  await conServidor(async (base) => {
    const b = await chromium.launch({ executablePath: chrome });
    try {
      const casos = [[160, 120, 80], [175, 84, 74], [190, 70, 68]] as const;
      const nombres = ["J", "Maximiliano12".slice(0, 12)];
      const trabajos = casos.flatMap(([alt, peso, meta]) => nombres.map(async (nombre) => {
        const ctx = await celular(b, 360, 640);
        await ctx.addInitScript(() => { (window as any).__cls = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries() as any[]) if (!e.hadRecentInput) (window as any).__cls.push(e.value); }).observe({ type: "layout-shift", buffered: true }); } catch (e) {} });
        const p = await ctx.newPage();
        await p.route("**/api/*", (r) => r.fulfill({ status: 204 }));
        await p.goto(base + "/quiz-peso/", { waitUntil: "load" });
        await hastaElPerfil(p, alt, peso, meta, nombre);
        const m = await p.evaluate(() => {
          const ver = document.querySelector("#ver")!.getBoundingClientRect(), ft = document.querySelector(".ft") as HTMLElement;
          const texto = ft.getBoundingClientRect().top + parseFloat(getComputedStyle(ft).paddingTop);
          return { exceso: document.scrollingElement!.scrollHeight - innerHeight, libre: texto - ver.bottom, h2: document.querySelector("h2")!.getBoundingClientRect().height, cls: (window as any).__cls.reduce((a: number, x: number) => a + x, 0) as number };
        });
        await ctx.close();
        return { caso: `${alt} cm, ${peso} → ${meta} kg, nombre de ${nombre.length} letra(s)`, ...m };
      }));
      const res = await Promise.all(trabajos);
      for (const r of res) {
        assert.ok(r.exceso <= 0, `${r.caso}: el perfil no debe tener scroll en 360x640 (sobran ${r.exceso}px)`);
        assert.ok(r.libre >= 0, `${r.caso}: el botón no pisa el pie legal (${Math.round(r.libre)}px)`);
        assert.ok(r.h2 < 30, `${r.caso}: el título del perfil queda en una línea (${r.h2}px)`);
        assert.ok(r.cls < 0.1, `${r.caso}: CLS del perfil menor a 0,1 (${r.cls.toFixed(4)})`);
      }
    } finally { await b.close(); }
  });
});

test("medidas: los tres muñecos grandes (altura, peso y meta) tienen su versión @2x de 720x960 y de hasta 40 KB, y solo la usa .mu", () => {
  const dir = "prueba-quiz/sitio/img";
  for (const k of ["c_guardia", "o_peso", "o_tecnica"]) {
    const f = `${dir}/muneco-${k}@2x.webp`;
    assert.ok(existsSync(f), `existe ${f}`);
    const buf = readFileSync(f);
    assert.ok(buf.length <= 40 * 1024, `${f} pesa ${buf.length} bytes (máximo 40 KB)`);
    assert.equal(buf.toString("ascii", 0, 4), "RIFF"); assert.equal(buf.toString("ascii", 8, 12), "WEBP");
    assert.equal(buf.toString("ascii", 12, 16), "VP8 ", "WebP con pérdida (calidad ~82)");
    assert.equal(buf.readUInt16LE(26) & 0x3fff, 720); assert.equal(buf.readUInt16LE(28) & 0x3fff, 960);
  }
  const peso = readFileSync(`${"prueba-quiz/sitio"}/quiz-peso/index.html`, "utf8");
  assert.match(peso, /const CON_2X = \['c_guardia', 'o_peso', 'o_tecnica'\]/);
  assert.match(peso, /clase === 'mu' && CON_2X\.includes\(k\)/, "el srcset @2x solo va en las imágenes .mu");
});
