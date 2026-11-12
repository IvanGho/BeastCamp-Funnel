// Cada dominio (camp = peleadores, shadowboxing = bajar de peso) sale con SOLO su funnel y su propia app (PWA).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-ignore: módulo .mjs sin tipos
import { armarDominio } from "../prueba-quiz/scripts/armar-dominios.mjs";

const PEL = ["quiz", "oferta", "back1", "back2"], PESO = ["quiz-peso", "oferta-peso", "back1-peso", "back2-peso"];
const armar = (id: string) => { const d = mkdtempSync(join(tmpdir(), `bc-${id}-`)); armarDominio(id, d); return d; };
const leer = (d: string, f: string) => readFileSync(join(d, f), "utf8");

for (const [id, dominio, suyas, ajenas, inicio, nombre] of [
  ["camp", "camp.infinixapp.com", PEL, PESO, "/quiz/", "BeastCamp: shadowboxing para peleadores"],
  ["shadowboxing", "shadowboxing.infinixapp.com", PESO, PEL, "/quiz-peso/", "Shadowboxing: bajá de peso en casa"],
] as const) {
  test(`dominio ${id}: solo su funnel, su raíz, su og:url, sus legales y su app`, () => {
    const d = armar(id);
    try {
      for (const p of suyas) assert.ok(existsSync(join(d, p, "index.html")), `falta ${p}`);
      for (const p of ajenas) assert.ok(!existsSync(join(d, p)), `sobra ${p}`);
      for (const f of ["gracias/index.html", "legal/terminos/index.html", "legal/privacidad/index.html", "app/index.html", "app/sw.js", "app/manifest.webmanifest", "app/offline.html", "robots.txt", "media/nestor-medina.jpg", "media/hd/hook.mp4"]) assert.ok(existsSync(join(d, f)), `falta ${f}`);
      // raíz y «Volver» de los legales llevan al quiz de este dominio
      assert.match(leer(d, "index.html"), new RegExp(`url=${inicio}"`));
      assert.match(leer(d, "legal/terminos/index.html"), new RegExp(`<a href="${inicio}">← Volver`));
      assert.match(leer(d, "quiz" + (id === "camp" ? "" : "-peso") + "/index.html"), new RegExp(`og:url" content="https://${dominio.replace(/\./g, "\.")}${inicio}"`));
      // robots: solo las rutas del funnel propio
      const robots = leer(d, "robots.txt");
      for (const p of suyas) assert.ok(robots.includes(`Allow: /${p}/`));
      for (const p of ajenas) assert.ok(!robots.includes(`/${p}/`));
      // ninguna página enlaza ni redirige al funnel del otro dominio
      for (const f of [...suyas.map((p) => `${p}/index.html`), "index.html", "gracias/index.html"]) {
        const html = leer(d, f);
        for (const p of ajenas) assert.ok(!html.includes(`"/${p}/`) && !html.includes(`'/${p}/`), `${f} enlaza a /${p}/`);
      }
      // la app (PWA) es de este funnel
      const m = JSON.parse(leer(d, "app/manifest.webmanifest"));
      assert.equal(m.name, nombre); assert.equal(m.scope, "/app/"); assert.equal(m.display, "standalone");
      assert.ok(leer(d, "app/index.html").includes(`<title>${m.short_name}</title>`));
      // política de privacidad: solo el quiz de este funnel
      const priv = leer(d, "legal/privacidad/index.html");
      assert.equal(priv.includes("Quiz de peleadores:"), id === "camp"); assert.equal(priv.includes("Quiz de bajar de peso:"), id === "shadowboxing");
      // nada del otro producto: ni en la privacidad ni en el texto de la app; la foto de la publicación solo en shadowboxing
      assert.ok(!priv.includes("peleadores o bajar de peso"));
      const appJs = leer(d, "app/index.html");
      assert.equal(appJs.includes("Shadowboxing en casa para entrenar como peleador"), id === "camp");
      assert.equal(appJs.includes("Bajar de peso con shadowboxing en casa"), id === "shadowboxing");
      assert.equal(existsSync(join(d, "media/publicacion.jpg")), id === "shadowboxing");
      // en compu el quiz es una columna centrada como en el celular (sin pantalla partida)
      const quiz = leer(d, suyas[0] + "/index.html");
      assert.ok(!quiz.includes("min-width:900px") && quiz.includes(".shell{max-width:480px;margin-left:auto;margin-right:auto}"));
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
}

test("dominios: las dos apps tienen nombre, descripción y versión de service worker distintos; armar dos veces da los mismos bytes", () => {
  const a = armar("camp"), b = armar("shadowboxing"), a2 = armar("camp");
  try {
    const ma = JSON.parse(leer(a, "app/manifest.webmanifest")), mb = JSON.parse(leer(b, "app/manifest.webmanifest"));
    assert.notEqual(ma.name, mb.name); assert.notEqual(ma.short_name, mb.short_name); assert.notEqual(ma.description, mb.description);
    assert.notEqual(leer(a, "app/sw.js"), leer(b, "app/sw.js"));
    for (const f of ["app/index.html", "app/sw.js", "app/manifest.webmanifest", "quiz/index.html", "index.html"]) assert.equal(leer(a, f), leer(a2, f), f);
  } finally { for (const d of [a, b, a2]) rmSync(d, { recursive: true, force: true }); }
});
