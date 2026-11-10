// App del comprador (/app/<acceso>/) en un navegador real, contra la vista previa con el servicio REAL (puerto 0) y una compra simulada
// (POST al webhook de Hilvapay con el token «local»). Comprueba:
//  - el recorrido completo a 360x640, 390x844, 412x915 y 1280x800: bienvenida → hoy → sesión completa (el timer se adelanta con page.clock)
//    → celebración → progreso (con ranking de rivales virtuales) → perfil,
//  - en cada pantalla: sin errores de consola, sin violaciones de CSP, sin scroll horizontal, botones de 44 px o más y nada tapado por la barra inferior,
//  - sonido, voz, vibración y pantalla prendida (con los APIs del navegador reemplazados por registros), retomar una sesión a la mitad,
//  - offline (recargar sin red sigue funcionando), instalabilidad (CDP Page.getInstallabilityErrors vacío),
//  - los accesos pendiente (con aviso largo a los 45 s), revocado, sin acceso (recuperar) y con error de red.
// Necesita Chrome o Edge (CHROME_PATH para cambiar la ruta); si no lo encuentra, se saltea.
// CAPTURAS_DIR=carpeta guarda una captura por pantalla (390x844). CAPTURAS_APP=1 además regenera prueba-quiz/sitio/app/capturas/ (las del manifest,
// 780x1688); después hay que correr node prueba-quiz/scripts/construir-app.mjs.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { iniciarVistaPrevia } from "../vista-previa-local/servir.mjs";
import { planDe } from "../prueba-quiz/contenido/plan.mjs";

const CHROMES = [process.env.CHROME_PATH, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"];
const chrome = CHROMES.find((c) => c && existsSync(c));
const TAMANOS = [[360, 640], [390, 844], [412, 915], [1280, 800]] as const;
const CAP = process.env.CAPTURAS_DIR, CAP_APP = process.env.CAPTURAS_APP === "1";
const CAP_MANIFEST = "prueba-quiz/sitio/app/capturas";

let vista: Awaited<ReturnType<typeof iniciarVistaPrevia>>;
let navegador: Browser;
let datos: string;
let base = "";
let sufijoSw = "";   // para simular un service worker nuevo

before(async () => {
  if (!chrome) return;
  datos = mkdtempSync(join(tmpdir(), "bc-app-"));
  vista = await iniciarVistaPrevia({ puerto: 0, dataDir: datos, silencioso: true, transformar: (ruta, c) => (ruta === "/app/sw.js" && sufijoSw ? Buffer.concat([c, Buffer.from(sufijoSw)]) : c) });
  base = vista.url;
  navegador = await chromium.launch({ executablePath: chrome, args: ["--autoplay-policy=no-user-gesture-required"] });
});
after(async () => {
  if (navegador) await navegador.close();
  if (vista) await vista.cerrar();
  if (datos) rmSync(datos, { recursive: true, force: true });
});

/* ---------- compras simuladas ---------- */
async function webhook(evento: string, cuerpo: object, b = base) {
  const r = await fetch(`${b}/api/hilvapay?evento=${evento}`, { method: "POST", headers: { authorization: "Bearer local", "content-type": "application/json" }, body: JSON.stringify(cuerpo) });
  assert.equal(r.status, 200, `webhook ${evento}`);
}
async function comprar({ funnel = "peso", nivel = "t2", nombre = "Martín Pérez", email = `comprador-${randomUUID().slice(0, 8)}@correo.test` } = {}, b = base) {
  const acceso = randomUUID(), cobroId = "test-" + acceso.slice(0, 8);
  await webhook("pagado", { cobroId, email, nombre, monto: "9990", moneda: "ARS", purchasedAt: new Date().toISOString(), paramsExtra: { acceso, funnel, nivel, pagina: "oferta" } }, b);
  return { acceso, cobroId, email };
}
const urlApp = (acceso: string, b = base) => `${b}/app/${acceso}/`;

/* ---------- herramientas de la página ---------- */
type Registro = { consola: string[]; csp: string[] };
/** Página nueva con el reloj controlado y los APIs de sonido, voz, vibración y pantalla prendida reemplazados por registros. */
async function paginaNueva(ctx: BrowserContext, reloj = true): Promise<{ p: Page; reg: Registro }> {
  const p = await ctx.newPage();
  const reg: Registro = { consola: [], csp: [] };
  p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") reg.consola.push(`${m.type()}: ${m.text()}`); });
  p.on("pageerror", (e) => reg.consola.push("pageerror: " + e.message));
  await p.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__csp = []; w.__voz = []; w.__vib = []; w.__wake = []; w.__tonos = 0;
    document.addEventListener("securitypolicyviolation", (e) => (w.__csp as string[]).push(`${e.violatedDirective} ${e.blockedURI}`));
    navigator.vibrate = (p: VibratePattern) => { (w.__vib as unknown[]).push(p); return true; };
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request: async (t: string) => { (w.__wake as string[]).push(t); return { release: async () => { (w.__wake as string[]).push("release"); }, addEventListener() {} }; } } });
    w.SpeechSynthesisUtterance = class { text: string; constructor(t: string) { this.text = t; } };
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { speak: (u: { text: string }) => (w.__voz as string[]).push(u.text), cancel() {}, getVoices: () => [] } });
    w.AudioContext = class {
      state = "running"; currentTime = 0; destination = {};
      resume() {} createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (x: unknown) => x }; }
      createOscillator() { w.__tonos = (w.__tonos as number) + 1; return { frequency: {}, type: "", connect: (x: unknown) => x, start() {}, stop() {} }; }
    };
  });
  if (reloj) await p.clock.install({ time: Date.now() });
  return { p, reg };
}
async function contexto(w: number, h: number, extra: Record<string, unknown> = {}) {
  return navegador.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 900, isMobile: false, ...extra });
}
async function cspViolaciones(p: Page): Promise<string[]> { return p.evaluate(() => ((window as unknown as { __csp: string[] }).__csp ?? [])); }

