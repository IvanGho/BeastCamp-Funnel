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

// ---------- Metadatos de cada página ----------
// Con datos.sitioUrl (https, sin barra final) las rutas de og:image y og:url salen absolutas; vacío = relativas y sin og:url.
const sitioUrl = String(datos.sitioUrl || "").replace(/\/+$/, "");
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attr = (t) => String(t).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
// Imagen para compartir de cada funnel (1200×630). Las páginas compartidas (gracias, legales, raíz) usan la de peleadores.
const OG = {
  peleador: { imagen: "/img/og-quiz.jpg", alt: "BeastCamp: plan de shadowboxing en casa" },
  peso: { imagen: "/img/og-quiz-peso.jpg", alt: "BeastCamp: plan de shadowboxing en casa para empezar de cero" },
};
const G = datos.garantiaDias;
const metas = ({ titulo, descripcion, ruta, og = "peleador" }) => {
  const t = attr(titulo), d = attr(descripcion), img = OG[og];
  return [
    `<meta name="robots" content="noindex,nofollow,noarchive">`,
    `<meta name="theme-color" content="#16A34A">`,
    `<meta name="description" content="${d}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:locale" content="es_AR">`,
    `<meta property="og:site_name" content="BeastCamp">`,
    `<meta property="og:title" content="${t}">`,
    `<meta property="og:description" content="${d}">`,
    ...(sitioUrl ? [`<meta property="og:url" content="${attr(sitioUrl + ruta)}">`] : []),
    `<meta property="og:image" content="${attr(sitioUrl + img.imagen)}">`,
    `<meta property="og:image:type" content="image/jpeg">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${attr(img.alt)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<link rel="icon" href="/img/marca/favicon.svg" type="image/svg+xml">`,
    `<link rel="icon" href="/img/marca/favicon-32.png" type="image/png" sizes="32x32">`,
    `<link rel="apple-touch-icon" href="/img/marca/apple-touch-icon.png">`,
  ].join("");
};

// `imagenes`: lo que se ve en la primera pantalla; el navegador lo pide antes de ejecutar el JS que arma la página.
const cabeza = (titulo, { descripcion, ruta, og, imagenes = [], cssExtra = "" }) => `<!doctype html><html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${metas({ titulo, descripcion, ruta, og })}<title>${titulo}</title>${imagenes.map((u) => `<link rel="preload" as="image" href="${u}" fetchpriority="high">`).join("")}<style>${css}${cssExtra}</style></head>`;
const primeraPantallaQuiz = ["/media/hook.jpg", ...["m_golpes", "m_aire", "m_plan", "m_const"].map((k) => `/img/muneco-${k}.webp`)];
const scripts = (extra) => `<script>\n${datosTxt}\n${ilust}\n${comun}\n${extra}\n</script>`;

