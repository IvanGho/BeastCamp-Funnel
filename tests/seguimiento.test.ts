// Medición, pago, gracias y metadatos de los dos funnels (peleadores y bajar de peso) con un Chrome real:
//  - la campaña (utm_* y fbclid) se guarda en bc_utm y viaja por quiz → oferta → back1 → back2,
//  - «Ir al pago» arma el link de Hilvapay con todos los parámetros del contrato y manda /api/click con funnel, página y campaña,
//  - /gracias/ limpia nombre y mail de la barra y arma «Entrar a mi plan»,
//  - los videos arrancan solos y en silencio (iOS), y todas las páginas llevan sus metadatos.
// Los links de pago se simulan reemplazando el bloque de datos al servir la página, como hace la vista previa con ?vista=1.
// Necesita Chrome o Edge (variable CHROME_PATH). Si no lo encuentra, los tests de navegador se saltean.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
/* El peso y la altura se eligen con un deslizador: mueve el valor y avisa como si el usuario lo deslizara. */
async function setRango(p: Page, v: string) { await p.evaluate((x) => { const i = document.querySelector("#n") as HTMLInputElement; i.value = x; i.dispatchEvent(new Event("input", { bubbles: true })); }, v); }

const CHROMES = [process.env.CHROME_PATH, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/opt/pw-browsers/chromium"].filter(Boolean) as string[];
const chrome = CHROMES.find((c) => existsSync(c));
const sinChrome = chrome ? false : "no hay Chrome/Edge instalado";
const TIPOS: Record<string, string> = { ".html": "text/html; charset=utf-8", ".mp4": "video/mp4", ".jpg": "image/jpeg", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".txt": "text/plain" };
const RE_ACCESO = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const leer = (r: string) => readFileSync(r, "utf8");

const PAGO = { base: "https://pago.simulado/pagos/bc/base?ref=abc", b1: "https://pago.simulado/pagos/bc/b1", b2: "https://pago.simulado/pagos/bc/b2" };
const BLOQUE_PAGO = "pagoUrl: { base: '', b1: '', b2: '' }";
const CAMPANA = "utm_source=facebook&utm_medium=paid&utm_campaign=Lanzamiento%20Mayo%20%26%202026&utm_content=video%201&utm_term=" + "x".repeat(600) + "&fbclid=IwAR0abc123";

/* Sirve prueba-quiz/sitio/. Con `conPago`, cambia el bloque de links de pago vacíos por los simulados (los datos reales siguen vacíos en el sitio). */
function servidor(conPago: boolean) {
  return createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://x");
    let f = join("prueba-quiz/sitio", decodeURIComponent(u.pathname));
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
    if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    let cuerpo: Buffer | string = readFileSync(f);
    if (conPago && extname(f) === ".html") cuerpo = cuerpo.toString("utf8").replace(BLOQUE_PAGO, () => `pagoUrl: ${JSON.stringify(PAGO)}`);
    res.writeHead(200, { "content-type": TIPOS[extname(f)] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(cuerpo);
  });
}

async function conServidor<T>(conPago: boolean, fn: (base: string) => Promise<T>): Promise<T> {
  const srv = servidor(conPago);
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  try { return await fn(`http://127.0.0.1:${(srv.address() as { port: number }).port}`); } finally { srv.close(); }
}

type Clic = Record<string, unknown>;
type Sesion = { ctx: BrowserContext; p: Page; errores: string[]; externos: string[]; clics: Clic[]; pagos: string[] };

/* Una ventana de celular con el pago simulado interceptado y /api/* registrado (los cuerpos de /api/click se guardan para compararlos). */
async function abrir(browser: Browser, base: string): Promise<Sesion> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const s: Sesion = { ctx, p, errores: [], externos: [], clics: [], pagos: [] };
  p.on("pageerror", (e) => s.errores.push(String(e)));
  p.on("console", (m) => { if (m.type() === "error" && !/404|favicon/.test(m.text()) && !m.location().url.includes("pago.simulado")) s.errores.push(m.text()); });
  p.on("request", (r) => { const x = r.url(); if (!x.startsWith(base) && !x.startsWith("data:") && !x.startsWith("https://pago.simulado/")) s.externos.push(x); });
  await ctx.route("https://pago.simulado/**", (r) => { s.pagos.push(r.request().url()); return r.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>pago</title><p>pago simulado</p>" }); });
  await ctx.route("**/api/*", (r) => {
    if (r.request().url().endsWith("/api/click")) s.clics.push(JSON.parse(r.request().postData() ?? "{}"));
    return r.fulfill({ status: 204 });
  });
  return s;
}

const clic = async (p: Page, sel: string) => { await p.click(sel); await p.waitForTimeout(520); };

/* Quiz de peleadores hasta «Ver mi plan». Elige «Fighter» (t4) en la pregunta de tiempo. */
async function quizPeleador(p: Page) {
  await clic(p, ".c >> nth=0");                      // hook
  await clic(p, ".c >> nth=1");                      // nivel
  await clic(p, ".c >> nth=0");                      // objetivo
  await clic(p, "#seguir");                          // info
  if (await p.$("#seguir2")) await clic(p, "#seguir");
  await p.click(".c >> nth=0"); await p.click(".c >> nth=4"); await clic(p, "#seguir");
  await clic(p, ".c >> nth=0");                      // lugar
  await clic(p, ".c >> nth=3");                      // tiempo: Fighter
  await clic(p, ".c >> nth=1");                      // precio
  await clic(p, "#seguir");                          // experto
  await p.fill("#nm", "Martín Pérez"); await p.fill("#m", "martin@correo.com"); await clic(p, "#seguir");
  for (let i = 0; i < 2; i++) { await p.waitForSelector(".velo", { timeout: 20000 }); await p.click(".velo button >> nth=0"); }
  await p.waitForSelector("#ver", { timeout: 20000 });
}

/* Quiz de bajar de peso hasta «Ver mi plan». Elige «Ritmo» (t2) y deja el nombre vacío (no hay mail en este quiz). */
async function quizPeso(p: Page) {
  await clic(p, ".c >> nth=2");                      // cuerpo (primera pantalla)
  await setRango(p, "38"); await p.waitForTimeout(100); await clic(p, "#seguir");        // edad (deslizador)
  await clic(p, ".c >> nth=1");                      // meta
  await clic(p, ".c >> nth=2"); await clic(p, "#seguir");   // zonas
  await clic(p, ".c >> nth=0");                      // forma
  await clic(p, "#seguir");                          // publicación (Sí, lo vi)
  await clic(p, ".c >> nth=0");                      // exp
  await clic(p, "#seguir");                          // info30
  await clic(p, ".c >> nth=1");                      // actividad
  await clic(p, ".c >> nth=1");                      // escaleras
  await clic(p, ".c >> nth=0");                      // dia
  await clic(p, ".c >> nth=1");                      // sueno
  await p.click(".c >> nth=0"); await p.click(".c >> nth=3"); await clic(p, "#seguir");   // causas
  if (await p.$("#seguir2")) await clic(p, "#seguir");
  await clic(p, "#seguir");                          // infoboxeo
  await p.click(".c >> nth=0"); await p.click(".c >> nth=2"); await clic(p, "#seguir");   // frenos
  await clic(p, ".c >> nth=1");                      // tiempo: Ritmo
  await setRango(p, "175"); await p.waitForTimeout(100); await clic(p, "#seguir");       // altura
  await setRango(p, "92"); await p.waitForTimeout(150); await clic(p, "#seguir");        // peso
  await setRango(p, "80"); await p.waitForTimeout(150); await clic(p, "#seguir");        // meta de peso
  await clic(p, ".c >> nth=0");                      // evento
  await clic(p, "#seguir");                          // experto
  for (let i = 0; i < 2; i++) { await p.waitForSelector(".velo", { timeout: 20000 }); await p.click(".velo button >> nth=0"); }
  await p.waitForSelector("#ver", { timeout: 20000 });
}

type Funnel = {
  nombre: string; funnel: string; quiz: string; sufijo: string; recorrer: (p: Page) => Promise<void>;
  nivel: string; datosPersonales: Record<string, string>; ausentes: string[];
};
const FUNNELS: Funnel[] = [
  { nombre: "peleadores", funnel: "peleador", quiz: "/quiz/", sufijo: "", recorrer: quizPeleador, nivel: "t4", datosPersonales: { nombre: "Martín Pérez", email: "martin@correo.com" }, ausentes: [] },
  { nombre: "bajar de peso", funnel: "peso", quiz: "/quiz-peso/", sufijo: "-peso", recorrer: quizPeso, nivel: "t2", datosPersonales: {}, ausentes: ["nombre", "email"] },
];

const params = (url: string) => new URL(url).searchParams;
const esperadas = { utm_source: "facebook", utm_medium: "paid", utm_campaign: "Lanzamiento Mayo & 2026", utm_content: "video 1", utm_term: "x".repeat(500), fbclid: "IwAR0abc123" };

/* El link de Hilvapay: el link base intacto, todos los parámetros del contrato, nada vacío y ningún valor de más de 500 caracteres. */
function revisarLink(url: string, f: Funnel, pagina: string, baseEsperada: string, acceso?: string) {
  const u = new URL(url);
  const b = new URL(baseEsperada);
  assert.equal(u.origin + u.pathname, b.origin + b.pathname, `${pagina}: el link base cambió`);
  for (const [k, v] of b.searchParams) assert.equal(u.searchParams.get(k), v, `${pagina}: se perdió el parámetro propio del link (${k})`);
  const q = u.searchParams;
  assert.match(q.get("acceso") ?? "", RE_ACCESO, `${pagina}: acceso es un UUID v4`);
  if (acceso) assert.equal(q.get("acceso"), acceso, `${pagina}: el acceso es siempre el mismo en este navegador`);
  assert.equal(q.get("funnel"), f.funnel);
  assert.equal(q.get("nivel"), f.nivel, `${pagina}: nivel sale de la respuesta «tiempo»`);
  assert.equal(q.get("pagina"), pagina);
  for (const [k, v] of Object.entries(f.datosPersonales)) assert.equal(q.get(k), v, `${pagina}: ${k}`);
  for (const k of f.ausentes) assert.equal(q.has(k), false, `${pagina}: ${k} no debería ir (el quiz no lo pidió)`);
  for (const [k, v] of Object.entries(esperadas)) assert.equal(q.get(k), v, `${pagina}: ${k}`);
  assert.match(q.get("fbc") ?? "", /^fb\.1\.\d{13}\.IwAR0abc123$/, `${pagina}: fbc = fb.1.<ahora>.<fbclid>`);
  for (const [k, v] of q) {
    assert.ok(v.length > 0, `${pagina}: ${k} viene vacío`);
    assert.ok(v.length <= 500, `${pagina}: ${k} pasa los 500 caracteres`);
  }
  assert.ok([...q.keys()].length <= 30, `${pagina}: más de 30 parámetros`);
  assert.equal(new Set(q.keys()).size, [...q.keys()].length, `${pagina}: parámetros repetidos`);
  return q.get("acceso") as string;
}

/* El cuerpo del clic: precio, funnel, página, campaña y fbc; sin datos personales ni nada más. */
function revisarClic(c: Clic, f: Funnel, pagina: string, precio: string) {
  assert.deepEqual(Object.keys(c).sort(), ["fbc", "funnel", "pagina", "precio", "t", "utm_campaign", "utm_content", "utm_medium", "utm_source", "utm_term"], `${pagina}: campos de /api/click`);
  assert.equal(c.precio, precio);
  assert.equal(c.funnel, f.funnel);
  assert.equal(c.pagina, pagina);
  assert.equal(c.utm_source, "facebook");
  assert.equal(c.utm_campaign, "Lanzamiento Mayo & 2026");
  assert.equal((c.utm_term as string).length, 500);
  assert.match(String(c.fbc), /^fb\.1\.\d{13}\.IwAR0abc123$/);
  assert.equal(typeof c.t, "number");
}

/* Abre la reserva de la página actual, toca «Ir al pago» y devuelve a dónde fue. */
async function pagar(s: Sesion) {
  const antes = s.pagos.length;
  await s.p.click("[data-reservar] >> nth=0");
  await s.p.waitForSelector("#pgb");
  await s.p.click("#pgb");
  await s.p.waitForURL("https://pago.simulado/**");
  await s.p.waitForTimeout(300);
  assert.equal(s.pagos.length, antes + 1);
  return s.pagos[s.pagos.length - 1];
}

for (const f of FUNNELS) {
  test(`seguimiento (${f.nombre}): la campaña viaja por quiz → oferta → back1 → back2 y «Ir al pago» arma el link con todos los parámetros`, { skip: sinChrome, timeout: 240000 }, async () => {
    const browser = await chromium.launch({ executablePath: chrome });
    try {
      await conServidor(true, async (base) => {
        const s = await abrir(browser, base);
        const { p } = s;
        await p.goto(`${base}${f.quiz}?${CAMPANA}`);
        await p.waitForSelector(".c");

        /* Se guarda al entrar. */
        const guardada = await p.evaluate(() => JSON.parse(localStorage.getItem("bc_utm") ?? "null"));
        for (const [k, v] of Object.entries(esperadas)) assert.equal(guardada[k], v, `bc_utm.${k}`);
        assert.match(guardada.fbc, /^fb\.1\.\d{13}\.IwAR0abc123$/);
        assert.ok(Math.abs(guardada.ts - Date.now()) < 120000, "bc_utm.ts");

        /* Quiz → oferta conserva los parámetros. */
        await f.recorrer(p);
        await p.click("#ver");
        await p.waitForURL(`**/oferta${f.sufijo}/**`); await p.waitForTimeout(400);
        let q = params(p.url());
        for (const [k, v] of Object.entries(esperadas)) assert.equal(q.get(k), v, `quiz → oferta: ${k}`);
        assert.equal(q.has("fbc"), false, "fbc no viaja en la dirección: se calcula una sola vez");
        assert.deepEqual(await p.evaluate(() => JSON.parse(localStorage.getItem("bc_utm") ?? "{}").fbc), guardada.fbc, "el fbc no se recalcula al pasar de página");

        /* Pago de la oferta (precio base). */
        const acceso = revisarLink(await pagar(s), f, "oferta", PAGO.base);
        assert.equal(s.clics.length, 1, "un clic en /api/click");
        revisarClic(s.clics[0], f, "oferta", "$9.990");

        /* oferta → back1 → back2 (la persona intenta irse) conservan la campaña. */
        await p.goto(`${base}/oferta${f.sufijo}/?${CAMPANA}`); await p.waitForSelector(".scr");
        assert.equal(await p.evaluate(() => localStorage.getItem("bc_acceso")), acceso, "bc_acceso guardado");
        await p.evaluate(() => document.dispatchEvent(new MouseEvent("mouseleave", { clientY: -5 })));
        await p.waitForURL(`**/back1${f.sufijo}/**`); await p.waitForSelector(".scr");
        q = params(p.url());
        for (const [k, v] of Object.entries(esperadas)) assert.equal(q.get(k), v, `oferta → back1: ${k}`);
        await p.evaluate(() => document.dispatchEvent(new MouseEvent("mouseleave", { clientY: -5 })));
        await p.waitForURL(`**/back2${f.sufijo}/**`); await p.waitForSelector(".scr");
        q = params(p.url());
        for (const [k, v] of Object.entries(esperadas)) assert.equal(q.get(k), v, `back1 → back2: ${k}`);
        revisarLink(await pagar(s), f, "back2", PAGO.b2, acceso);
        revisarClic(s.clics[1], f, "back2", "$4.990");

        /* Cada página cobra con el link de su precio, con el mismo acceso; sin parámetros en la dirección sale lo guardado. */
        await p.goto(`${base}/back1${f.sufijo}/`); await p.waitForSelector(".scr");
        revisarLink(await pagar(s), f, "back1", PAGO.b1, acceso);
        revisarClic(s.clics[2], f, "back1", "$7.990");
        await p.goto(`${base}/oferta${f.sufijo}/`); await p.waitForSelector(".scr");
        revisarLink(await pagar(s), f, "oferta", PAGO.base, acceso);
        revisarClic(s.clics[3], f, "oferta", "$9.990");

        assert.deepEqual(s.errores, [], "errores de consola");
        assert.deepEqual(s.externos, [], "pedidos a sitios externos");
        await s.ctx.close();
      });
    } finally {
      await browser.close();
    }
  });
}

test("seguimiento: la campaña vence a los 30 días, una campaña nueva pisa la anterior y sin link de pago solo se cuenta el clic", { skip: sinChrome, timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: chrome });
  try {
    /* Datos reales (links de pago vacíos). */
    await conServidor(false, async (base) => {
      const s = await abrir(browser, base);
      const { p } = s;
      await p.goto(`${base}/oferta/?utm_source=tiktok&ttclid=TT1&utm_campaign=vieja`);
      assert.deepEqual(await p.evaluate(() => { const v = JSON.parse(localStorage.getItem("bc_utm")!); delete v.ts; return v; }), { utm_source: "tiktok", ttclid: "TT1", utm_campaign: "vieja" });
      await p.goto(`${base}/oferta/?utm_source=google&gclid=G1`);
      assert.deepEqual(await p.evaluate(() => { const v = JSON.parse(localStorage.getItem("bc_utm")!); delete v.ts; return v; }), { utm_source: "google", gclid: "G1" }, "la campaña nueva pisa la anterior");
      /* Vencida (31 días): se ignora. */
      await p.evaluate(() => localStorage.setItem("bc_utm", JSON.stringify({ utm_source: "viejo", ts: Date.now() - 31 * 86400000 })));
      await p.goto(`${base}/back1/`);
      await p.click("[data-reservar] >> nth=0"); await p.waitForSelector("#pgb"); await p.click("#pgb");
      await p.waitForFunction(() => /Todavía no abrimos el pago/.test(document.getElementById("pg")?.textContent ?? ""));
      await p.waitForTimeout(300);
      assert.deepEqual(s.pagos, [], "sin link de pago no se navega a ningún lado");
      assert.equal(s.clics.length, 1, "igual se cuenta el clic");
      assert.deepEqual(Object.keys(s.clics[0]).sort(), ["funnel", "pagina", "precio", "t"], "campaña vencida: el clic va sin campaña");
      assert.equal(s.clics[0].pagina, "back1");
      assert.equal(s.clics[0].precio, "$7.990");
      assert.equal(s.clics[0].funnel, "peleador");
      await s.ctx.close();
    });
  } finally {
    await browser.close();
  }
});

