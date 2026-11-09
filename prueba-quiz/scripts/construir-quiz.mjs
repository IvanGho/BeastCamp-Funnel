#!/usr/bin/env node
// Arma el sitio estático del quiz BeastCamp a partir de prueba-quiz/src/ y lo escribe en prueba-quiz/sitio/.
// Cada página sale con el CSS y el JS en línea (el CSP de nginx no permite archivos externos de script ni de estilo).
// Uso: node prueba-quiz/scripts/construir-quiz.mjs   (desde la raíz del repo)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (f) => readFileSync(join(raiz, "src", f), "utf8");
const salida = (ruta, contenido) => {
  const destino = join(raiz, "sitio", ruta);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, contenido);
};

const css = src("base.css");
const datosTxt = src("datos.js");
const datos = new Function(`${datosTxt}; return DATOS;`)();
const ilust = src("ilustraciones.js");
const comun = src("comun.js");

const cabeza = (titulo) => `<!doctype html><html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="theme-color" content="#16A34A"><title>${titulo}</title><style>${css}</style></head>`;
const scripts = (extra) => `<script>\n${datosTxt}\n${ilust}\n${comun}\n${extra}\n</script>`;

// ---------- Quiz ----------
salida("quiz/index.html",
  cabeza("BeastCamp · Plan de shadowboxing en casa") +
  `<body><div class="prog"><i id="barra"></i></div><div class="shell" id="shell"><div id="bg"></div><main id="app"></main></div>${scripts(src("quiz.js"))}</body></html>`);

// ---------- Oferta y rescates ----------
for (const [id, titulo] of [["oferta", "BeastCamp Sombra · Tu plan de 4 semanas"], ["back1", "BeastCamp Sombra · 20% OFF"], ["back2", "BeastCamp Sombra · 50% OFF final"]]) {
  salida(`${id}/index.html`,
    cabeza(titulo) + `<body><div class="shell" id="shell"><div id="bg"></div><main id="app" class="oferta-main"></main></div>${scripts(`const PAGINA='${id}';\n${src("oferta.js")}`)}</body></html>`);
}

// ---------- Gracias ----------
salida("gracias/index.html",
  cabeza("BeastCamp · Gracias") +
  `<body><div class="shell" id="shell"><div id="bg"></div><main id="app"></main></div>${scripts(`
const nom = esc(A.nombre || 'Campeón');
const mail = A.mail ? esc(A.mail) : 'tu mail';
$('app').innerHTML = '<div class="scr gracias"><div class="tick"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg></div><h1>Listo, ' + nom + '. Tu BeastCamp está activado.</h1><p>Te mandamos el acceso a <b>' + mail + '</b>. Revisá también spam.</p>' + (DATOS.appUrl ? '<a class="cta" href="' + esc(DATOS.appUrl) + '">Entrar a mi plan</a>' : '') + '<p class="note" style="margin-top:14px">Garantía de devolución de ' + DATOS.garantiaDias + ' días.</p></div>';
pie();`)}</body></html>`);

// ---------- Legales ----------
const contacto = datos.contacto ? `escribinos a ${datos.contacto}` : "escribinos por el mismo medio por el que llegaste a esta página";
const legal = (titulo, cuerpo) =>
  cabeza(`BeastCamp · ${titulo}`) + `<body><div class="legal"><p><a href="/quiz/">← Volver</a></p><h1>${titulo}</h1>${cuerpo}</div></body></html>`;

salida("legal/terminos/index.html", legal("Términos y condiciones", `
<p>Estos términos regulan la compra y el uso de BeastCamp, un plan digital de 4 semanas de shadowboxing en casa. Al comprar, aceptás estos términos.</p>
<h2>1. Qué es el producto</h2><p>BeastCamp es un contenido digital de acceso inmediato: plan semanal, rutinas guiadas, timer de rounds y ranking. No incluye clases en vivo ni atención personalizada, y no se entrega nada físico.</p>
<h2>2. Precio y pago</h2><p>El precio es un pago único, sin suscripción ni renovaciones. El precio vigente es el que ves en pantalla al momento de la compra.</p>
<h2>3. Garantía de devolución de ${datos.garantiaDias} días</h2><p>Si dentro de los ${datos.garantiaDias} días corridos desde tu compra el plan no te sirve, pedinos la devolución y te reintegramos el importe pagado, sin preguntas.</p>
<h2>4. Uso responsable</h2><p>El contenido es para personas mayores de 18 años y no reemplaza la consulta con un profesional de la salud. Si tenés una lesión, una condición médica o dudas, consultá a tu médico antes de entrenar. Entrenás bajo tu propia responsabilidad.</p>
<h2>5. Propiedad intelectual</h2><p>El contenido es de BeastCamp. Podés usarlo para tu entrenamiento personal; no podés copiarlo, revenderlo ni compartirlo.</p>
<h2>6. Cambios</h2><p>Podemos actualizar estos términos. Para compras ya hechas siguen valiendo los términos vigentes al momento de comprar.</p>
<h2>7. Contacto</h2><p>Para cualquier consulta o para pedir la devolución, ${contacto}.</p>`));

salida("legal/privacidad/index.html", legal("Política de privacidad", `
<p>Esta política explica qué datos guardamos cuando usás el quiz de BeastCamp y para qué.</p>
<h2>1. Qué datos guardamos</h2><p>Guardamos el nombre o apodo y el mail que ingresás, tu nivel de entrenamiento y un registro, sin datos personales, de cuándo tocás el botón de reserva. Tus demás respuestas se usan solo en tu navegador para armar tu plan y no se envían a nuestros servidores.</p>
<h2>2. Para qué los usamos</h2><p>Para enviarte tu plan y el acceso a BeastCamp, y para mejorar la oferta. No vendemos tus datos ni los compartimos con terceros para publicidad.</p>
<h2>3. Cómo los protegemos</h2><p>Los datos se guardan en un servidor propio, con acceso restringido, y no se muestran en registros de funcionamiento.</p>
<h2>4. Tus derechos</h2><p>Podés pedir en cualquier momento ver, corregir o borrar tus datos (Ley 25.326 de Protección de los Datos Personales de la República Argentina). Para hacerlo, ${contacto}.</p>
<h2>5. Menores</h2><p>El quiz es para mayores de 18 años. No guardamos datos de menores a sabiendas.</p>
<h2>6. Cookies y tecnologías similares</h2><p>Usamos el almacenamiento de tu navegador solo durante la sesión, para recordar tus respuestas y el contador de la oferta.</p>`));

// ---------- Raíz: lleva al quiz ----------
salida("index.html",
  `<!doctype html><html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><meta http-equiv="refresh" content="0;url=/quiz/"><title>BeastCamp</title></head><body><a href="/quiz/">Ir al quiz</a><script>location.replace('/quiz/'+location.search)</script></body></html>`);

console.log("Sitio armado en prueba-quiz/sitio/");