// Descripciones: salen de los textos que ya están en las páginas (nada de promesas nuevas).
const DESC = {
  quiz: "Plan de 4 semanas de shadowboxing en casa, en tu celu, con timer de rounds y rutinas guiadas. Respondé unas preguntas y armamos el tuyo según tus respuestas.",
  oferta: `Plan de 4 semanas de shadowboxing en casa, en tu celu, con 4 niveles de carga (de 15 minutos por día a 90 minutos por día), timer de rounds y rutinas guiadas. Pago único, sin suscripción. Garantía de ${G} días.`,
  back1: `20% OFF en BeastCamp Sombra: plan de 4 semanas de shadowboxing en casa, con timer de rounds y rutinas guiadas. Pago único, sin suscripción. Garantía de ${G} días.`,
  back2: `50% OFF en BeastCamp Sombra: plan de 4 semanas de shadowboxing en casa, con timer de rounds y rutinas guiadas. Pago único, sin suscripción. Garantía de ${G} días.`,
  quizPeso: "Shadowboxing en casa, sin gimnasio y sin haber boxeado nunca. Respondé unas preguntas y armamos tu plan de 4 semanas al tiempo que tenés.",
  ofertaPeso: `Plan de 4 semanas de shadowboxing en casa para arrancar de cero: sin gimnasio, sin equipo y sin experiencia. 4 niveles de carga (de 15 a 90 minutos por día), timer de rounds y rutinas guiadas. Pago único. Garantía de ${G} días.`,
  back1Peso: `20% OFF en BeastCamp Sombra: plan de 4 semanas de shadowboxing en casa para arrancar de cero, con timer de rounds y rutinas guiadas. Pago único, sin suscripción. Garantía de ${G} días.`,
  back2Peso: `50% OFF en BeastCamp Sombra: plan de 4 semanas de shadowboxing en casa para arrancar de cero, con timer de rounds y rutinas guiadas. Pago único, sin suscripción. Garantía de ${G} días.`,
  gracias: "Tu BeastCamp está activado. Te mandamos el acceso a tu plan por mail; guardalo, es tu link personal.",
  terminos: `Términos y condiciones de BeastCamp: qué incluye la compra, garantía de devolución de ${G} días, acceso personal y uso del contenido.`,
  privacidad: "Política de privacidad de BeastCamp: qué datos se guardan, quién los procesa, qué guarda tu navegador, por cuánto tiempo y cómo ejercer tus derechos.",
  raiz: "Plan de 4 semanas de shadowboxing en casa, con timer de rounds y rutinas guiadas.",
};

// ---------- Quiz ----------
salida("quiz/index.html",
  cabeza("BeastCamp · Plan de shadowboxing en casa", { descripcion: DESC.quiz, ruta: "/quiz/", imagenes: primeraPantallaQuiz }) +
  `<body><div class="prog"><i id="barra"></i></div><div class="shell" id="shell"><div id="bg"></div><main id="app"></main></div>${scripts(src("quiz.js"))}</body></html>`);

// ---------- Oferta y rescates ----------
for (const [id, titulo] of [["oferta", "BeastCamp Sombra · Tu plan de 4 semanas"], ["back1", "BeastCamp Sombra · 20% OFF"], ["back2", "BeastCamp Sombra · 50% OFF final"]]) {
  salida(`${id}/index.html`,
    cabeza(titulo, { descripcion: DESC[id], ruta: `/${id}/`, imagenes: ["/media/oferta.jpg"] }) + `<body><div class="shell" id="shell"><div id="bg"></div><main id="app" class="oferta-main"></main></div>${scripts(`const PAGINA='${id}';\n${src("oferta.js")}`)}</body></html>`);
}

// ---------- Funnel de bajar de peso (rutas nuevas, solo se agregan) ----------
const peso = (f) => src(`peso/${f}`);
const cssPeso = peso("peso.css");
const cssOfertaPeso = peso("peso-oferta.css");
// Primera pantalla (edad): el póster del video hook y los cuatro muñecos de sus tarjetas.
const primeraPantallaPeso = ["/media/hook.jpg", ...["n_empiezo", "n_seis", "n_anios", "n_mas"].map((k) => `/img/muneco-${k}.webp`)];
salida("quiz-peso/index.html",
  cabeza("BeastCamp · Plan para bajar de peso en casa", { descripcion: DESC.quizPeso, ruta: "/quiz-peso/", og: "peso", imagenes: primeraPantallaPeso, cssExtra: cssPeso }) +
  `<body><div class="prog"><i id="barra"></i></div><div class="shell" id="shell"><div id="bg"></div><main id="app"></main></div>${scripts([peso("calculos-peso.js"), peso("datos-peso.js"), peso("quiz-peso.js")].join("\n"))}</body></html>`);
