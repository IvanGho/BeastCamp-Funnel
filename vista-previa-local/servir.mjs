#!/usr/bin/env node
// Servidor de VISTA PREVIA, solo para la PC de Ivan (127.0.0.1). Sirve prueba-quiz/sitio/ y, si abrís cualquier página con ?vista=1,
// cambia el bloque de datos por el de datos-vista-previa.js (con cifras de relleno) para ver el diseño completo. ?vista=0 lo apaga.
// Además sirve la app (/app/ y /app/<acceso>/) y monta el servicio real (prueba-quiz/api/server.mjs) para /api/*, con las mismas
// cabeceras de seguridad que nginx.conf (CSP incluida), leídas del archivo, para que los tests detecten violaciones de CSP.
// Los datos de la vista previa (compras simuladas, progreso) quedan en vista-previa-local/.datos (fuera del repo, ver .gitignore).
// Nada de esto va al servidor: esta carpeta está fuera de prueba-quiz/ y el despliegue no la copia.
// Uso: node vista-previa-local/servir.mjs   →   http://localhost:4173/quiz/?vista=1   (PORT cambia el puerto)
// Compra de prueba: node prueba-quiz/scripts/compra-local.mjs --funnel peso --nivel t2 --nombre Martín
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { dirname, join, extname, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const sitio = join(aqui, "..", "prueba-quiz", "sitio");
const TIPOS = {
  ".html": "text/html; charset=utf-8", ".mp4": "video/mp4", ".jpg": "image/jpeg", ".webp": "image/webp", ".png": "image/png", ".txt": "text/plain; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json", ".ico": "image/x-icon",
};
const ACCESO = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const RE_APP = new RegExp(`^/app/(${ACCESO})/$`);
const RE_APP_SIN_BARRA = new RegExp(`^/app/(${ACCESO})$`);
const RE_APP_MANIFEST = new RegExp(`^/app/${ACCESO}/manifest\\.webmanifest$`);

/** Cabeceras de seguridad de nginx.conf (las `add_header` del server), para mandar las mismas acá. */
export function cabecerasDeNginx() {
  const txt = readFileSync(join(aqui, "..", "prueba-quiz", "nginx.conf"), "utf8");
  const h = {};
  for (const m of txt.matchAll(/^\s*add_header\s+(\S+)\s+"([^"]*)"\s+always;/gm)) {
    if (/^strict-transport-security$/i.test(m[1])) continue; // HSTS no tiene sentido en http://localhost
    h[m[1].toLowerCase()] = m[2];
  }
  return h;
}

/**
 * Levanta la vista previa. `puerto` 0 = uno libre (tests). `servicio` es opcional: un objeto { manejar(req, res), cerrar() } (por defecto, el real
 * de prueba-quiz/api/server.mjs con el token de Hilvapay «local» y los mails a consola). `transformar(ruta, cuerpo)` (solo tests) puede
 * devolver otro cuerpo para un archivo estático, por ejemplo para simular un service worker nuevo.
 */
export async function iniciarVistaPrevia({ puerto = Number(process.env.PORT || 4173), dataDir = join(aqui, ".datos"), servicio = null, silencioso = false, transformar = null } = {}) {
  const previa = readFileSync(join(aqui, "datos-vista-previa.js"), "utf8");
  const seguridad = cabecerasDeNginx();
  let svc = servicio;
  let listo = null;

  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const p = url.pathname;
    if (p.startsWith("/api/") || p === "/salud") {
      if (svc) return svc.manejar(req, res).catch(() => { if (!res.headersSent) res.writeHead(500); res.end(); });
      res.writeHead(503, { "content-type": "application/json", ...seguridad });
      return res.end('{"error":"servicio no disponible"}');
    }
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405, seguridad); return res.end(); }
    if (RE_APP_SIN_BARRA.test(p)) { res.writeHead(301, { location: p + "/" + url.search, ...seguridad }); return res.end(); }
    let ruta = normalize(decodeURIComponent(p)).replace(/^[/\\]+/, "");
    if (ruta.includes("..")) { res.writeHead(400, seguridad); return res.end(); }
    // la app: la misma página (y el mismo manifest) para cualquier acceso
    if (RE_APP.test(p)) ruta = "app/index.html";
    else if (RE_APP_MANIFEST.test(p)) ruta = "app/manifest.webmanifest";
    let f = join(sitio, ruta);
    if (existsSync(f) && statSync(f).isDirectory()) {
      if (!p.endsWith("/")) { res.writeHead(301, { location: p + "/" + url.search, ...seguridad }); return res.end(); }
      f = join(f, "index.html");
    }
    if (!existsSync(f)) { res.writeHead(404, seguridad); return res.end("no encontrado"); }
    const cabeceras = { ...seguridad, "content-type": TIPOS[extname(f)] || "application/octet-stream", "cache-control": "no-store" };
    const v = url.searchParams.get("vista");
    const cookie = /(?:^|; )vista=1/.test(req.headers.cookie || "");
    if (v === "1") cabeceras["set-cookie"] = "vista=1; Path=/; Max-Age=3600; SameSite=Lax";
    if (v === "0") cabeceras["set-cookie"] = "vista=; Path=/; Max-Age=0";
    let cuerpo = readFileSync(f);
    if (extname(f) === ".html" && (v === "1" || (cookie && v !== "0"))) {
      cuerpo = Buffer.from(cuerpo.toString("utf8").replace(/\/\*DATOS-INICIO\*\/[\s\S]*?\/\*DATOS-FIN\*\//, () => previa), "utf8");
    }
    if (transformar) cuerpo = transformar(p, cuerpo) ?? cuerpo;
    res.writeHead(200, cabeceras);
    res.end(req.method === "HEAD" ? undefined : cuerpo);
  });

  await new Promise((ok, mal) => { server.once("error", mal); server.listen(puerto, "127.0.0.1", ok); });
  const puertoReal = server.address().port;
  const url = `http://localhost:${puertoReal}`;

  if (!svc) {
    try {
      const { crearServicio } = await import("../prueba-quiz/api/server.mjs");
      if (typeof crearServicio === "function") {
        svc = await crearServicio({ dataDir, env: { HILVAPAY_WEBHOOK_TOKEN: "local", MAIL_A_CONSOLA: "1", BASE_URL: url } });
      }
    } catch (e) {
      if (!silencioso) console.warn("El servicio (/api) no se pudo montar:", e && e.message);
    }
  }
  listo = true;
  return {
    server, puerto: puertoReal, url, servicio: svc,
    async cerrar() { const cerrado = new Promise((ok) => server.close(ok)); server.closeAllConnections?.(); await cerrado; if (svc && svc.cerrar) await svc.cerrar(); },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const v = await iniciarVistaPrevia();
  console.log(`Vista previa en ${v.url}/quiz/?vista=1`);
  console.log(`La app: ${v.url}/app/  (compra de prueba: node prueba-quiz/scripts/compra-local.mjs --funnel peso --nivel t2 --nombre Martín --puerto ${v.puerto})`);
  if (!v.servicio) console.log("Sin servicio: /api/* responde 503.");
}