test("gracias: lee nombre, email y acceso de Hilvapay, limpia la barra de direcciones y arma «Entrar a mi plan»", { skip: sinChrome, timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: chrome });
  const acceso = "3f2b8c1e-5d4a-4b7e-9c1a-0e6f7a8b9c2d";
  const propio = "11111111-2222-4333-8444-555555555555";
  try {
    await conServidor(true, async (base) => {
      const s = await abrir(browser, base);
      const { p } = s;

      /* Como redirige Hilvapay: nombre, email, acceso, campaña y el fragmento #hp=. */
      await p.goto(`${base}/gracias/?acceso=${acceso}&nombre=Mart%C3%ADn&email=martin%40correo.com&utm_source=facebook&utm_campaign=camp1&fbclid=IwAR9#hp=TOKEN`);
      await p.waitForSelector("#entrar");
      assert.equal(await p.evaluate(() => location.search), `?acceso=${acceso}&utm_source=facebook&utm_campaign=camp1&fbclid=IwAR9`, "sin nombre ni email en la barra");
      assert.equal(await p.evaluate(() => location.hash), "", "sin el fragmento de sesión");
      assert.ok(!p.url().includes("martin"), "el mail no queda en la dirección");
      assert.match(await p.textContent("h1") ?? "", /Listo, Martín\. Tu BeastCamp está activado\./);
      assert.match(await p.textContent(".gracias") ?? "", /Te mandamos el acceso a martin@correo\.com\. Revisá también spam\./);
      assert.equal(await p.getAttribute("#entrar", "href"), `/app/${acceso}/`);
      assert.equal((await p.textContent("#entrar"))?.trim(), "Entrar a mi plan");
      assert.equal(await p.evaluate(() => localStorage.getItem("bc_app_ultimo")), acceso);
      const utm = await p.evaluate(() => JSON.parse(localStorage.getItem("bc_utm")!));
      assert.equal(utm.utm_source, "facebook"); assert.equal(utm.fbclid, "IwAR9"); assert.match(utm.fbc, /^fb\.1\.\d{13}\.IwAR9$/);
      assert.match(await p.textContent(".gracias") ?? "", /Garantía de devolución de 30 días\./);
      assert.equal(await p.locator("footer.ft").count(), 1, "pie legal");

      /* Recargar con la barra ya limpia mantiene el acceso y la campaña. */
      await p.reload(); await p.waitForSelector("#entrar");
      assert.equal(await p.getAttribute("#entrar", "href"), `/app/${acceso}/`);

      /* Sin acceso en la dirección: el que se creó al tocar «Ir al pago» (bc_acceso). */
      await p.evaluate((a) => { localStorage.removeItem("bc_app_ultimo"); localStorage.setItem("bc_acceso", a); }, propio);
      await p.goto(`${base}/gracias/`); await p.waitForSelector("#entrar");
      assert.equal(await p.getAttribute("#entrar", "href"), `/app/${propio}/`);
      assert.equal(await p.evaluate(() => localStorage.getItem("bc_app_ultimo")), propio);

      /* Un acceso que no es un UUID se ignora; sin ninguno, el botón lleva a la app sin acceso. */
      await p.goto(`${base}/gracias/?acceso=../../x`); await p.waitForSelector("#entrar");
      assert.equal(await p.getAttribute("#entrar", "href"), `/app/${propio}/`);
      await p.evaluate(() => localStorage.clear());
      await p.goto(`${base}/gracias/?acceso=../../x`); await p.waitForSelector("#entrar");
      assert.equal(await p.getAttribute("#entrar", "href"), "/app/");
      assert.equal(await p.evaluate(() => localStorage.getItem("bc_app_ultimo")), null);

      /* Lo que viene de la barra se muestra como texto, nunca como HTML. */
      await p.goto(`${base}/gracias/?acceso=${acceso}&nombre=${encodeURIComponent("<img src=x onerror=window.__xss=1>")}&email=${encodeURIComponent("a@b.co")}`);
      await p.waitForSelector("#entrar");
      assert.equal(await p.locator("#app img").count(), 0, "el nombre no se interpreta como HTML");
      assert.equal(await p.evaluate(() => (window as any).__xss), undefined);

      assert.deepEqual(s.errores, [], "errores de consola");
      assert.deepEqual(s.externos, [], "pedidos a sitios externos");
      await s.ctx.close();
    });
  } finally {
    await browser.close();
  }
});