/** Chequeos de cada pantalla: scroll horizontal, botones chicos y contenido tapado por la barra inferior. */
async function revisar(p: Page, nombre: string, w: number) {
  const r = await p.evaluate(() => {
    const ancho = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const chicos: string[] = [];
    document.querySelectorAll<HTMLElement>("button, a[href], input, select, summary, [role=switch], [role=radio]").forEach((e) => {
      const b = e.getBoundingClientRect();
      if (b.width === 0 || b.height === 0 || getComputedStyle(e).visibility === "hidden") return;
      if (e.closest("[hidden]")) return;
      if (Math.min(b.width, b.height) < 43.5) chicos.push(`${e.tagName.toLowerCase()}[${e.getAttribute("data-a") ?? e.getAttribute("href") ?? e.id}] ${Math.round(b.width)}x${Math.round(b.height)}`);
    });
    // lo último de la pantalla tiene que poder verse por encima de la barra inferior
    scrollTo(0, document.documentElement.scrollHeight);
    const nav = document.getElementById("nav"), pg = document.querySelector("#vista > .pg");
    let tapado = 0;
    if (nav && !nav.hidden && pg) {
      const hijos = [...pg.querySelectorAll("section > *:last-child, section:last-child")];
      const fondo = Math.max(...hijos.map((e) => e.getBoundingClientRect().bottom), 0);
      tapado = Math.round(fondo - nav.getBoundingClientRect().top);
    }
    scrollTo(0, 0);
    const cortados: string[] = [];
    document.querySelectorAll<HTMLElement>("#vista h1, #vista h2, #vista .cta, #vista .fila, #vista .box").forEach((e) => { const b = e.getBoundingClientRect(); if (b.width && (b.right > innerWidth + 1 || b.left < -1)) cortados.push(e.className || e.tagName); });
    return { ancho, chicos, tapado, cortados };
  });
  assert.ok(r.ancho <= 1, `${nombre} (${w}px): scroll horizontal de ${r.ancho}px`);
  assert.deepEqual(r.chicos, [], `${nombre} (${w}px): botones de menos de 44 px`);
  assert.ok(r.tapado <= 1, `${nombre} (${w}px): la barra inferior tapa ${r.tapado}px del final`);
  assert.deepEqual(r.cortados, [], `${nombre} (${w}px): elementos que se salen de la pantalla`);
}
async function captura(p: Page, nombre: string, w: number, h: number) {
  if (!CAP || w !== 390 || h !== 844) return;
  mkdirSync(CAP, { recursive: true });
  await p.waitForTimeout(500);
  await p.screenshot({ path: join(CAP, `app-${nombre}.png`) });
}
async function capturaManifest(p: Page, nombre: string) {
  if (!CAP_APP || p.viewportSize()?.width !== 390) return;
  mkdirSync(CAP_MANIFEST, { recursive: true });
  await p.waitForTimeout(600);
  await p.screenshot({ path: join(CAP_MANIFEST, `${nombre}.png`) });
}
/** innerText respeta text-transform (las etiquetas salen en mayúsculas): se compara sin distinguirlas. */
const incl = (txt: string, t: string) => txt.toLowerCase().includes(t.toLowerCase());
const sinErrores = async (p: Page, reg: Registro, donde: string) => {
  assert.deepEqual(reg.consola, [], `${donde}: errores en la consola`);
  assert.deepEqual(await cspViolaciones(p), [], `${donde}: violaciones de CSP`);
};

/** Espera (hasta ~8 s) a que haya, o no, una cola de progreso pendiente en localStorage. */
async function hay(p: Page, hayCola: boolean) {
  for (let i = 0; i < 40; i++) {
    if ((await p.evaluate(() => Object.keys(localStorage).some((k) => k.endsWith("_cola")))) === hayCola) return true;
    await new Promise((ok) => setTimeout(ok, 200));
  }
  return false;
}

/** Corre el reloj hasta que termine la fase actual del reproductor. */
async function avanzarFase(p: Page) {
  const r = await p.evaluate(() => { const t = document.getElementById("p-t"); return t ? Number(t.dataset.restante ?? -1) : -2; });
  await p.clock.fastForward((r > 0 ? r * 1000 : 1000) + 80);
}

/* ============================================================================================================ */

