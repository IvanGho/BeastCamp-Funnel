#!/usr/bin/env node
// Arma el sitio de cada dominio (camp y shadowboxing) en prueba-quiz/despliegue/<id>/, listo para copiar a la VPS.
// Cada uno lleva SOLO su funnel (quiz, ofertas), la página de gracias, los legales y su propia app (PWA), más img/ y media/.
// Uso: node prueba-quiz/scripts/armar-dominios.mjs [camp|shadowboxing] [carpeta-de-salida]   (sin argumentos arma los dos)
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { VARIANTES } from "./variantes.mjs";

const aca = dirname(fileURLToPath(import.meta.url));
const raiz = join(aca, "..");

export function armarDominio(id, salida = join(raiz, "despliegue", id)) {
  if (!VARIANTES[id]) throw new Error(`Dominio desconocido: ${id}`);
  salida = resolve(salida);
  rmSync(salida, { recursive: true, force: true });
  mkdirSync(salida, { recursive: true });
  const env = { ...process.env, BC_VARIANTE: id, BC_DESTINO: salida };
  for (const s of ["construir-quiz.mjs", "construir-app.mjs"]) {
    const r = spawnSync(process.execPath, [join(aca, s)], { env, encoding: "utf8" });
    if (r.status !== 0) throw new Error(`${s} falló para ${id}:\n${r.stderr || r.stdout}`);
  }
  // Lo que no se arma: imágenes, videos y las capturas de la app.
  for (const d of ["img", "media"]) cpSync(join(raiz, "sitio", d), join(salida, d), { recursive: true });
  if (existsSync(join(raiz, "sitio", "app", "capturas"))) cpSync(join(raiz, "sitio", "app", "capturas"), join(salida, "app", "capturas"), { recursive: true });
  return salida;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ids = process.argv[2] ? [process.argv[2]] : Object.keys(VARIANTES);
  for (const id of ids) console.log(`${id}: ${armarDominio(id, process.argv[3])}`);
}
