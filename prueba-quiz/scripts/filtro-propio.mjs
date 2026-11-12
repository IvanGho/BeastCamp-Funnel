// Deja en cada dominio solo las imágenes de su producto: borra las que usa únicamente el quiz del otro funnel.
// Una imagen es «del otro» si su clave (p. ej. m_golpes) aparece en el código del otro quiz y en ningún lugar compartido (app, plan, ofertas, comunes) ni en el propio.
import { readFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const leerDir = (d) => (existsSync(d) ? readdirSync(d, { recursive: true }).filter((f) => /\.(js|mjs|css|html)$/.test(String(f))).map((f) => readFileSync(join(d, String(f)), "utf8")).join("\n") : "");

export function filtrarPropio(raiz, salida, id) {
  const src = join(raiz, "src");
  const propio = id === "shadowboxing" ? "peso" : "quiz";
  const quizPeso = leerDir(join(src, "peso")), quizPel = readFileSync(join(src, "quiz.js"), "utf8");
  const compartido = [leerDir(join(src, "app")), leerDir(join(raiz, "contenido")), readFileSync(join(src, "comun.js"), "utf8"), readFileSync(join(src, "oferta.js"), "utf8"), readFileSync(join(src, "gracias.js"), "utf8"), readFileSync(join(src, "ilustraciones.js"), "utf8")].join("\n");
  const del = id === "shadowboxing" ? quizPel : quizPeso;                 // código del otro funnel
  const mio = id === "shadowboxing" ? quizPeso : quizPel;
  const usa = (txt, k) => new RegExp(`['"\`/]${k}(@2x)?['"\`.]`).test(txt);
  const borradas = [];
  for (const f of readdirSync(join(salida, "img"))) {
    const m = f.match(/^muneco-(.+?)(@2x)?\.webp$/);
    if (!m) continue;
    const k = m[1];
    if (usa(del, k) && !usa(mio, k) && !usa(compartido, k)) { rmSync(join(salida, "img", f)); borradas.push(f); }
  }
  // Imagen para compartir y foto de la slide de publicación: solo la de este producto.
  const og = id === "shadowboxing" ? "og-quiz.jpg" : "og-quiz-peso.jpg";
  if (existsSync(join(salida, "img", og))) { rmSync(join(salida, "img", og)); borradas.push(og); }
  if (id !== "shadowboxing" && existsSync(join(salida, "media", "publicacion.jpg"))) { rmSync(join(salida, "media", "publicacion.jpg")); borradas.push("publicacion.jpg"); }
  return borradas;
}