for (const [w, h] of TAMANOS) {
  test(`app: recorrido completo a ${w}x${h} (bienvenida, hoy, sesión, celebración, progreso, perfil)`, { skip: !chrome && "no hay Chrome ni Edge instalado" }, async () => {
    const plan = planDe("peso");
    const t1 = plan.niveles.find((n) => n.id === "t1")!;
    const primera = t1.semanas[0].sesiones[0];
    const { acceso } = await comprar({ nivel: "t2" });
    const ctx = await contexto(w, h, CAP_APP && w === 390 ? { deviceScaleFactor: 2 } : {});
    const { p, reg } = await paginaNueva(ctx);

    /* ---- bienvenida ---- */
    await p.goto(urlApp(acceso));
    await p.waitForSelector(".bien");
    assert.equal(await p.locator("h1").innerText(), "Hola, Martín");
    const txt = await p.locator("#vista").innerText();
    for (const t of ["Tu plan está listo", "4 semanas", "Tu apodo para el ranking", "Confirmá tu nivel", "Instalá la app"]) assert.ok(incl(txt, t), `bienvenida: falta «${t}»`);
    assert.equal(await p.inputValue("#apodo"), "Martín", "el apodo arranca con el nombre");
    const tarjetas = await p.locator(".niveles .c img").evaluateAll((l) => l.map((i) => (i as HTMLImageElement).src.split("/").pop()));
    assert.deepEqual(tarjetas, ["muneco-t1.webp", "muneco-t2.webp", "muneco-t3.webp", "muneco-t4.webp"]);
    assert.equal(await p.locator('.niveles .c[aria-checked="true"]').count(), 1);
    assert.match(await p.locator('.niveles .c[aria-checked="true"]').innerText(), /Ritmo/, "arranca con el nivel de la compra");
    await p.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
    await revisar(p, "bienvenida", w);
    assert.ok(incl(txt, "consultá a tu médico antes de empezar"), "nota de salud en la bienvenida");
    // al bajar del todo, las tarjetas de nivel, la instalación y la nota entran enteras arriba del botón fijo «Empezar»
    const abajo = await p.evaluate(() => {
      scrollTo(0, document.documentElement.scrollHeight);
      const cta = document.querySelector(".cta-fija .cta")!.getBoundingClientRect();
      const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
      const cartas = [...document.querySelectorAll(".niveles .c")].map((e) => e.getBoundingClientRect().bottom);
      const res = { cta: cta.top, tarjetas: Math.max(...cartas), instalar: r("[data-instalar]").bottom, nota: r(".bien .pie-p").bottom, botonAbajo: innerHeight - cta.bottom, ctaAlto: cta.height, visibleTop: r(".niveles").top };
      scrollTo(0, 0);
      return res;
    });
    assert.ok(abajo.tarjetas <= abajo.cta + 1 && abajo.instalar <= abajo.cta + 1 && abajo.nota <= abajo.cta + 1, `bienvenida (${w}x${h}): el botón fijo tapa el final: ${JSON.stringify(abajo)}`);
    assert.ok(abajo.botonAbajo >= 0 && abajo.botonAbajo < 40, `el botón queda pegado abajo: ${abajo.botonAbajo}`);
    await captura(p, "bienvenida", w, h);
    await p.click('.niveles .c[data-n="t1"]');
    assert.equal(await p.getAttribute('.niveles .c[data-n="t1"]', "aria-checked"), "true");
    assert.match(await p.locator("#b-nivel").innerText(), /Arranque/);
    await p.fill("#apodo", "Mati 90");
    await p.click('[data-a="empezar-app"]');

    /* ---- hoy (primer día) ---- */
    await p.waitForSelector(".hero");
    assert.match(p.url(), /#\/hoy$/);
    const hoy = await p.locator("#vista").innerText();
    assert.ok(incl(hoy, "Hola, Martín") && incl(hoy, "Tu primera sesión") && incl(hoy, primera.titulo), "Hoy: saludo y primera sesión");
    assert.ok(incl(hoy, `${primera.minutos} min`) && incl(hoy, `${primera.puntos} pts`), "Hoy: minutos y puntos de la sesión");
    assert.ok(incl(hoy, "Sin racha") && incl(hoy, "Esta semana") && incl(hoy, "Próximas sesiones") && incl(hoy, "Drill del día") && incl(hoy, "Tu guía"));
    assert.equal(await p.locator(".sem7 li").count(), 7);
    assert.equal(await p.locator(".sem7 li.ok").count(), 0);
    assert.equal(await p.locator("#nav a").count(), 4);
    assert.equal(await p.getAttribute('#nav a[aria-current="page"]', "href"), "#/hoy");
    await p.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
    await revisar(p, "hoy", w);
    await captura(p, "hoy-primer-dia", w, h);

    /* ---- plan ---- */
    await p.click('#nav a[href="#/plan"]');
    await p.waitForSelector(".sem-c");
    assert.equal(await p.locator(".sem-c").count(), 4);
    const titulos = await p.locator(".sem-c h2").allInnerTexts();
    assert.deepEqual(titulos, t1.semanas.map((s) => s.titulo), "los títulos de las semanas son los del plan");
    assert.equal(await p.locator(".ses-a.sig").count(), 1);
    assert.match(await p.locator(".ses-a.sig").innerText(), /siguiente/i);
    assert.ok(incl(await p.locator("#vista").innerText(), "Por hacer"));
    await revisar(p, "plan", w);
    await captura(p, "plan", w, h);
    await capturaManifest(p, "plan");

    /* ---- resumen y sesión ---- */
    await p.click('#nav a[href="#/hoy"]');
    await p.click(".hero a.cta");
    await p.waitForSelector(".resumen-s");
    const res = await p.locator("#vista").innerText();
    assert.ok(incl(res, primera.titulo) && incl(res, "Qué vas a hacer") && incl(res, String(primera.puntos)));
    assert.equal(await p.locator(".bloques li").count(), primera.bloques.length);
    await revisar(p, "resumen", w);
    await captura(p, "resumen", w, h);
    await p.click('[data-a="empezar"]');
    await p.waitForSelector("#play");
    assert.equal(await p.locator("#nav").isVisible(), false, "la barra inferior se esconde en la sesión");
    assert.equal(await p.getAttribute("#play", "data-fase"), "prep");
    assert.equal(await p.evaluate(() => (window as unknown as { __wake: string[] }).__wake[0]), "screen", "pide pantalla prendida");
    assert.ok((await p.evaluate(() => (window as unknown as { __tonos: number }).__tonos)) > 0, "suena un pitido al empezar");
    assert.ok(((await p.evaluate(() => (window as unknown as { __voz: string[] }).__voz)) as string[]).length > 0, "la voz anuncia");
    await avanzarFase(p);                                   // termina la cuenta de preparación
    await p.waitForFunction(() => document.getElementById("play")!.dataset.fase === "trabajo");
    const nombre1 = await p.innerText("#p-nom");
    assert.ok(nombre1.length > 2);
    assert.match(await p.innerText("#p-cont"), /^Paso 1 de \d+$/);
    assert.match(await p.innerText("#p-t"), /^\d\d:\d\d$/);
    assert.ok((await p.innerText("#anuncio")).startsWith("Trabajo."), "aria-live anuncia la fase");
    assert.equal(await p.locator("#p-zona img.im3d").count() + (await p.locator("#p-zona video").count()), 1, "zona de video: muñeco con indicaciones si no hay video");
    assert.equal(await p.locator("#p-zona video").count(), 0, "los videos todavía están vacíos en el plan");
    assert.ok((await p.locator("#p-zona li").count()) > 0, "las indicaciones del ejercicio");
    assert.match(await p.innerText("#p-sigue"), /Sigue|Descanso/);
    await revisar(p, "sesión", w);
    await captura(p, "sesion", w, h);
    await capturaManifest(p, "sesion");
    // pausa: el tiempo no corre
    await p.click('[data-a="p-pp"]');
    assert.equal(await p.getAttribute("#p-pp", "aria-label"), "Seguir");
    const t0 = await p.innerText("#p-t");
    await p.clock.fastForward(5000);
    assert.equal(await p.innerText("#p-t"), t0, "en pausa el timer no avanza");
    await p.click('[data-a="p-pp"]');
    assert.equal(await p.getAttribute("#p-pp", "aria-label"), "Pausar");
    // avanzar varias fases hasta el primer descanso y ver el aviso de los 10 segundos
    let vioDescanso = false, vioAviso = false;
    for (let i = 0; i < 40 && !vioDescanso; i++) {
      const fase = await p.getAttribute("#play", "data-fase");
      if (fase === "descanso") { vioDescanso = true; break; }
      const r = await p.evaluate(() => Number(document.getElementById("p-t")!.dataset.restante));
      if (r > 12 && !vioAviso) {
        await p.clock.fastForward((r - 9) * 1000);
        vioAviso = (await p.evaluate(() => document.getElementById("anillo-w")!.classList.contains("alerta"))) && ((await p.evaluate(() => (window as unknown as { __voz: string[] }).__voz)) as string[]).some((t) => /Diez segundos/.test(t));
      }
      await avanzarFase(p);
    }
    assert.ok(vioDescanso, "hay descansos entre ejercicios");
    assert.ok(vioAviso, "aviso 10 segundos antes del final (visual y por voz)");
    assert.match(await p.innerText("#anuncio"), /^Descanso\./);
    assert.equal(await p.locator("#p-ftag").textContent(), "Descanso");
    await revisar(p, "descanso", w);
    await captura(p, "descanso", w, h);
    // salir a la mitad y retomar
    const antes = await p.innerText("#p-cont");
    await p.click('[data-a="p-salir"]');
    await p.waitForSelector(".hoja");
    await p.click('[data-a="p-salir-ok"]');
    await p.waitForSelector(".hero.curso");
    assert.match(await p.locator(".hero.curso").innerText(), /seguí donde quedaste/i);
    await revisar(p, "hoy con sesión en curso", w);
    await captura(p, "hoy-retomar", w, h);
    await p.click('.hero.curso [data-a="retomar"]');
    await p.waitForSelector("#play");
    assert.ok((await p.innerText("#p-cont")) !== "", "retoma");
    assert.match(await p.innerText("#p-cont"), new RegExp(`^Paso ${antes.match(/\d+/)![0]} de`), "retoma en el mismo paso");
    // terminar toda la sesión adelantando el reloj
    let vueltas = 0;
    for (; vueltas < 900; vueltas++) {
      if (await p.locator(".fiesta").count()) break;
      await avanzarFase(p);
    }
    assert.ok(vueltas < 900, "la sesión termina");

    /* ---- celebración ---- */
    await p.waitForSelector(".fiesta");
    await p.clock.runFor(1500);   // cuadro a cuadro: los puntos suben de 0 al total
    // (el reloj de prueba corre los timers creados en medio de un salto con ese mismo salto de demora: se lo deja correr)
    for (let i = 0; i < 15 && (await p.innerText("#f-pts")) !== String(primera.puntos); i++) await p.clock.fastForward(15000);
    assert.equal(await p.innerText("#f-pts"), String(primera.puntos), "los puntos suben hasta los de la sesión: " + (await p.locator("#vista").innerText()).replace(/\n+/g, " | "));
    const fin = await p.locator("#vista").innerText();
    assert.ok(incl(fin, "Sesión completa") && incl(fin, "Racha: 1 día") && incl(fin, "Volver a Hoy"));
    assert.ok(((await p.evaluate(() => (window as unknown as { __wake: string[] }).__wake)) as string[]).includes("release"), "suelta la pantalla prendida");
    assert.ok(((await p.evaluate(() => (window as unknown as { __vib: unknown[] }).__vib)) as unknown[]).length > 0, "vibra");
    await revisar(p, "celebración", w);
    await captura(p, "celebracion", w, h);
    await p.click('[data-a="ir-hoy"]');
    await p.waitForSelector(".sem7");

    /* ---- hoy después de entrenar ---- */
    const hoy2 = await p.locator("#vista").innerText();
    assert.ok(incl(hoy2, "1 día") && !incl(hoy2, "Tu primera sesión") && !incl(hoy2, "Seguí donde quedaste"));
    assert.equal(await p.locator(".sem7 li.ok").count(), 1);
    assert.ok(!incl(hoy2, "Tu racha empieza"), "ya no es el primer día");
    await revisar(p, "hoy después de entrenar", w);
    await captura(p, "hoy", w, h);
    await capturaManifest(p, "hoy");

    /* ---- el progreso llegó al servidor ---- */
    await p.clock.fastForward(2500);
    await p.waitForFunction(() => !localStorage.getItem(Object.keys(localStorage).find((k) => k.endsWith("_cola")) ?? "x"));
    let srv: { progreso?: { sesiones: Record<string, { pts: number }>; apodo: string; nivel: string } } = {};
    for (let i = 0; i < 40; i++) {
      srv = await (await fetch(`${base}/api/app/${acceso}`)).json();
      if (srv.progreso && Object.keys(srv.progreso.sesiones).length) break;
      await new Promise((ok) => setTimeout(ok, 100));
    }
    assert.deepEqual(Object.keys(srv.progreso?.sesiones ?? {}), [primera.id], "el progreso se subió con PUT");
    assert.equal(srv.progreso!.sesiones[primera.id].pts, primera.puntos);
    assert.equal(srv.progreso!.apodo, "Mati 90"); assert.equal(srv.progreso!.nivel, "t1");

    /* ---- progreso y ranking ---- */
    await p.click('#nav a[href="#/progreso"]');
    await p.waitForSelector(".rank");
    const prog = await p.locator("#vista").innerText();
    for (const t of ["Tu racha", "sesión", "minutos", "puntos", "Tus 28 días", "Avance por semana", "Ranking", "Los rivales son virtuales", "No son otras personas"]) assert.ok(incl(prog, t), `progreso: falta «${t}»`);
    assert.equal(await p.locator(".stat b").first().innerText(), "1");
    assert.equal(await p.locator(".cd:not(.vacio-d)").count(), 28);
    assert.equal(await p.locator(".cd.ok").count(), 1);
    assert.equal(await p.locator(".rk").count(), 8);
    assert.equal(await p.locator(".rk .vir:not(.tu)").count(), 7);
    assert.deepEqual([...new Set(await p.locator(".rk .vir:not(.tu)").allTextContents())], ["Virtual"]);
    const yo = p.locator(".rk.yo");
    assert.equal(await yo.count(), 1);
    assert.match(await yo.innerText(), /Mati 90/);
    assert.match(await yo.innerText(), new RegExp(String(primera.puntos)));
    assert.ok(!/personas|compradores/i.test(await p.locator(".rank").innerText()), "los rivales no se presentan como personas");
    await revisar(p, "progreso", w);
    await captura(p, "progreso", w, h);
    await p.evaluate(() => document.querySelector(".rank")!.scrollIntoView({ block: "center" }));
    await capturaManifest(p, "progreso");
    await p.evaluate(() => scrollTo(0, 0));

    /* ---- perfil ---- */
    await p.click('#nav a[href="#/perfil"]');
    await p.waitForSelector(".sws");
    const perf = await p.locator("#vista").innerText();
    for (const t of ["Tu perfil", "Apodo en el ranking", "Nivel: Arranque", "Sonido", "Voz", "Vibración", "Instalar", "Guardá tu link", "Ayuda y contacto", "Términos y condiciones", "Política de privacidad", "Salir en este celu", "días de garantía"]) assert.ok(incl(perf, t), `perfil: falta «${t}»`);
    assert.ok(incl(perf, `/app/${acceso}/`), "muestra el link personal");
    assert.deepEqual(await p.locator('.sw[role="switch"]').evaluateAll((l) => l.map((e) => e.getAttribute("aria-checked"))), ["true", "true", "true"]);
    await p.click('.sw[data-k="voz"]');
    assert.equal(await p.getAttribute('.sw[data-k="voz"]', "aria-checked"), "false");
    await p.fill("#apodo", "Mati");
    await p.click('form[data-f="apodo"] button[type="submit"]');
    await p.waitForSelector(".toast");
    assert.equal(await p.locator(".toast").innerText(), "Apodo guardado");
    await p.waitForTimeout(500);
    const choque = await p.evaluate(() => {
      const t = document.querySelector(".toast")!.getBoundingClientRect(), nav = document.getElementById("nav")!.getBoundingClientRect();
      const tapa = [...document.querySelectorAll("#vista h1")].filter((e) => { const b = e.getBoundingClientRect(); return b.width && b.bottom > 0 && b.top < innerHeight && b.top < t.bottom && b.bottom > t.top && b.left < t.right && b.right > t.left; }).map((e) => e.textContent);
      return { sobreNav: Math.round(t.bottom - nav.top), tapa, abajo: t.top > innerHeight / 2 };
    });
    assert.ok(choque.sobreNav <= 0, `el aviso queda arriba de la barra de navegación (${choque.sobreNav}px)`);
    assert.deepEqual(choque.tapa, [], "el aviso no tapa el título de la pantalla");
    assert.ok(choque.abajo, "el aviso aparece abajo");
    await p.fill("#apodo", "<script>");
    await p.click('form[data-f="apodo"] button[type="submit"]');
    assert.ok(incl(await p.innerText("#apodo-err"), "letras"), "rechaza apodos con símbolos");
    await p.click('[data-a="nivel"]');
    await p.waitForSelector(".hoja .niveles");
    assert.equal(await p.locator(".hoja .niveles .c").count(), 4);
    await revisar(p, "cambio de nivel", w);
    await p.click('.hoja .niveles .c[data-n="t3"]');
    await p.waitForFunction(() => document.body.innerText.includes("Nivel: Impulso"));
    assert.equal(await p.locator(".toast").last().evaluate((e) => e.getBoundingClientRect().top > innerHeight / 2), true, "el aviso de nivel no tapa el título «Tu perfil»");
    await revisar(p, "perfil", w);
    await captura(p, "perfil", w, h);
    await sinErrores(p, reg, `recorrido ${w}x${h}`);
    await ctx.close();
  });
}

/** Los ejercicios con más texto (indicaciones + cuidado) de cada perfil, con una sesión que los incluya. */
function masLargos() {
  return (["peso", "peleador"] as const).map((funnel) => {
    const plan = planDe(funnel);
    const [clave, ej] = Object.entries(plan.ejercicios).map(([k, e]) => [k, e] as const).sort((a, b) => (b[1].como.join(" ") + b[1].cuidado).length - (a[1].como.join(" ") + a[1].cuidado).length)[0];
    const sesion = plan.niveles.flatMap((n) => n.semanas.flatMap((s) => s.sesiones)).find((s) => s.bloques.some((b) => b.pasos.some((x) => x.ej === clave)))!;
    return { funnel, clave, ej, sesion, rondas: Math.max(...sesion.bloques.flatMap((b) => b.pasos).filter((x) => x.ej === clave).map((x) => x.rondas)) };
  });
}
for (const [w, h] of [[360, 640], [390, 844]] as const) {
  test(`app: el cuadro «Cómo se hace» muestra enteros los textos más largos del plan (${w}x${h})`, { skip: !chrome && "no hay Chrome ni Edge instalado" }, async () => {
    for (const { funnel, clave, ej, sesion } of masLargos()) {
      const { acceso } = await comprar({ funnel, nivel: "t1" });
      const ctx = await contexto(w, h);
      const { p, reg } = await paginaNueva(ctx, false);
      await p.goto(urlApp(acceso));
      await p.waitForSelector(".bien");
      await p.click('[data-a="empezar-app"]');
      await p.waitForSelector(".hero");
      await p.goto(`${urlApp(acceso)}#/sesion/${sesion.id}`);
      await p.waitForSelector(".resumen-s");
      await p.click('[data-a="empezar"]');
      await p.waitForSelector("#play");
      const revisarZona = async (donde: string) => {
        await p.waitForTimeout(450);
        const z = await p.evaluate(async () => {
          const x = document.querySelector<HTMLElement>("#p-zona .zona-x")!;
          const caja = x.getBoundingClientRect(), zona = document.getElementById("p-zona")!.getBoundingClientRect();
          const hijos = [...x.querySelectorAll("li, p, span")];
          const desborde = x.scrollHeight - x.clientHeight;
          const arriba = { mas: x.classList.contains("mas"), scrollTop: x.scrollTop };
          x.scrollTop = x.scrollHeight;
          await new Promise((ok) => setTimeout(ok, 200));   // el degradado se actualiza con el evento de scroll
          const ultimo = hijos[hijos.length - 1].getBoundingClientRect();
          const abajo = { mas: x.classList.contains("mas"), cortado: Math.round(ultimo.bottom - x.getBoundingClientRect().bottom) };
          const ancho = hijos.filter((e) => e.getBoundingClientRect().right > caja.right + 1).length;
          x.scrollTop = 0;
          return { desborde, arriba, abajo, ancho, desplazable: getComputedStyle(x).overflowY, tabindex: x.getAttribute("tabindex"), textoZona: x.innerText, dentro: caja.bottom <= zona.bottom + 1 && caja.top >= zona.top - 1, scrollW: x.scrollWidth - x.clientWidth };
        });
        assert.equal(z.ancho, 0, `${donde}: texto que se sale por el costado`);
        assert.ok(z.scrollW <= 1, `${donde}: scroll horizontal dentro del cuadro`);
        assert.ok(z.dentro, `${donde}: el cuadro se sale de la zona`);
        assert.ok(z.abajo.cortado <= 1, `${donde}: el último texto queda cortado aun al final (${z.abajo.cortado}px)`);
        assert.equal(z.abajo.mas, false, `${donde}: al llegar al final se va el degradado`);
        if (z.desborde > 2) {   // no entra de una: tiene que poder desplazarse y avisarlo
          assert.equal(z.desplazable, "auto", `${donde}: el cuadro tiene que desplazarse`);
          assert.equal(z.arriba.mas, true, `${donde}: el degradado avisa que hay más texto`);
          assert.equal(z.tabindex, "0", `${donde}: se puede desplazar con el teclado`);
        }
        for (const parte of [ej.cuidado.slice(-25), ej.como[ej.como.length - 1].slice(-25)]) assert.ok(z.textoZona.replace(/\s+/g, " ").includes(parte.replace(/\s+/g, " ")), `${donde}: falta el final «${parte}» (está en el texto del cuadro, no se recorta)`);
        return z;
      };
      // pasos hasta que aparezca el ejercicio más largo en trabajo y en el descanso que lo sigue
      let vistoTrabajo = false, vistoDescanso = false;
      for (let i = 0; i < 80 && !(vistoTrabajo && vistoDescanso); i++) {
        const fase = await p.getAttribute("#play", "data-fase");
        const nombre = (await p.innerText("#p-nom")).trim();
        if (fase === "trabajo" && nombre === ej.nombre && !vistoTrabajo) { await revisarZona(`${funnel} ${clave} (trabajo, ${w}x${h})`); vistoTrabajo = true; }
        else if (fase === "descanso" && vistoTrabajo && !vistoDescanso && (await p.innerText("#p-sigue")).includes(ej.nombre)) { await revisarZona(`${funnel} ${clave} (descanso, ${w}x${h})`); vistoDescanso = true; }
        await p.click('[data-a="p-sig"]');
      }
      assert.ok(vistoTrabajo, `${funnel}: no se llegó al ejercicio ${clave}`);
      if (CAP) { mkdirSync(CAP, { recursive: true }); await p.screenshot({ path: join(CAP, `app-zona-${funnel}-${w}x${h}.png`) }); }
      await sinErrores(p, reg, `zona ${funnel}`);
      await ctx.close();
    }
  });
}

test("app: sin conexión sigue funcionando con los datos guardados, y es instalable", { skip: !chrome && "no hay Chrome ni Edge instalado" }, async () => {
  // servicio propio: se apaga de verdad para probar la falta de conexión (context.setOffline no alcanza al service worker)
  const dir2 = mkdtempSync(join(tmpdir(), "bc-off-"));
  let v2 = await iniciarVistaPrevia({ puerto: 0, dataDir: dir2, silencioso: true });
  const b2 = v2.url, puerto2 = v2.puerto;
  const { acceso } = await comprar({ nivel: "t1" }, b2);
  // contexto persistente (no incógnito): en incógnito Chrome nunca deja instalar y reportaría «in-incognito»
  const perfil = mkdtempSync(join(tmpdir(), "bc-perfil-"));
  const ctx = await chromium.launchPersistentContext(perfil, { executablePath: chrome!, viewport: { width: 390, height: 844 }, args: ["--autoplay-policy=no-user-gesture-required"] });
  const { p, reg } = await paginaNueva(ctx, false);
  try {
    await p.goto(urlApp(acceso, b2));
    await p.waitForSelector(".bien");
    await p.click('[data-a="empezar-app"]');
    await p.waitForSelector(".hero");
    const nombre = await p.locator(".hero h2").innerText();
    // service worker activo y controlando la página
    await p.evaluate(() => navigator.serviceWorker.ready);
    await p.reload();
    await p.waitForSelector(".hero");
    await p.waitForFunction(() => !!navigator.serviceWorker.controller);
    for (let i = 0; i < 50 && !(await p.evaluate(async () => { for (const n of await caches.keys()) if ((await (await caches.open(n)).keys()).some((r) => r.url.endsWith("/img/muneco-t4.webp"))) return true; return false; })); i++) await p.waitForTimeout(200);
    // el service worker guardó el shell, el plan y los muñecos
    const guardado = await p.evaluate(async () => {
      const out: Record<string, string[]> = {};
      for (const n of await caches.keys()) out[n] = (await (await caches.open(n)).keys()).map((r) => new URL(r.url).pathname);
      return out;
    });
    const todas = Object.values(guardado).flat();
    for (const u of ["/app/", "/app/offline.html", `/api/app/${acceso}`, `/api/app/${acceso}/plan`, "/img/muneco-t1.webp", "/img/marca/icono-192.png"]) assert.ok(todas.includes(u), `el service worker no guardó ${u}`);
    assert.ok(Object.keys(guardado).every((k) => k.startsWith("bc-app-")));
    assert.equal(todas.filter((u) => u.startsWith("/media/")).length, 0, "nada de /media/ en la caché");

    // instalable: sin errores de instalabilidad
    const cdp = await ctx.newCDPSession(p);
    const inst = await cdp.send("Page.getInstallabilityErrors");
    assert.deepEqual(inst.installabilityErrors, [], "Page.getInstallabilityErrors");
    const man = await cdp.send("Page.getAppManifest");
    assert.deepEqual(man.errors, [], "errores del manifest");

    // sin conexión: el servicio está apagado y el navegador sin red; recargar sigue mostrando la app y avisa
    await v2.cerrar();
    await ctx.setOffline(true);
    await p.reload();
    await p.waitForSelector(".hero", { timeout: 15000 });
    assert.equal(await p.locator(".hero h2").innerText(), nombre, "con los datos guardados");
    await p.waitForFunction(() => document.getElementById("aviso")!.innerText.toLowerCase().includes("sin conexión"), null, { timeout: 8000 });
    await p.click('#nav a[href="#/plan"]');
    await p.waitForSelector(".sem-c");
    assert.equal(await p.locator(".sem-c").count(), 4);
    await p.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 8000 });
    // el progreso hecho sin red queda en la cola
    await p.click('#nav a[href="#/perfil"]');
    await p.fill("#apodo", "Sin red");
    await p.click('form[data-f="apodo"] button[type="submit"]');
    assert.ok(await hay(p, true), "el progreso sin red queda en la cola");
    // otra ruta del mismo acceso nunca visitada, y un acceso nuevo, abren con la copia guardada (una sola para todas)
    const p2 = await ctx.newPage();
    await p2.goto(`${b2}/app/${randomUUID()}/`);
    assert.ok((await p2.title()).includes("BeastCamp"), "una ruta nunca visitada abre con la copia guardada");
    await p2.close();
    const p3 = await ctx.newPage();
    await p3.goto(`${b2}/app/offline.html`);
    assert.match(await p3.title(), /Sin conexión/);
    await p3.close();

    // vuelve la conexión: la cola sube sola
    v2 = await iniciarVistaPrevia({ puerto: puerto2, dataDir: dir2, silencioso: true });
    await ctx.setOffline(false);
    await p.evaluate(() => window.dispatchEvent(new Event("online")));
    let apodo = "";
    for (let i = 0; i < 60 && apodo !== "Sin red"; i++) {
      await new Promise((ok) => setTimeout(ok, 200));
      apodo = ((await (await fetch(`${b2}/api/app/${acceso}`)).json()) as { progreso?: { apodo: string } }).progreso?.apodo ?? "";
    }
    assert.equal(apodo, "Sin red", "el progreso pendiente se subió al volver la red");
    assert.ok(await hay(p, false), "al subir, la cola se vacía");
    await sinErrores(p, { consola: reg.consola.filter((m) => !/Failed to load resource|ERR_|Failed to fetch/.test(m)) }, "offline");
  } finally {
    await ctx.close();
    await v2.cerrar();
    rmSync(perfil, { recursive: true, force: true }); rmSync(dir2, { recursive: true, force: true });
  }
});

