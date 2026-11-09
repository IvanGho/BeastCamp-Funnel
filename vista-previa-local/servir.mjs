#!/usr/bin/env node
// Servidor de VISTA PREVIA, solo para la PC de Ivan (127.0.0.1). Sirve prueba-quiz/sitio/ y, si abrís cualquier página con ?vista=1,
// cambia el bloque de datos por el de datos-vista-previa.js (con cifras de relleno) para ver el diseño completo. ?vista=0 lo apaga.
// Nada de esto va al servidor: esta carpeta está fuera de prueba-quiz/ y el despliegue no la copia.
// Uso: node vista-previa-local/servir.mjs   →   http://localhost:4173/quiz/?vista=1
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { dirname, join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const sitio = join(aqui, "..", "prueba-quiz", "sitio");
const previa = readFileSync(join(aqui, "datos-vista-previa.js"), "utf8");
const TIPOS = { ".html": "text/html; charset=utf-8", ".mp4": "video/mp4", ".jpg": "image/jpeg", ".webp": "image/webp", ".png": "image/png", ".txt": "text/plain" };
const PUERTO = Number(process.env.PORT || 4173);

createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  let ruta = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, "");
  if (ruta.includes("..")) { res.writeHead(400); return res.end(); }
  let f = join(sitio, ruta);
  if (existsSync(f) && statSync(f).isDirectory()) {
    if (!url.pathname.endsWith("/")) { res.writeHead(301, { location: url.pathname + "/" + url.search }); return res.end(); }
    f = join(f, "index.html");
  }
  if (!existsSync(f)) { res.writeHead(404); return res.end("no encontrado"); }
  const cabeceras = { "content-type": TIPOS[extname(f)] || "application/octet-stream", "cache-control": "no-store" };
  const v = url.searchParams.get("vista");
  const cookie = /(?:^|; )vista=1/.test(req.headers.cookie || "");
  if (v === "1") cabeceras["set-cookie"] = "vista=1; Path=/; Max-Age=3600; SameSite=Lax";
  if (v === "0") cabeceras["set-cookie"] = "vista=; Path=/; Max-Age=0";
  let cuerpo = readFileSync(f);
  if (extname(f) === ".html" && (v === "1" || (cookie && v !== "0"))) {
    cuerpo = Buffer.from(cuerpo.toString("utf8").replace(/\/\*DATOS-INICIO\*\/[\s\S]*?\/\*DATOS-FIN\*\//, () => previa), "utf8");
  }
  // los envíos (/api/...) no existen acá: se responden 204 para poder probar el recorrido sin guardar nada
  res.writeHead(200, cabeceras);
  res.end(cuerpo);
}).listen(PUERTO, "127.0.0.1", () => console.log(`Vista previa en http://localhost:${PUERTO}/quiz/?vista=1`));
