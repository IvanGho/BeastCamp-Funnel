// App del comprador, sin navegador: el manifest, los íconos y las capturas, la precarga del service worker, la CSP (nada de terceros ni de
// <script src>) y que el armado sea determinista y esté al día con prueba-quiz/src/app/.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { armarApp, tamanoPng } from "../prueba-quiz/scripts/construir-app.mjs";

const SITIO = "prueba-quiz/sitio";
const APP = join(SITIO, "app");
const leer = (f: string) => readFileSync(join(APP, f), "utf8");
const manifest = () => JSON.parse(leer("manifest.webmanifest"));
/** Ruta pública (/app/x, /img/y) → archivo en prueba-quiz/sitio. «/app/» es el index.html. */
const archivoDe = (u: string) => (u === "/app/" ? join(APP, "index.html") : join(SITIO, u.replace(/^\//, "")));

test("app: el manifest está completo y es válido", () => {
  const m = manifest();
  assert.equal(m.id, "/app/");
  assert.equal(m.start_url, "./");
  assert.equal(m.scope, "/app/");
  assert.equal(m.display, "standalone");
  assert.equal(m.orientation, "portrait");
  assert.equal(m.lang, "es-AR");
  assert.match(m.name, /BeastCamp/);
  assert.ok(m.short_name && m.short_name.length <= 12, "short_name corto");
  assert.ok(m.description && m.description.length > 20);
  assert.equal(m.theme_color, "#16A34A");
  assert.match(m.background_color, /^#[0-9a-fA-F]{6}$/);
  // íconos: 192, 512 y maskable 512 por separado (nunca «any maskable» en el mismo)
  const porSrc = Object.fromEntries(m.icons.map((i: { src: string }) => [i.src, i]));
  assert.deepEqual(Object.keys(porSrc).sort(), ["/img/marca/icono-192.png", "/img/marca/icono-512.png", "/img/marca/icono-maskable-512.png"]);
  assert.equal(porSrc["/img/marca/icono-192.png"].sizes, "192x192"); assert.equal(porSrc["/img/marca/icono-192.png"].purpose, "any");
  assert.equal(porSrc["/img/marca/icono-512.png"].sizes, "512x512"); assert.equal(porSrc["/img/marca/icono-512.png"].purpose, "any");
  assert.equal(porSrc["/img/marca/icono-maskable-512.png"].purpose, "maskable");
  assert.ok(m.icons.every((i: { type: string }) => i.type === "image/png"));
  // capturas reales de la app y accesos directos
  assert.ok(m.screenshots.length >= 3, `capturas: ${m.screenshots.length}`);
  for (const s of m.screenshots) {
    assert.equal(s.form_factor, "narrow");
    assert.equal(s.type, "image/png");
    assert.ok(s.label);
    assert.match(s.sizes, /^\d+x\d+$/);
    assert.ok(s.src.startsWith("/app/capturas/"));
  }
  assert.deepEqual(m.shortcuts.map((s: { name: string }) => s.name), ["Hoy", "Progreso"]);
  for (const s of m.shortcuts) { assert.ok(s.url.startsWith("./#/")); assert.ok(s.short_name && s.description); }
  // todo dentro del alcance o de /img/ y /app/
  assert.ok(JSON.stringify(m).indexOf("http") === -1, "el manifest no apunta a sitios de afuera");
});

test("app: los íconos y las capturas existen y miden lo que declara el manifest", () => {
  const m = manifest();
  for (const i of m.icons) {
    const f = archivoDe(i.src);
    assert.ok(existsSync(f), `falta ${i.src}`);
    const t = tamanoPng(readFileSync(f));
    assert.ok(t, `${i.src} no es un PNG`);
    assert.equal(`${t.ancho}x${t.alto}`, i.sizes, i.src);
  }
  for (const s of m.screenshots) {
    const f = archivoDe(s.src);
    assert.ok(existsSync(f), `falta ${s.src}`);
    const t = tamanoPng(readFileSync(f))!;
    assert.equal(`${t.ancho}x${t.alto}`, s.sizes, s.src);
    assert.ok(t.alto > t.ancho && t.alto / t.ancho <= 2.3, `${s.src}: proporción para pantallas angostas`);
    assert.ok(t.ancho >= 320 && t.alto <= 3840);
    assert.ok(statSync(f).size < 600_000, `${s.src} pesa demasiado`);
  }
  assert.deepEqual(readdirSync(join(APP, "capturas")).filter((f) => !f.endsWith(".png")), [], "en capturas/ solo hay PNG");
  assert.equal(readdirSync(join(APP, "capturas")).length, m.screenshots.length, "todas las capturas están en el manifest");
  for (const f of ["favicon.svg", "favicon-32.png", "apple-touch-icon.png"]) assert.ok(existsSync(join(SITIO, "img/marca", f)), f);
  assert.equal(tamanoPng(readFileSync(join(SITIO, "img/marca/apple-touch-icon.png")))?.ancho, 180);
});

test("app: la precarga del service worker apunta a archivos que existen", () => {
  const sw = leer("sw.js");
  assert.match(sw, /const VERSION = 'v[0-9a-f]{12}';/);
  assert.ok(!/__[A-Z]+__/.test(sw), "quedaron marcas sin reemplazar");
  const lista: string[] = JSON.parse(/const PRECARGA = (\[[\s\S]*?\]);/.exec(sw)![1]);
  assert.ok(lista.length >= 20);
  assert.equal(new Set(lista).size, lista.length, "sin duplicados");
  for (const u of ["/app/", "/app/offline.html", "/app/manifest.webmanifest", "/img/marca/icono-192.png", "/img/marca/icono-512.png", "/img/marca/apple-touch-icon.png"]) assert.ok(lista.includes(u), `falta ${u}`);
  for (const k of ["t1", "t2", "t3", "t4"]) assert.ok(lista.includes(`/img/muneco-${k}.webp`), `falta el muñeco ${k}`);
  for (const u of lista) assert.ok(existsSync(archivoDe(u)), `la precarga apunta a ${u} y no existe`);
  assert.ok(lista.every((u) => u.startsWith("/app/") || u.startsWith("/img/")), "solo cosas propias");
  assert.ok(!lista.some((u) => u.startsWith("/media/")), "/media/ no se guarda");
  // las reglas pedidas
  assert.match(sw, /PLAZO = 3000/);
  assert.match(sw, /req\.method !== 'GET'\) return/, "nunca toca PUT ni POST");
  assert.match(sw, /'actualizar'/);
  assert.ok(!/skipWaiting\(\)\s*[;}]\s*\)\s*;?\s*$/m.test(sw.split("self.addEventListener('install'")[1]!.split("self.addEventListener('activate'")[0]), "no hay skipWaiting en el install");
  assert.ok(/bc-app-/.test(sw) && /caches\.delete/.test(sw), "limpia las cachés viejas");
  assert.ok(!/206/.test(sw.replace(/\/\*[\s\S]*?\*\//g, "")), "no cachea respuestas 206");
});

test("app: no hay URLs de terceros, <script src> ni eval en ninguna página de la app", () => {
  for (const f of ["index.html", "offline.html", "sw.js", "manifest.webmanifest"]) {
    const t = leer(f);
    assert.ok(!/https?:\/\//i.test(t), `${f}: URL absoluta (¿de terceros?)`);
    assert.ok(!/<script[^>]+\bsrc\s*=/i.test(t), `${f}: <script src>`);
    assert.ok(!/<link[^>]+rel=["']?stylesheet/i.test(t), `${f}: hoja de estilos externa`);
    assert.ok(!/@import|url\(\s*["']?(?:https?:)?\/\//i.test(t), `${f}: CSS que importa algo de afuera`);
    assert.ok(!/\beval\s*\(|new Function\s*\(|\bFunction\s*\(\s*["'`]/.test(t), `${f}: eval o new Function`);
    assert.ok(!/importScripts|\bimport\s*\(/.test(t), `${f}: carga de código externo`);
    assert.ok(!/\p{Extended_Pictographic}/u.test(t), `${f}: emojis`);
    assert.ok(!/próximamente|lorem|ipsum/i.test(t), `${f}: texto de relleno`);
  }
  const html = leer("index.html");
  for (const m of html.split("<script>")[0].matchAll(/<(?:link|img|a)\b[^>]*?\b(?:href|src)="([^"]*)"/g)) assert.ok(m[1].startsWith("/") || m[1].startsWith("#") || m[1] === "manifest.webmanifest" || m[1].startsWith("mailto:") || m[1] === "", `enlace raro: ${m[1]}`);
  // el único fetch propio del código es a /api/ (connect-src 'self')
  const fetchs = [...html.matchAll(/fetch\(([^,)]*)/g)].map((m) => m[1]);
  assert.ok(fetchs.every((x) => /^`?\$\{|ruta|\/api\//.test(x.trim().replace(/^[`'"]/, ""))), `fetch sospechoso: ${fetchs.join(" | ")}`);
});

test("app: el index.html tiene el manifest, los íconos de iOS y el CSS del quiz tal cual", () => {
  const html = leer("index.html");
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/, "relativo: sirve para /app/ y para /app/<acceso>/");
  assert.match(html, /<link rel="apple-touch-icon" href="\/img\/marca\/apple-touch-icon\.png">/);
  assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /name="apple-mobile-web-app-title" content="BeastCamp"/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /name="theme-color" content="#16A34A"/);
  assert.match(html, /<html lang="es-AR">/);
  assert.ok(html.includes(readFileSync("prueba-quiz/src/base.css", "utf8")), "base.css va incluido sin cambios");
  assert.ok(html.includes("/*DATOS-INICIO*/") && html.includes("DATOS.contacto"), "usa DATOS de datos.js (contacto)");
  assert.ok(html.includes("env(safe-area-inset-bottom"), "respeta el notch y la barra del sistema");
  assert.ok(html.includes("prefers-reduced-motion"));
});

test("app: la app no incluye el plan: le llega por la API", () => {
  const html = leer("index.html");
  const plan = readFileSync("prueba-quiz/contenido/semanas-peso.mjs", "utf8");
  const titulo = /titulo:\s*"([^"]{20,})"/.exec(plan)?.[1] ?? "Postura, pies y tus dos primeros golpes";
  assert.ok(!html.includes(titulo), "los títulos del plan no están dentro de la app");
  assert.ok(!html.includes("contenido/plan"), "la app no importa el plan");
  assert.ok(html.includes("/api/app/"));
});

test("app: el armado es determinista y está al día con prueba-quiz/src/app/", () => {
  const a = armarApp(), b = armarApp();
  const hash = (o: Record<string, unknown>) => createHash("sha256").update(JSON.stringify(Object.entries(o).filter(([k]) => k !== "_precarga"))).digest("hex");
  assert.equal(hash(a), hash(b), "dos armados seguidos dan los mismos bytes");
  for (const f of ["index.html", "sw.js", "manifest.webmanifest", "offline.html"]) assert.equal(leer(f), (a as Record<string, string>)[f], `${f} está desactualizado: correr node prueba-quiz/scripts/construir-app.mjs`);
  // la versión sale del contenido: si cambia el shell, cambia la versión
  const v = (s: string) => /VERSION = '(v[0-9a-f]{12})'/.exec(s)![1];
  assert.equal(v(a["sw.js"] as string), v(b["sw.js"] as string));
  assert.equal(v(leer("sw.js")), v(a["sw.js"] as string));
  assert.notEqual(v((a["sw.js"] as string)), createHash("sha256").update("otra cosa").digest("hex").slice(0, 12));
});