test("app: cuando hay una versión nueva avisa y actualiza al tocar", { skip: !chrome && "no hay Chrome ni Edge instalado" }, async () => {
  const { acceso } = await comprar();
  const ctx = await contexto(390, 844);
  const { p } = await paginaNueva(ctx, false);
  await p.goto(urlApp(acceso));
  await p.waitForSelector(".bien");
  await p.evaluate(() => navigator.serviceWorker.ready);
  // un service worker «nuevo» (el mismo archivo con otro comentario) deja el aviso y recién al tocar toma el control
  sufijoSw = `\n// versión nueva ${Date.now()}\n`;
  await p.evaluate(async () => { const reg = await navigator.serviceWorker.getRegistration("/app/"); await reg!.update(); });
  await p.waitForSelector(".aviso.upd", { timeout: 10000 });
  assert.match(await p.locator(".aviso.upd").innerText(), /Hay una versión nueva/);
  const antes = await p.evaluate(() => navigator.serviceWorker.controller?.scriptURL);
  assert.ok(antes);
  await Promise.all([p.waitForNavigation({ waitUntil: "load" }), p.click('[data-a="actualizar"]')]);
  await p.waitForSelector(".bien");
  assert.equal(await p.locator(".aviso.upd").count(), 0, "después de actualizar, el aviso se va");
  sufijoSw = "";
  await ctx.close();
});