for (const [id, titulo] of [["oferta", "BeastCamp Sombra · Tu plan de 4 semanas"], ["back1", "BeastCamp Sombra · 20% OFF"], ["back2", "BeastCamp Sombra · 50% OFF final"]]) {
  salida(`${id}-peso/index.html`,
    cabeza(titulo, { descripcion: DESC[id === "oferta" ? "ofertaPeso" : `${id}Peso`], ruta: `/${id}-peso/`, og: "peso", imagenes: ["/media/oferta.jpg"], cssExtra: cssOfertaPeso }) + `<body><div class="shell" id="shell"><div id="bg"></div><main id="app" class="oferta-main"></main></div>${scripts(`const PAGINA='${id}';\n${[peso("calculos-peso.js"), peso("datos-peso.js"), peso("oferta-peso.js")].join("\n")}`)}</body></html>`);
}

// ---------- Gracias ----------
// Hilvapay redirige acá con nombre, email, acceso y campaña; el botón «Entrar a mi plan» lleva a la app del comprador (src/gracias.js).
salida("gracias/index.html",
  cabeza("BeastCamp · Gracias", { descripcion: DESC.gracias, ruta: "/gracias/", cssExtra: src("gracias.css") }) +
  `<body><div class="shell" id="shell"><div id="bg"></div><main id="app"></main></div>${scripts(src("gracias.js"))}</body></html>`);

// ---------- Legales ----------
// Dicen lo que hace el sistema de verdad. Dos datos vienen de datos.js y, si están vacíos, queda un texto de respaldo: `responsable` y `contacto`.
const contacto = datos.contacto ? `escribinos a ${esc(datos.contacto)}` : "escribinos por el mismo medio por el que llegaste a esta página";
const responsable = datos.responsable
  ? `El responsable del tratamiento de los datos es <b>${esc(datos.responsable)}</b>.`
  : "El responsable del tratamiento de los datos es el titular de BeastCamp, que opera este sitio.";
const legal = (titulo, ruta, descripcion, cuerpo) =>
  cabeza(`BeastCamp · ${titulo}`, { descripcion, ruta }) + `<body><div class="legal"><p><a href="/quiz/">← Volver</a></p><h1>${titulo}</h1>${cuerpo}</div></body></html>`;

salida("legal/terminos/index.html", legal("Términos y condiciones", "/legal/terminos/", DESC.terminos, `
<p>Estos términos regulan la compra y el uso de BeastCamp, un plan digital de 4 semanas de shadowboxing en casa. Al comprar, aceptás estos términos.</p>
<h2>1. Qué es el producto</h2><p>BeastCamp es un contenido digital de acceso inmediato: plan semanal, rutinas guiadas, timer de rounds, drills y ranking. No incluye clases en vivo ni atención personalizada, y no se entrega nada físico.</p>
<h2>2. Precio y pago</h2><p>El precio es un pago único, sin suscripción ni renovaciones. El precio vigente es el que ves en pantalla al momento de la compra. El pago se hace en la página de pago de Hilvapay, que procesa el cobro; nosotros no vemos ni guardamos los datos de tu tarjeta.</p>
<h2>3. Tu acceso es personal</h2><p>Al pagar te mandamos por mail un link personal a tu plan. Ese link es tu acceso: no hay usuario ni contraseña. Es solo para vos, así que no lo compartas ni lo publiques. Si lo perdés o cambiás de celu, podés pedirlo de nuevo con el mail con el que compraste.</p>
<h2>4. Garantía de devolución de ${datos.garantiaDias} días</h2><p>Si dentro de los ${datos.garantiaDias} días corridos desde tu compra el plan no te sirve, pedinos la devolución y te reintegramos el importe pagado, sin preguntas. Cuando se devuelve el importe, el acceso se da de baja. Lo mismo pasa si la compra se disputa o se desconoce ante el medio de pago.</p>
<h2>5. Ranking con rivales virtuales</h2><p>El ranking de la app compara tus puntos con rivales virtuales que genera la propia app. No son otras personas ni otros compradores: cada fila está marcada como virtual. Tus puntos y tu apodo son reales y son tuyos.</p>
<h2>6. Uso responsable</h2><p>El contenido es para personas mayores de 18 años y no reemplaza la consulta con un profesional de la salud. Si tenés una lesión, una condición médica o dudas, consultá a tu médico antes de entrenar. Entrenás bajo tu propia responsabilidad. Los resultados dependen de cada persona y no se garantizan.</p>
<h2>7. Propiedad intelectual</h2><p>El contenido es de BeastCamp. Podés usarlo para tu entrenamiento personal; no podés copiarlo, revenderlo ni compartirlo.</p>
<h2>8. Cambios</h2><p>Podemos actualizar estos términos. Para compras ya hechas siguen valiendo los términos vigentes al momento de comprar.</p>
<h2>9. Contacto</h2><p>Para cualquier consulta o para pedir la devolución, ${contacto}.</p>`));

