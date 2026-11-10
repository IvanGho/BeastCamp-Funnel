#!/usr/bin/env node
// Arma la app del comprador (PWA) a partir de prueba-quiz/src/app/ y la escribe SOLO en prueba-quiz/sitio/app/:
//   index.html (CSS y JS en línea: lo exige la CSP), sw.js, manifest.webmanifest y offline.html. Las capturas (capturas/*.png) las genera
//   el test de pantallas con CAPTURAS_APP=1 y acá solo se leen para declararlas en el manifest.
// Es determinista: dos armados seguidos dan los mismos bytes. La versión del service worker es un hash del contenido (shell, manifest y precarga).
// Uso: node prueba-quiz/scripts/construir-app.mjs   (desde la raíz del repo)
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (f) => readFileSync(join(raiz, "src", f), "utf8");
const app = (f) => readFileSync(join(raiz, "src", "app", f), "utf8");
export const DESTINO = join(raiz, "sitio", "app");

const JS = ["nucleo.js", "ui.js", "estado.js", "pantallas.js", "reproductor.js", "app.js"];
const ORDEN_CAPTURAS = { hoy: ["Tu sesión de hoy", 1], sesion: ["La sesión con timer", 2], progreso: ["Racha y ranking", 3], plan: ["Tu plan de 4 semanas", 4] };
const ICONOS = [["/img/marca/icono-192.png", "192x192", "any"], ["/img/marca/icono-512.png", "512x512", "any"], ["/img/marca/icono-maskable-512.png", "512x512", "maskable"]];
const sha = (...partes) => { const h = createHash("sha256"); partes.forEach((p) => h.update(p)); return h.digest("hex"); };

/* Tamaño de un PNG (cabecera IHDR). */
export function tamanoPng(buf) {
  if (buf.length < 24 || buf.toString("latin1", 1, 4) !== "PNG") return null;
  return { ancho: buf.readUInt32BE(16), alto: buf.readUInt32BE(20) };
}

/* Lo que se escribe en sitio/app/: { nombre: contenido }. No toca el disco (salvo leer src/ y las capturas). */
export function armarApp() {
  const css = src("base.css") + "\n" + app("app.css");
  // De datos.js la app solo usa el contacto y los días de garantía: se copian esos dos (con las mismas marcas que usa la vista previa para
  // cambiar el bloque). Así no viajan a la app la noticia, el especialista ni los precios.
  const datosFull = new Function(`${src("datos.js")}; return DATOS;`)();
  const datosTxt = `/*DATOS-INICIO*/\nconst DATOS = ${JSON.stringify({ contacto: datosFull.contacto, garantiaDias: datosFull.garantiaDias })};\n/*DATOS-FIN*/`;
  const nucleo = new Function(`${app("nucleo.js")}; return NUCLEO;`)();
  const js = [datosTxt, ...JS.map(app)].join("\n");
  new Function(js);                                  // revisa la sintaxis (no se ejecuta)
  if (/<\/script/i.test(js)) throw new Error("El JS de la app no puede contener </script");

  const html = `<!doctype html><html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#16A34A"><meta name="color-scheme" content="light"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="default"><meta name="apple-mobile-web-app-title" content="BeastCamp"><meta name="format-detection" content="telephone=no"><title>BeastCamp</title>
<link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="/img/marca/favicon.svg" type="image/svg+xml"><link rel="icon" href="/img/marca/favicon-32.png" sizes="32x32" type="image/png"><link rel="apple-touch-icon" href="/img/marca/apple-touch-icon.png">
<style>${css}</style></head>
<body><div id="aviso"></div><main id="vista" class="ap"><section class="msg carga" role="status" aria-label="Cargando"><div class="msg-im"><img class="im3d" src="/img/muneco-m_golpes.webp" alt="" width="360" height="480"></div><div class="sk"></div><div class="sk sk2"></div><p class="sub">Preparando tu plan</p></section></main><nav id="nav" class="nav" aria-label="Secciones" hidden></nav><div id="anuncio" class="sr" role="status" aria-live="polite"></div><noscript><p style="padding:24px;text-align:center">Para usar BeastCamp activá JavaScript en tu navegador.</p></noscript>
<script>
${js}
</script></body></html>
`;
  const offline = app("offline.html").replace("/*CSS*/", () => css);

  const capDir = join(DESTINO, "capturas");
  const caps = (existsSync(capDir) ? readdirSync(capDir).filter((f) => f.endsWith(".png")) : []).sort((a, b) => ((ORDEN_CAPTURAS[a.slice(0, -4)] || [0, 99])[1] - (ORDEN_CAPTURAS[b.slice(0, -4)] || [0, 99])[1]) || (a < b ? -1 : 1));
  const screenshots = caps.map((f) => {
    const t = tamanoPng(readFileSync(join(capDir, f)));
    return { src: `/app/capturas/${f}`, sizes: `${t.ancho}x${t.alto}`, type: "image/png", form_factor: "narrow", label: (ORDEN_CAPTURAS[f.slice(0, -4)] || [f.slice(0, -4)])[0] };
  });
  const manifest = JSON.stringify({
    id: "/app/", name: "BeastCamp: shadowboxing en casa", short_name: "BeastCamp",
    description: "Tu plan de 4 semanas de shadowboxing en casa: sesiones con timer, drills, racha y ranking.",
    start_url: "./", scope: "/app/", display: "standalone", orientation: "portrait", lang: "es-AR", dir: "ltr",
    theme_color: "#16A34A", background_color: "#ffffff", categories: ["health", "fitness", "sports"],
    icons: ICONOS.map(([s, z, p]) => ({ src: s, sizes: z, type: "image/png", purpose: p })),
    screenshots,
    shortcuts: [["Hoy", "Tu sesión de hoy", "./#/hoy"], ["Progreso", "Tu racha y tus puntos", "./#/progreso"]].map(([name, description, url]) => ({ name, short_name: name, description, url, icons: [{ src: "/img/marca/icono-192.png", sizes: "192x192", type: "image/png" }] })),
  }, null, 2) + "\n";

  const precarga = ["/app/", "/app/offline.html", "/app/manifest.webmanifest", "/img/marca/icono-192.png", "/img/marca/icono-512.png", "/img/marca/apple-touch-icon.png", "/img/marca/favicon.svg", ...nucleo.MUNECOS_APP.map((k) => `/img/muneco-${k}.webp`)];
  const imgs = precarga.filter((u) => u.startsWith("/img/")).map((u) => { const f = join(raiz, "sitio", u); return u + ":" + (existsSync(f) ? sha(readFileSync(f)) : "falta"); });
  const plantilla = app("sw.js");
  const version = "v" + sha(html, offline, manifest, plantilla, JSON.stringify(precarga), imgs.join("|")).slice(0, 12);
  const sw = plantilla.replace("__VERSION__", () => version).replace("__PRECARGA__", () => JSON.stringify(precarga, null, 2));
  return { "index.html": html, "sw.js": sw, "manifest.webmanifest": manifest, "offline.html": offline, _precarga: precarga };
}

export function escribirApp() {
  const { _precarga, ...archivos } = armarApp();
  mkdirSync(DESTINO, { recursive: true });
  for (const [n, c] of Object.entries(archivos)) writeFileSync(join(DESTINO, n), c);
  return Object.keys(archivos);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = escribirApp();
  console.log(`App armada en prueba-quiz/sitio/app/: ${n.join(", ")}`);
}