test("app: acceso pendiente muestra «confirmando tu pago», a los 45 s da más información y entra cuando llega el pago", { skip: !chrome && "no hay Chrome ni Edge instalado" }, async () => {
  const acceso = randomUUID();
  const ctx = await contexto(390, 844);
  const { p, reg } = await paginaNueva(ctx);
  await p.goto(urlApp(acceso));
  await p.waitForSelector(".msg.conanillo");
  let txt = await p.locator("#vista").innerText();
  assert.ok(incl(txt, "Estamos confirmando tu pago"));
  assert.ok(!incl(txt, "Está tardando"));
  await revisar(p, "pendiente", 390);
  await captura(p, "pendiente", 390, 844);
  // reintenta solo cada ~2,5 s
  let pedidos = 0;
  p.on("request", (r) => { if (r.url().endsWith(`/api/app/${acceso}`)) pedidos++; });
  for (let i = 0; i < 3; i++) { await p.clock.fastForward(2600); await p.waitForTimeout(200); }
  assert.ok(pedidos >= 2, `reintenta solo (pedidos: ${pedidos})`);
  await p.clock.fastForward(46000);
  await p.waitForFunction(() => document.body.innerText.includes("Está tardando más de lo normal"));
  txt = await p.locator("#vista").innerText();
  assert.ok(incl(txt, "Mientras tanto") && incl(txt, "Algunos medios de pago tardan un poco más en confirmarse") && incl(txt, "Mirá tu mail") && incl(txt, "Revisar ahora") && incl(txt, "Recibir el link por mail"));
  await revisar(p, "pendiente largo", 390);
  await captura(p, "pendiente-largo", 390, 844);
  // llega el aviso de pago: la app entra sola
  await webhook("pagado", { cobroId: "test-" + acceso.slice(0, 8), email: `p-${acceso.slice(0, 6)}@correo.test`, nombre: "Lucía", monto: "9990", moneda: "ARS", purchasedAt: new Date().toISOString(), paramsExtra: { acceso, funnel: "peso", nivel: "t3", pagina: "oferta" } });
  await p.clock.fastForward(9000);
  await p.waitForSelector(".bien", { timeout: 10000 });
  assert.equal(await p.locator("h1").innerText(), "Hola, Lucía");
  assert.match(await p.locator('.niveles .c[aria-checked="true"]').innerText(), /Impulso/);
  await sinErrores(p, reg, "pendiente");
  await ctx.close();
});