salida("legal/privacidad/index.html", legal("Política de privacidad", "/legal/privacidad/", DESC.privacidad, `
<p>Esta política explica qué datos guardamos cuando usás el quiz y la app de BeastCamp, quién los procesa, por cuánto tiempo y cómo ejercer tus derechos.</p>
<h2>1. Responsable</h2><p>${responsable} Para consultas sobre tus datos, ${contacto}.</p>
<h2>2. Qué datos guardamos</h2>
<ul>
<li><b>Quiz de peleadores:</b> el nombre o apodo y el mail que ingresás y tu nivel de entrenamiento. Tus demás respuestas se usan solo en tu navegador para armar tu plan y no se envían a nuestros servidores.</li>
<li><b>Quiz de bajar de peso:</b> no manda ningún dato a nuestros servidores. El peso, la altura, la edad, el nombre y las demás respuestas quedan solo en tu navegador.</li>
<li><b>Clics en el botón de reserva y de pago:</b> guardamos que hubo un clic, con el precio, el funnel (peleadores o bajar de peso), la página y la campaña (utm_source, utm_medium, utm_campaign, utm_content y utm_term). No llevan nombre, mail ni ningún dato personal.</li>
<li><b>Tu compra:</b> cuando pagás, Hilvapay nos avisa el nombre y el mail que escribiste en el pago, el monto, la moneda, la fecha, el producto, el funnel, tu nivel de entrenamiento, la página de venta y la campaña de la que venías. No recibimos los datos de tu tarjeta. Solo si está activa la medición de anuncios de Meta, guardamos además la dirección IP y el navegador de la compra y los identificadores de clic del anuncio (fbclid, fbc y fbp), para mandar la compra a Meta y reintentar si falla. Sin esa medición no se guardan.</li>
<li><b>Registro de mails:</b> guardamos qué mail salió (el de acceso o el de recuperar tu link) y para qué acceso, sin el contenido del mensaje.</li>
<li><b>La app:</b> el apodo que elijas, tu nivel, la fecha de inicio, las sesiones y los ejercicios (drills) completados y tus ajustes de sonido, voz y vibración, asociados a tu link personal de acceso.</li>
</ul>
<h2>3. Quién los procesa</h2>
<ul>
<li><b>Hilvapay</b> procesa el pago y nos avisa de cada compra.</li>
<li>Los <b>mails</b> con tu link de acceso salen por un proveedor de envío de mails, que recibe tu mail y el contenido del mensaje para enviarlo.</li>
<li><b>Medición de anuncios:</b> si está activada, nuestro servidor le envía a Meta Platforms el aviso de la compra y del inicio del pago, para medir el rendimiento de los anuncios. Va con tu mail y tu primer nombre cifrados (SHA-256, no legibles), tu acceso cifrado, tu dirección IP, tu navegador, los identificadores de clic del anuncio, el monto y la moneda. En el inicio de pago va lo mismo, pero sin mail ni nombre. Todo sale de nuestro servidor: estas páginas no cargan ningún código de Meta ni de otros terceros.</li>
</ul>
<h2>4. Para qué los usamos</h2><p>Para armar y mostrarte tu plan, mandarte el acceso, registrar tu compra y tu devolución si la pedís, medir qué anuncios y páginas funcionan y mejorar la oferta. No vendemos tus datos.</p>
<h2>5. Qué guarda tu navegador</h2>
<ul>
<li><b>Durante la sesión:</b> tus respuestas del quiz y el contador de la oferta. Se borran al cerrar la pestaña.</li>
<li><b>La campaña, por 30 días:</b> si llegás desde un anuncio, guardamos de qué campaña venís para saber qué anuncio funcionó.</li>
<li><b>Tu acceso y tu progreso:</b> un identificador de acceso, el último acceso abierto y tu progreso en la app, para que puedas volver a entrar y seguir sin repetir nada. Quedan hasta que borres los datos del sitio en tu navegador.</li>
</ul>
<h2>6. Por cuánto tiempo</h2><p>No hay un borrado automático: guardamos tus datos mientras dure tu acceso o hasta que pidas que los borremos, lo que pase primero. Podés pedirlo en cualquier momento.</p>
<h2>7. Cómo los protegemos</h2><p>Los datos se guardan en un servidor propio, con acceso restringido, y no se muestran en registros de funcionamiento. Tu link de acceso es personal: quien lo tenga puede entrar a tu plan, por eso no lo compartas.</p>
<h2>8. Tus derechos</h2><p>Podés pedir en cualquier momento ver, corregir o borrar tus datos (Ley 25.326 de Protección de los Datos Personales de la República Argentina). Para hacerlo, ${contacto}. El acceso a tus datos es gratuito y podés ejercerlo a intervalos no inferiores a seis meses, salvo que acredites un interés legítimo. La Agencia de Acceso a la Información Pública, órgano de control de la Ley 25.326, atiende las denuncias y los reclamos de quienes vean afectados sus derechos por incumplimientos de las normas de protección de datos personales.</p>
<h2>9. Menores</h2><p>BeastCamp es para mayores de 18 años. No guardamos datos de menores a sabiendas.</p>`));