test("videos (iOS): silenciados, en línea, con póster y precarga; el fondo del quiz y el de la oferta arrancan solos sin sonido", { skip: sinChrome, timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: chrome });
  try {
    await conServidor(false, async (base) => {
      const s = await abrir(browser, base);
      const { p } = s;
      const atributos = () => p.evaluate(() => Array.from(document.querySelectorAll("video"), (v) => ({
        src: v.getAttribute("src"), poster: v.getAttribute("poster"), muted: v.muted, mutedAttr: v.hasAttribute("muted"), inline: v.hasAttribute("playsinline"),
        webkit: v.hasAttribute("webkit-playsinline"), loop: v.loop, autoplay: v.autoplay, preload: v.preload, volumenAudible: !v.muted && v.volume > 0,
      })));
      for (const [ruta, src, poster] of [["/quiz/", "/media/hd/hook.mp4", "/media/hook.jpg"], ["/quiz-peso/", "/media/hd/hook.mp4", "/media/hook.jpg"], ["/oferta/", "/media/hd/oferta.mp4", "/media/oferta.jpg"], ["/oferta-peso/", "/media/hd/oferta.mp4", "/media/oferta.jpg"], ["/back1/", "/media/hd/oferta.mp4", "/media/oferta.jpg"]]) {   // los rescates de peso son cortos y no llevan video
        await p.goto(`${base}${ruta}`); await p.waitForSelector("video"); await p.waitForTimeout(300);
        const vs = await atributos();
        assert.ok(vs.length >= 1, `${ruta}: hay un video`);
        for (const v of vs) {
          assert.ok(v.muted && v.mutedAttr, `${ruta}: silenciado (propiedad y atributo)`);
          assert.ok(v.inline && v.webkit, `${ruta}: playsinline`);
          assert.ok(v.loop && v.autoplay, `${ruta}: loop y autoplay`);
          assert.equal(v.preload, "auto", `${ruta}: preload`);
          assert.equal(v.volumenAudible, false, `${ruta}: nunca con sonido`);
          assert.ok(v.poster, `${ruta}: póster`);
        }
        const visible = vs.find((v) => v.src?.endsWith(src.replace(/^.*\//, "")));
        assert.ok(visible, `${ruta}: usa ${src}`);
        assert.equal(visible.poster, poster, `${ruta}: póster ${poster}`);
        const imagenOk = await p.evaluate(async (u) => { const r = await fetch(u); return r.ok; }, poster);
        assert.ok(imagenOk, `${ruta}: el póster existe`);
      }
      assert.deepEqual(s.errores, []);
      await s.ctx.close();
    });
  } finally {
    await browser.close();
  }
});

/* ---------- Metadatos (no necesitan navegador) ---------- */
const PAGINAS = [
  { ruta: "quiz", url: "/quiz/", og: "og-quiz" }, { ruta: "oferta", url: "/oferta/", og: "og-quiz" }, { ruta: "back1", url: "/back1/", og: "og-quiz" }, { ruta: "back2", url: "/back2/", og: "og-quiz" },
  { ruta: "quiz-peso", url: "/quiz-peso/", og: "og-quiz-peso" }, { ruta: "oferta-peso", url: "/oferta-peso/", og: "og-quiz-peso" }, { ruta: "back1-peso", url: "/back1-peso/", og: "og-quiz-peso" }, { ruta: "back2-peso", url: "/back2-peso/", og: "og-quiz-peso" },
  { ruta: "gracias", url: "/gracias/", og: "og-quiz" }, { ruta: "legal/terminos", url: "/legal/terminos/", og: "og-quiz" }, { ruta: "legal/privacidad", url: "/legal/privacidad/", og: "og-quiz" },
  { ruta: "", url: "/", og: "og-quiz" },
];
const meta = (h: string, clave: string, valor: "name" | "property") => h.match(new RegExp(`<meta ${valor}="${clave}" content="([^"]*)">`))?.[1];

function revisarMetadatos(dir: string, absoluto: string) {
  const descripciones: string[] = [];
  for (const pg of PAGINAS) {
    const h = leer(`${dir}/${pg.ruta ? pg.ruta + "/" : ""}index.html`);
    const titulo = h.match(/<title>([^<]+)<\/title>/)?.[1];
    assert.ok(titulo, `${pg.url}: <title>`);
    assert.equal(meta(h, "og:title", "property"), titulo, `${pg.url}: og:title = title`);
    const d = meta(h, "description", "name");
    assert.ok(d && d.length >= 40 && d.length <= 300, `${pg.url}: meta description propia (${d?.length})`);
    descripciones.push(d);
    assert.equal(meta(h, "og:description", "property"), d, `${pg.url}: og:description`);
    assert.equal(meta(h, "og:type", "property"), "website");
    assert.equal(meta(h, "og:locale", "property"), "es_AR");
    assert.equal(meta(h, "og:image", "property"), `${absoluto}/img/${pg.og}.jpg`, `${pg.url}: og:image`);
    assert.equal(meta(h, "og:image:width", "property"), "1200");
    assert.equal(meta(h, "og:image:height", "property"), "630");
    assert.ok((meta(h, "og:image:alt", "property") ?? "").length > 10, `${pg.url}: og:image:alt`);
    assert.equal(meta(h, "twitter:card", "name"), "summary_large_image");
    assert.equal(meta(h, "theme-color", "name"), "#16A34A");
    assert.equal(meta(h, "robots", "name"), "noindex,nofollow,noarchive", `${pg.url}: sigue con noindex`);
    assert.equal(meta(h, "og:url", "property"), absoluto ? `${absoluto}${pg.url}` : undefined, `${pg.url}: og:url ${absoluto ? "absoluta" : "ausente sin sitioUrl"}`);
    assert.match(h, /<link rel="icon" href="\/img\/marca\/favicon\.svg" type="image\/svg\+xml">/);
    assert.match(h, /<link rel="icon" href="\/img\/marca\/favicon-32\.png" type="image\/png" sizes="32x32">/);
    assert.match(h, /<link rel="apple-touch-icon" href="\/img\/marca\/apple-touch-icon\.png">/);
  }
  assert.equal(new Set(descripciones).size, PAGINAS.length, "cada página tiene su propia descripción");
}

test("metadatos: título, descripción propia, Open Graph, twitter:card, theme-color e íconos en todas las páginas (rutas relativas sin sitioUrl)", () => {
  revisarMetadatos("prueba-quiz/sitio", "");
  for (const f of ["img/marca/favicon.svg", "img/marca/favicon-32.png", "img/marca/apple-touch-icon.png", "img/og-quiz.jpg", "img/og-quiz-peso.jpg"]) assert.ok(existsSync(`prueba-quiz/sitio/${f}`), `falta ${f}`);
  /* Los títulos de hoy no cambian. */
  const titulos: Record<string, string> = { quiz: "BeastCamp · Plan de shadowboxing en casa", oferta: "BeastCamp Sombra · Tu plan de 4 semanas", back1: "BeastCamp Sombra · 20% OFF", back2: "BeastCamp Sombra · 50% OFF final", "quiz-peso": "BeastCamp · Plan para bajar de peso en casa", "oferta-peso": "BeastCamp Sombra · Tu plan de 4 semanas", "back1-peso": "BeastCamp Sombra · 20% OFF", "back2-peso": "BeastCamp Sombra · 50% OFF final", gracias: "BeastCamp · Gracias", "legal/terminos": "BeastCamp · Términos y condiciones", "legal/privacidad": "BeastCamp · Política de privacidad", "": "BeastCamp" };
  for (const [ruta, t] of Object.entries(titulos)) assert.match(leer(`prueba-quiz/sitio/${ruta ? ruta + "/" : ""}index.html`), new RegExp(`<title>${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</title>`), ruta);
});

test("metadatos: con sitioUrl cargada las rutas de compartir salen absolutas y aparece og:url", () => {
  const tmp = mkdtempSync(join(tmpdir(), "bcmeta-"));
  try {
    mkdirSync(`${tmp}/prueba-quiz`, { recursive: true });
    cpSync("prueba-quiz/src", `${tmp}/prueba-quiz/src`, { recursive: true });
    cpSync("prueba-quiz/scripts", `${tmp}/prueba-quiz/scripts`, { recursive: true });
    const datos = leer(`${tmp}/prueba-quiz/src/datos.js`);
    assert.match(datos, /sitioUrl: ''/);
    writeFileSync(`${tmp}/prueba-quiz/src/datos.js`, datos.replace("sitioUrl: ''", "sitioUrl: 'https://sitio.test/'"));
    execFileSync(process.execPath, [`${tmp}/prueba-quiz/scripts/construir-quiz.mjs`], { stdio: "pipe" });
    revisarMetadatos(`${tmp}/prueba-quiz/sitio`, "https://sitio.test");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("robots.txt: lo arma el armado; bloquea a todos salvo a los bots de vista previa y de revisión de anuncios, y solo en las rutas del funnel", () => {
  const r = leer("prueba-quiz/sitio/robots.txt");
  const grupos = r.split(/\n\s*\n/).map((g) => g.split("\n").filter((l) => l && !l.startsWith("#"))).filter((g) => g.length);
  const todos = grupos.find((g) => g.includes("User-agent: *"))!;
  assert.deepEqual(todos, ["User-agent: *", "Disallow: /"]);
  const bots = grupos.find((g) => g.includes("User-agent: facebookexternalhit"))!;
  const agentes = bots.filter((l) => l.startsWith("User-agent: ")).map((l) => l.slice(12));
  assert.deepEqual(agentes, ["facebookexternalhit", "Facebot", "Twitterbot", "WhatsApp", "TelegramBot", "LinkedInBot", "Slackbot"]);
  assert.deepEqual(bots.filter((l) => l.startsWith("Allow: ")).map((l) => l.slice(7)), ["/quiz/", "/quiz-peso/", "/oferta/", "/oferta-peso/", "/back1/", "/back1-peso/", "/back2/", "/back2-peso/", "/img/", "/media/"]);
  assert.ok(bots.includes("Disallow: /"), "lo demás sigue bloqueado para ellos");
  assert.equal(grupos.length, 2);
});

test("legales: dicen lo que hace el sistema (qué se guarda, quién procesa, qué guarda el navegador, derechos, acceso personal, reembolso y ranking virtual)", () => {
  const pr = leer("prueba-quiz/sitio/legal/privacidad/index.html");
  for (const s of ["Hilvapay", "proveedor de envío de mails", "Meta Platforms", "SHA-256", "primer nombre", "dirección IP", "fbclid, fbc y fbp", "Registro de mails", "fecha de inicio", "ajustes de sonido, voz y vibración", "No hay un borrado automático", "mientras dure tu acceso", "30 días", "apodo", "nivel", "progreso", "link personal", "Ley 25.326", "no se envían a nuestros servidores", "No llevan nombre, mail ni ningún dato personal", "El responsable del tratamiento de los datos es el titular de BeastCamp", "escribinos por el mismo medio"]) assert.ok(pr.includes(s), `privacidad: falta «${s}»`);
  assert.doesNotMatch(pr, /ni los compartimos con terceros para publicidad/, "ya no es cierto: se avisa a Meta");
  const te = leer("prueba-quiz/sitio/legal/terminos/index.html");
  for (const s of ["link personal", "no lo compartas", "se da de baja", "disputa", "rivales virtuales", "Garantía de devolución de 30 días", "Hilvapay"]) assert.ok(te.includes(s), `términos: falta «${s}»`);
  /* Con responsable y contacto cargados se muestran. */
  const tmp = mkdtempSync(join(tmpdir(), "bclegal-"));
  try {
    mkdirSync(`${tmp}/prueba-quiz`, { recursive: true });
    cpSync("prueba-quiz/src", `${tmp}/prueba-quiz/src`, { recursive: true });
    cpSync("prueba-quiz/scripts", `${tmp}/prueba-quiz/scripts`, { recursive: true });
    const datos = leer(`${tmp}/prueba-quiz/src/datos.js`);
    writeFileSync(`${tmp}/prueba-quiz/src/datos.js`, datos.replace("responsable: ''", "responsable: 'Fulano S.A.'").replace("contacto: ''", "contacto: 'ayuda@sitio.test'"));
    execFileSync(process.execPath, [`${tmp}/prueba-quiz/scripts/construir-quiz.mjs`], { stdio: "pipe" });
    const conDatos = leer(`${tmp}/prueba-quiz/sitio/legal/privacidad/index.html`);
    assert.ok(conDatos.includes("<b>Fulano S.A.</b>") && conDatos.includes("escribinos a ayuda@sitio.test"));
    assert.ok(!conDatos.includes("titular de BeastCamp, que opera"));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