test("app: acceso revocado muestra su pantalla", { skip: !chrome && "no hay Chrome ni Edge instalado" }, async () => {
  const { acceso, cobroId } = await comprar();
  await webhook("reembolso", { cobroId, paramsExtra: { acceso } });
  const ctx = await contexto(390, 844);
  const { p, reg } = await paginaNueva(ctx);
  await p.goto(urlApp(acceso));
  await p.waitForSelector(".msg");
  const txt = await p.locator("#vista").innerText();
  assert.ok(incl(txt, "Este acceso ya no está activo") && incl(txt, "reembolso"), txt);
  assert.equal(await p.locator("#nav").isVisible(), false);
  await revisar(p, "revocado", 390);
  await captura(p, "revocado", 390, 844);
  await sinErrores(p, reg, "revocado");
  await ctx.close();
});

test("app: sin acceso en la URL, redirige al último acceso o ofrece recuperar el link sin revelar si el mail existe", { skip: !chrome && "no hay Chrome ni Edge instalado" }, async () => {
  const { acceso, email } = await comprar({ nombre: "Rocío" });
  // 1) con un último acceso guardado: redirige
  const ctx1 = await contexto(390, 844);
  await ctx1.addInitScript((a) => { try { if (!localStorage.getItem("bc_app_ultimo")) localStorage.setItem("bc_app_ultimo", a); } catch (e) { /* sin storage */ } }, acceso);
  const { p: p1 } = await paginaNueva(ctx1, false);
  await p1.goto(`${base}/app/`);
  await p1.waitForURL(new RegExp(`/app/${acceso}/`));
  await p1.waitForSelector(".bien");
  await ctx1.close();

  // 2) sin nada guardado: recuperar
  const ctx = await contexto(390, 844);
  const { p, reg } = await paginaNueva(ctx);
  await p.goto(`${base}/app/`);
  await p.waitForSelector('form[data-f="recuperar"]');
  assert.equal(await p.locator("h1").innerText(), "Recuperá tu link");
  await revisar(p, "recuperar", 390);
  await captura(p, "recuperar", 390, 844);
  await p.fill("#mail", "esto-no-es-un-mail");
  await p.click("#rec-b");
  assert.ok(incl(await p.innerText("#mail-err"), "mail"));
  const respuestas: string[] = [];
  for (const mail of ["nadie-" + randomUUID().slice(0, 6) + "@correo.test", email]) {
    await p.goto(`${base}/app/`);
    await p.waitForSelector("#mail");
    await p.fill("#mail", mail);
    const llamada = p.waitForResponse((r) => r.url().endsWith("/api/app/recuperar"));
    await p.click("#rec-b");
    assert.equal((await llamada).status(), 204);
    await p.waitForSelector(".msg h1");
    respuestas.push(await p.locator("#vista").innerText());
  }
  assert.equal(respuestas[0], respuestas[1], "la respuesta es la misma exista o no el mail");
  assert.ok(respuestas[0].includes("Si ese mail tiene una compra"));
  await captura(p, "recuperar-listo", 390, 844);
  await sinErrores(p, reg, "recuperar");
  await ctx.close();
});

test("app: error de red muestra el mensaje con reintento", { skip: !chrome && "no hay Chrome ni Edge instalado" }, async () => {
  const { acceso } = await comprar();
  const ctx = await contexto(390, 844, { serviceWorkers: "block" });
  const { p } = await paginaNueva(ctx, false);
  await p.route(`**/api/app/${acceso}`, (r) => r.abort());
  await p.goto(urlApp(acceso));
  await p.waitForSelector('[data-a="reintentar"]');
  const txt = await p.locator("#vista").innerText();
  assert.ok(incl(txt, "No pudimos cargar tu plan") && incl(txt, "Reintentar"));
  await revisar(p, "error de red", 390);
  await captura(p, "error", 390, 844);
  await p.unroute(`**/api/app/${acceso}`);
  await p.click('[data-a="reintentar"]');
  await p.waitForSelector(".bien");
  await ctx.close();
});