// ---------- Raíz: lleva al quiz ----------
salida("index.html",
  `<!doctype html><html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${metas({ titulo: "BeastCamp", descripcion: DESC.raiz, ruta: "/" })}<meta http-equiv="refresh" content="0;url=/quiz/"><title>BeastCamp</title></head><body><a href="/quiz/">Ir al quiz</a><script>location.replace('/quiz/'+location.search)</script></body></html>`);

// ---------- robots.txt ----------
// Nadie indexa nada (las páginas además llevan noindex en la etiqueta y en la cabecera). Los bots de vista previa de links y de revisión de anuncios
// necesitan leer las etiquetas de las páginas del funnel para armar la tarjeta y revisar el anuncio: solo a ellos se les abren esas rutas.
const BOTS_VISTA_PREVIA = ["facebookexternalhit", "Facebot", "Twitterbot", "WhatsApp", "TelegramBot", "LinkedInBot", "Slackbot"];
const RUTAS_VISTA_PREVIA = ["/quiz/", "/quiz-peso/", "/oferta/", "/oferta-peso/", "/back1/", "/back1-peso/", "/back2/", "/back2-peso/", "/img/", "/media/"];
salida("robots.txt", [
  "# Sitio privado: sin indexar. Solo los bots de vista previa de links y de revisión de anuncios leen las páginas del funnel.",
  "",
  ...BOTS_VISTA_PREVIA.map((b) => `User-agent: ${b}`),
  ...RUTAS_VISTA_PREVIA.map((r) => `Allow: ${r}`),
  "Disallow: /",
  "",
  "User-agent: *",
  "Disallow: /",
  "",
].join("\n"));

console.log("Sitio armado en prueba-quiz/sitio/");
