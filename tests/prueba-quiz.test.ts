// La página de PRUEBA del quiz (prueba-quiz/) es estática y no puede guardar datos, cobrar ni indexarse.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";

const leer = (r: string) => readFileSync(r, "utf8");
const PAGINAS = ["quiz", "oferta", "back1", "back2", "gracias", "legal/terminos", "legal/privacidad"];
const paginas: Record<string, string> = Object.fromEntries(PAGINAS.map((p) => [p, leer(`prueba-quiz/sitio/${p}/index.html`)]));
const raiz = leer("prueba-quiz/sitio/index.html");
const todas = [...Object.values(paginas), raiz];
const html = paginas["quiz"] + paginas["oferta"] + paginas["back1"] + paginas["back2"];

test("quiz: noindex en todas las páginas, robots.txt y cabecera de nginx", () => {
  for (const h of todas) assert.match(h, /<meta name="robots" content="noindex,nofollow,noarchive">/);
  assert.match(leer("prueba-quiz/sitio/robots.txt"), /Disallow: \//);
  assert.match(leer("prueba-quiz/nginx.conf"), /X-Robots-Tag "noindex, nofollow, noarchive" always/);
});

test("quiz: rutas /quiz, /oferta, /back1, /back2, /gracias y legales; los rescates se llaman back1 y back2", () => {
  for (const p of PAGINAS) assert.ok(existsSync(`prueba-quiz/sitio/${p}/index.html`), p);
  assert.match(paginas["oferta"], /siguiente: '\/back1\/'/);
  assert.match(paginas["back1"], /siguiente: '\/back2\/'/);
  assert.match(paginas["quiz"], /location\.href = '\/oferta\/'/);
  assert.doesNotMatch(todas.join("\n"), /rescate-1|rescate-2|\/downsell/);
});

test("quiz: solo envía mail y clic a /api/lead y /api/click; sin terceros, sin encuesta y con un único punto de pago vacío", () => {
  assert.doesNotMatch(html, /fetch\(|XMLHttpRequest|WebSocket|<form|navigator\.share|alert\(/);
  assert.doesNotMatch(html, /mercadopago|mercado pago|paypal|stripe/i);
  const externas = new Set(todas.flatMap((h) => h.match(/https?:\/\/[^"'\s<)]+/g) ?? []));
  assert.deepEqual([...externas].sort(), ["https://www.mdpi.com/2075-4663/14/1/5"], "solo el enlace al estudio citado");
  assert.deepEqual([...paginas["quiz"].matchAll(/sendBeacon\('([^']*)'/g)].map((m) => m[1]), ["/api/"]);
  assert.match(paginas["quiz"], /if \(k !== 'lead' && k !== 'click'\) return/);
  assert.doesNotMatch(html, /feedback|Lo comprarías|Qué cambiarías|encuesta/i);
  assert.equal((paginas["oferta"].match(/pagoUrl: \{ base: '', b1: '', b2: '' \}/g) ?? []).length, 1, "un solo lugar para los links de pago (uno por precio), vacíos hasta que exista el checkout");
  assert.match(paginas["oferta"], /Todavía no abrimos el pago/);
});

test("quiz: sin marcas de prueba, sin emojis y garantía de 30 días en todo", () => {
  assert.doesNotMatch(todas.join("\n"), /PÁGINA DE PRUEBA|MAQUETA|\(ejemplo\)|datos de ejemplo|Simular que se va|Nombre del medio|Cupos tomados/);
  for (const h of todas) assert.doesNotMatch(h, /\p{Extended_Pictographic}/u, "sin emojis");
  assert.match(paginas["oferta"], /garantiaDias: 30/);
  assert.doesNotMatch(html, /10 días|diez días/i);
  assert.match(paginas["legal/terminos"], /30 días/);
  assert.match(paginas["oferta"], /Rutinas probadas por profesionales, semiprofesionales y amateurs/);
  assert.doesNotMatch(todas.join("\n"), /Beast Camp/, "nombre público BeastCamp");
});

test("quiz: los datos reales viven en un solo archivo y están vacíos o con lo verificado (Juan Medina solo con nombre y título)", () => {
  const D = new Function(`${leer("prueba-quiz/src/datos.js")}; return DATOS;`)();
  assert.equal(D.personas, "");
  assert.equal(D.diagnosticos, "");
  assert.equal(D.estrellas, "");
  assert.deepEqual(D.testimonios, []);
  assert.deepEqual(D.especialista, { nombre: "Juan Medina", titulo: "Médico deportista", foto: "", matricula: "", universidad: "", posgrados: [], resumen: "" });
  assert.deepEqual(D.pagoUrl, { base: "", b1: "", b2: "" }, "un link de pago por precio, vacíos hasta que exista el checkout");
  assert.equal(D.appUrl, "/app/");
  assert.equal(D.sitioUrl, "", "vacío = etiquetas para compartir con rutas relativas");
  assert.equal(D.responsable, "");
  assert.equal(D.garantiaDias, 30);
  assert.match(D.noticia.enlace, /^https:\/\/www\.mdpi\.com\//, "la noticia cita una fuente real con enlace");
  assert.equal(D.noticia.imagen, "");
});

test("precios: un solo lugar (datos.js), ningún $29.990 como precio de venta y el valor tachado suma exacto", () => {
  const D = new Function(`${leer("prueba-quiz/src/datos.js")}; return DATOS;`)();
  assert.deepEqual(D.precios, { principal: "$9.990", back1: "$7.990", back2: "$4.990", upsellPro: "$24.990", downsell: "$14.990", accesoDeVida: "$12.990" });
  const num = (s: string) => Number(s.replace(/\D/g, ""));
  assert.equal(D.valor.items.reduce((a: number, [, v]: [string, string]) => a + num(v), 0), num(D.valor.total), "los ítems suman el valor total");
  assert.equal(D.valor.total, "$29.990");
  for (const [n, h] of Object.entries({ ...paginas, raiz })) {
    const sinDatos = h.replace(/\/\*DATOS-INICIO\*\/[\s\S]*?\/\*DATOS-FIN\*\//, "");
    assert.ok(!sinDatos.includes("29.990"), `${n}: el $29.990 solo puede salir de datos.js (valor tachado)`);
  }
  assert.match(paginas["oferta"], /Valor total<\/span><s>\$\{DATOS\.valor\.total\}/, "el total solo se muestra tachado");
  for (const k of ["principal", "back1", "back2"] as const) assert.ok(leer("prueba-quiz/api/server.mjs").includes(`"${D.precios[k]}"`), `el servicio acepta el precio ${k}`);
});

test("textos: carga, oferta, back1, back2 y gracias dicen lo acordado", () => {
  const q = paginas["quiz"];
  for (const s of ["Analizando tus respuestas…", "Detectando tu nivel:", "Eligiendo los drills para tu objetivo:", "Ajustando la carga a tu tiempo:", "Armando tus 4 semanas de shadowboxing…", "Tu plan está armado.", "¿podés entrenar a la misma hora todos los días?", "Sí, ya tengo mi horario", "Algunos días", "Plan ajustado a tu rutina", "¿Preferís entrenar a la mañana o a la noche?", "Horario guardado"]) assert.ok(q.includes(s), `quiz: falta «${s}»`);
  const o = paginas["oferta"];
  for (const s of ["Tu plan está listo", "ya está armado.", "Según tus respuestas, armamos tu Semana 1 y las 3 siguientes. Falta un paso para activarlo.", "Tu precio de lanzamiento está reservado por", "Por qué entrenar sin plan te frena", "Repetir los mismos golpes sin una guía fija los errores. Un plan por semanas te dice qué trabajar, cuánto y cuándo.", "Tu precio de lanzamiento", "Pago único · Acceso inmediato · Sin suscripción", "QUIERO MI PLAN POR ", "Empezar hoy mismo", "Pago seguro · Garantía ", "Siguiendo el plan semana a semana trabajás tu técnica, tu guardia, tus combinaciones y tu resistencia.", "Este precio es para quienes completaron el quiz. Cuando el contador llega a cero, se cierra.", "Oferta termina en", "Reservar mi lugar", "¿Cómo recibo el plan?", "¿Necesito equipo?", "¿Sirve si nunca entrené?", "¿Y si no me sirve?"]) assert.ok(o.includes(s), `oferta: falta «${s}»`);
  const b1 = paginas["back1"];
  for (const s of ["ESPERÁ — TU DESCUENTO ESTÁ RESERVADO POR", "Desbloqueaste un descuento", "Antes de irte… tenés 20% OFF", "Sabemos que decidir cuesta. Antes de que te vayas, te dejamos BeastCamp Sombra a un precio que no vas a volver a ver.", "Precio normal", "Tu precio con el descuento", "QUIERO MI 20% OFF →", "Empezar hoy por "]) assert.ok(b1.includes(s), `back1: falta «${s}»`);
  const b2 = paginas["back2"];
  for (const s of ["ÚLTIMA OPORTUNIDAD — SE ACABA EN", "Esta es tu última chance: 50% OFF", "Si cerrás esta página, la oferta desaparece. No hay una tercera: este es el precio más bajo.", "Tu precio final", "SÍ, QUIERO EL 50% OFF FINAL →", "Este es el último descuento. Si salís, el precio vuelve a "]) assert.ok(b2.includes(s), `back2: falta «${s}»`);
  const g = paginas["gracias"];
  for (const s of ["Tu BeastCamp está activado.", "Te mandamos el acceso a", "Revisá también spam.", "Entrar a mi plan"]) assert.ok(g.includes(s), `gracias: falta «${s}»`);
  assert.doesNotMatch(g.replace(/\/\*DATOS-INICIO\*\/[\s\S]*?\/\*DATOS-FIN\*\//, ""), /upsell|downsell|Acceso Turbo|VIP/i, "gracias sin ventas extra");
  assert.match(paginas["oferta"], /const CICLOS = \{ oferta: 600, back1: 597, back2: 297 \}/, "contadores 10:00, 09:57 y 04:57");
  assert.ok(!/Beast Camp/.test(Object.values(paginas).join("")), "nombre público BeastCamp");
});

test("datos: no hay pantallas de upsell, downsell ni acceso de vida (solo precios configurables)", () => {
  for (const r of ["upsell", "upsell2", "downsell"]) assert.ok(!existsSync(`prueba-quiz/sitio/${r}`), `no existe /${r}`);
  assert.doesNotMatch(Object.values(paginas).join("").replace(/\/\*DATOS-INICIO\*\/[\s\S]*?\/\*DATOS-FIN\*\//g, ""), /24\.990|14\.990|12\.990/, "esos precios solo salen de datos.js");
});

test("vista previa: el relleno vive fuera del sitio y nunca llega al sitio publicado", () => {
  const relleno = leer("vista-previa-local/datos-vista-previa.js");
  assert.match(relleno, /__VISTA_PREVIA__: true/);
  assert.ok(!existsSync("prueba-quiz/vista-previa-local") && !existsSync("prueba-quiz/src/datos-vista-previa.js"), "no está dentro de prueba-quiz/");
  const marcas = ["__VISTA_PREVIA__", "MN 00000", "Universidad de relleno", "Posgrado de relleno", "Martín R.", "Lucía P.", "Diego F.", "3.200", "vista=1", "datos-vista-previa"];
  for (const [nombre, h] of Object.entries({ ...paginas, raiz })) for (const m of marcas) assert.ok(!h.includes(m), `${nombre} no debe contener «${m}»`);
  assert.match(leer("vista-previa-local/servir.mjs"), /listen\(PUERTO, "127\.0\.0\.1"/, "solo en la PC");
});

test("quiz: el sitio publicado sale exacto de prueba-quiz/src (volver a armarlo no cambia nada)", async () => {
  const { execFileSync } = await import("node:child_process");
  const antes = todas.slice();
  execFileSync(process.execPath, ["prueba-quiz/scripts/construir-quiz.mjs"]);
  const despues = [...PAGINAS.map((p) => leer(`prueba-quiz/sitio/${p}/index.html`)), leer("prueba-quiz/sitio/index.html")];
  assert.deepEqual(despues.sort(), antes.sort());
});

test("api: valida con lista cerrada, límite por IP, 4 KB, solo POST y no loguea mails", async () => {
  const { mkdtempSync, readFileSync: leerArchivo, statSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const dir = mkdtempSync(`${tmpdir()}/bcapi-`);
  process.env.DATA_DIR = dir;
  const { crear, validar } = await import("../prueba-quiz/api/server.mjs");
  assert.deepEqual(validar("lead", { nombre: "Ana", mail: "A@b.co", nivel: "Estoy empezando", t: 1.7e12 }), { nombre: "Ana", mail: "a@b.co", nivel: "Estoy empezando" });
  assert.equal(validar("lead", { nombre: "Ana", mail: "no-es-mail" }), null);
  assert.equal(validar("lead", { nombre: "Ana", mail: "a@b.co", extra: 1 }), null, "campos de más");
  assert.equal(validar("lead", { nombre: "Ana", mail: "a@b.co", nivel: "inventado" }), null);
  assert.equal(validar("lead", { nombre: "Ana", mail: "a@b.co", nivel: "Estoy empezando" })?.nivel, "Estoy empezando");
  assert.equal(validar("click", { precio: "$1" }), null);
  assert.deepEqual(validar("click", { precio: "$9.990" }), { precio: "$9.990" });
  assert.equal(validar("click", { precio: "$29.990" }), null, "el $29.990 ya no es precio de venta");
  const logs: string[] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => void logs.push(a.join(" "));
  const srv = crear();
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  const puerto = (srv.address() as { port: number }).port;
  const url = (r: string) => `http://127.0.0.1:${puerto}${r}`;
  const post = (r: string, cuerpo: string, ip = "9.9.9.9") => fetch(url(r), { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": ip }, body: cuerpo });
  try {
    assert.equal((await fetch(url("/api/lead"))).status, 405, "solo POST");
    assert.equal((await fetch(url("/otra"), { method: "POST" })).status, 404);
    assert.equal((await post("/api/lead", JSON.stringify({ nombre: "Ana", mail: "ana@correo.com", nivel: "", t: Date.now() }))).status, 204);
    assert.equal((await post("/api/click", JSON.stringify({ precio: "$9.990", t: Date.now() }))).status, 204);
    assert.equal((await post("/api/lead", "x".repeat(5000))).status, 413, "body máximo 4 KB");
    assert.equal((await post("/api/lead", "{no json")).status, 400);
    const leads = leerArchivo(`${dir}/leads.jsonl`, "utf8");
    assert.match(leads, /ana@correo\.com/);
    assert.equal((statSync(`${dir}/leads.jsonl`).mode & 0o777).toString(8) === "600" || process.platform === "win32", true, "permisos 600");
    assert.doesNotMatch(logs.join("\n"), /ana@correo\.com/, "no se loguea el mail");
    let corte = 0;
    for (let i = 0; i < 10; i++) if ((await post("/api/lead", JSON.stringify({ nombre: "B", mail: `b${i}@c.co` }), "8.8.8.8")).status === 429) corte++;
    assert.ok(corte >= 4, "límite por IP (CF-Connecting-IP)");
  } finally {
    console.log = orig;
    srv.close();
  }
});

test("quiz: nginx solo lee (GET/HEAD) en lo estático, el CSP solo permite el mismo origen y /api/ es lo único que llega al servicio", () => {
  const n = leer("prueba-quiz/nginx.conf");
  // lo estático: solo GET/HEAD (405 para el resto), en cada location
  assert.match(n, /\$request_method !~ \^\(GET\|HEAD\)\$\) \{ return 405; \}/);
  const https = n.slice(n.indexOf("listen 443"));
  const estaticos = https.split(/^    location /m).slice(1).filter((b) => !/proxy_pass/.test(b));
  assert.ok(estaticos.length >= 8, "hay varios location estáticos");
  for (const b of estaticos) if (!/return 404;/.test(b)) assert.match(b, /\$request_method !~ \^\(GET\|HEAD\)\$\) \{ return 405; \}/, `location estático sin la regla de solo lectura: ${b.slice(0, 60)}`);
  // CSP: solo mismo origen (más worker y manifest de la app), nada de terceros
  const csp = n.match(/add_header Content-Security-Policy "([^"]+)" always;/)?.[1] ?? "";
  for (const d of ["default-src 'none'", "script-src 'unsafe-inline'", "style-src 'unsafe-inline'", "img-src 'self' data:", "media-src 'self'", "connect-src 'self'", "form-action 'none'", "frame-ancestors 'none'", "base-uri 'none'", "worker-src 'self'", "manifest-src 'self'"]) assert.ok(csp.includes(d), `CSP sin ${d}`);
  assert.doesNotMatch(csp, /https?:|\*/, "CSP sin hosts de terceros");
  // HTTPS, HSTS y noindex
  assert.match(n, /listen 443 ssl http2;/);
  assert.match(n, /return 301 https:\/\/\$host\$request_uri;/);
  assert.match(n, /Strict-Transport-Security "max-age=\d+"/);
  assert.match(n, /ssl_certificate\s+\/etc\/letsencrypt\/live\/DOMINIO\/fullchain\.pem;/);
  // la API: solo GET/POST/PUT, 64k, IP real y timeouts cortos; es el único proxy_pass (y /salud)
  const api = n.match(/location \/api\/ \{[\s\S]*?\n    \}/)?.[0] ?? "";
  assert.match(api, /\$request_method !~ \^\(GET\|POST\|PUT\)\$\) \{ return 405; \}/);
  assert.match(api, /client_max_body_size 64k;/);
  assert.match(api, /proxy_pass http:\/\/127\.0\.0\.1:3000;/);
  assert.match(api, /proxy_set_header X-Real-IP \$remote_addr;/);
  assert.match(api, /proxy_read_timeout 15s;/);
  assert.deepEqual([...n.matchAll(/proxy_pass ([^;]+);/g)].map((m) => m[1]), ["http://127.0.0.1:3000", "http://127.0.0.1:3000"], "solo /api/ y /salud llegan al servicio");
  assert.doesNotMatch(n, /fastcgi|upstream/);
  // la app: UUID v4 para /app/<acceso>/ y su manifest; sw y manifest sin caché; img y media a 30 días sin immutable
  assert.ok((n.match(/\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-4\[0-9a-f\]\{3\}-\[89ab\]\[0-9a-f\]\{3\}-\[0-9a-f\]\{12\}/g) ?? []).length >= 3);
  assert.match(n, /location = \/app\/sw\.js \{[\s\S]*?expires -1;/);
  assert.match(n, /location \^~ \/img\/ \{[\s\S]*?expires 30d;/);
  assert.match(n, /location \^~ \/media\/ \{[\s\S]*?expires 30d;/);
  assert.doesNotMatch(n.replace(/#.*$/gm, ""), /immutable/);
  assert.match(n, /gzip on;/);
});
