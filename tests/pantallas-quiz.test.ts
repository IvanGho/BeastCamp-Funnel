// Recorre el quiz en un navegador real en varios tamaños de ventana y comprueba, en CADA pantalla:
//  - que no haya scroll vertical (todas las opciones se ven de entrada),
//  - que ningún elemento grande tenga fondo negro u oscuro,
//  - que no haya errores de consola ni pedidos a sitios externos.
// Necesita Chrome o Edge instalado (variable CHROME_PATH para cambiar la ruta). Si no lo encuentra, el test se saltea.
// Con CAPTURAS_DIR=carpeta guarda una captura por pantalla y por tamaño.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync, mkdirSync } from "node:fs";
import { extname, join } from "node:path";
import { test } from "node:test";
import { chromium, type Page } from "playwright-core";

const CHROMES = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/opt/pw-browsers/chromium"].filter(Boolean) as string[];
const chrome = CHROMES.find((c) => existsSync(c));
const TIPOS: Record<string, string> = { ".html": "text/html; charset=utf-8", ".mp4": "video/mp4", ".jpg": "image/jpeg", ".webp": "image/webp", ".txt": "text/plain" };
const TAMANOS = [[1366, 620], [1280, 600], [1920, 1080], [390, 844], [360, 640]] as const;

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

async function medir(p: Page, nombre: string, hallazgos: Hallazgo[], captura: (n: string) => Promise<void>) {
  await p.waitForTimeout(450);
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
    return { exceso, oscuros };
  });
  if (r.exceso > 1) hallazgos.push({ pantalla: nombre, problema: `scroll vertical de ${r.exceso}px` });
  if (r.oscuros.length) hallazgos.push({ pantalla: nombre, problema: `fondo oscuro grande: ${r.oscuros.join(", ")}` });
  await captura(nombre);
}

async function recorrer(browser: Awaited<ReturnType<typeof chromium.launch>>, base: string, ancho: number, alto: number, vista: boolean, dirCapturas?: string) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, isMobile: ancho < 500, hasTouch: ancho < 500 });
  const p = await ctx.newPage();
  const hallazgos: Hallazgo[] = [];
  const errores: string[] = [];
  const externos: string[] = [];
  p.on("pageerror", (e) => errores.push(String(e)));
  p.on("console", (m) => { if (m.type() === "error" && !/404|favicon/.test(m.text())) errores.push(m.text()); });
  p.on("request", (r) => { if (!r.url().startsWith(base) && !r.url().startsWith("data:")) externos.push(r.url()); });
  await p.route("**/api/*", (r) => r.fulfill({ status: 204 }));
  let n = 0;
  const captura = async (nombre: string) => { if (dirCapturas) { mkdirSync(dirCapturas, { recursive: true }); await p.screenshot({ path: `${dirCapturas}/${ancho}x${alto}-${vista ? "vp" : "prod"}-${String(++n).padStart(2, "0")}-${nombre.replace(/\W+/g, "-")}.png` }); } };
  const m = (nombre: string) => medir(p, nombre, hallazgos, captura);
  const clic = async (sel: string) => { await p.click(sel); await p.waitForTimeout(520); };

  await p.goto(`${base}/quiz/`);
  await m("hook");
  await clic(".c >> nth=0"); await m("nivel");
  await clic(".c >> nth=1"); await m("objetivo");
  await clic(".c >> nth=0"); await m("entrenar-mal");
  await clic("#seguir");
  if (await p.$("#seguir2")) { await m("noticia"); await clic("#seguir"); }
  await m("multiple");
  await p.click(".c >> nth=0"); await p.click(".c >> nth=4"); await clic("#seguir");
  await m("lugar"); await clic(".c >> nth=0");
  await m("tiempo"); await clic(".c >> nth=2");
  await m("precio"); await clic(".c >> nth=1");
  await m("experto"); await clic("#seguir");
  await m("mail");
  await p.fill("#nm", "Prueba"); await p.fill("#m", "prueba@correo.com"); await clic("#seguir");
  await p.waitForSelector(".velo", { timeout: 20000 }); await m("carga-pop1"); await p.click(".velo button >> nth=0");
  await p.waitForSelector(".velo", { timeout: 20000 }); await m("carga-pop2"); await p.click(".velo button >> nth=0");
  await p.waitForSelector("#ver", { timeout: 20000 }); await m("perfil"); await p.click("#ver");
  await p.waitForURL("**/oferta/**"); await p.waitForTimeout(600);
  await captura("oferta");
  await p.screenshot({ path: dirCapturas ? `${dirCapturas}/${ancho}x${alto}-${vista ? "vp" : "prod"}-oferta-completa.png` : undefined, fullPage: true }).catch(() => {});
  await ctx.close();
  return { hallazgos, errores, externos };
}

test("quiz: en cada pantalla y en 5 tamaños de ventana no hay scroll vertical ni fondos oscuros grandes", { skip: chrome ? false : "no hay Chrome/Edge instalado", timeout: 240000 }, async () => {
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
        });
      } finally {
        srv.close();
      }
    }
  } finally {
    await browser.close();
  }
});
