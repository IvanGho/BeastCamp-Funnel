# BeastCamp: quiz, oferta y app del comprador

Quiz de shadowboxing (de la primera pregunta a la oferta), páginas de oferta y la **app del comprador** (`/app/`, una PWA que se instala en el celu). Es un sitio **estático**: HTML, CSS y JavaScript sin frameworks. Hay un servicio chico aparte (Node, sin dependencias) que guarda el mail y el clic de compra, recibe los avisos de pago de Hilvapay y le da al comprador su plan.

## Qué falta para salir con anuncios

El código está terminado y probado; qué se hizo y cómo se verificó está en [`docs/entrega.md`](docs/entrega.md). La rama para publicar es `main`.

Falta lo que solo puede poner el dueño del negocio. Mientras no esté:

- el botón de compra no cobra: dice «Todavía no abrimos el pago» y solo cuenta el clic;
- no sale ningún mail de acceso.

### 1. Datos y cuentas

| Qué | Dónde va | Paso a paso |
|---|---|---|
| Los 3 links de pago de Hilvapay: oferta, rescate 1 y rescate 2 | `pagoUrl` en `prueba-quiz/src/datos.js` | [deploy, 7.1](deploy/README.md#71-los-tres-links-de-pago-uno-por-precio) |
| En Hilvapay: la página de gracias `https://DOMINIO/gracias/` y los 3 avisos (pagado, reembolso y disputa), con su token | Hilvapay; el token también en `HILVAPAY_WEBHOOK_TOKEN` | [deploy, 7.2 a 7.5](deploy/README.md#7-hilvapay-paso-a-paso) |
| El dominio | `sitioUrl` en `datos.js`, `BASE_URL` del servicio y `DOMINIO` en `nginx.conf` | [deploy, 3 a 6](deploy/README.md#3-carpetas-y-código) |
| Nombre o razón social del responsable de los datos | `responsable` en `datos.js` | Lo usan los términos y la política de privacidad |
| Mail de contacto para pedir el borrado de datos o la devolución | `contacto` en `datos.js` | Lo usan las legales |
| Una cuenta de Resend con el dominio verificado | `RESEND_API_KEY` y `MAIL_DESDE` del servicio | [deploy, 8](deploy/README.md#8-resend-los-mails-de-acceso) |
| El píxel de Meta y el token de la API de conversiones | `META_PIXEL_ID` y `META_CAPI_TOKEN` del servicio | [deploy, 9](deploy/README.md#9-meta-conversions-api) |
| Un VPS con Node 22 o más nuevo, nginx y certbot | | [deploy, 1 y 2](deploy/README.md#1-requisitos) |

Después de cambiar `datos.js`, correr `npm run construir` y `npm test`, hacer commit y subirlo (ver [Actualizar](deploy/README.md#actualizar)). Las claves van solo en el servidor, nunca en el repo.

### 2. Fotos y videos

El detalle está en `docs/pendientes-imagenes.md`.

- **Videos de la app:** cada ejercicio, drill y sección de la guía tiene `video: ''`. Mientras tanto se ve el muñeco con las indicaciones. Cómo cargarlos: ver «App del comprador», más abajo.
- **Foto del especialista** (`especialista.foto`): hoy se ven las iniciales.
- **Imagen de la noticia** (`noticia.imagen`): hoy se ve un ícono.
- **Si se pueden generar imágenes:**
  - los 5 muñecos propios del funnel de peso, que no calzan del todo con los otros 35 (posición, piel y sombra);
  - los 3 muñecos de las medidas, a 720×960;
  - los pósters de los videos, a mejor resolución.
- **Opcional, solo con datos reales y verificables:** cifra de personas, diagnósticos, estrellas y testimonios, y la matrícula, la universidad y los posgrados del especialista. Mientras estén vacíos, no se muestran.

### 3. Revisión del plan por Néstor J. Medina

El plan completo, para leer sin código, está en `prueba-quiz/contenido/plan-para-revisar.md`. Quedan 5 preguntas para él:

1. ¿Impulso y Fighter, de 4 a 6 días por semana y hasta 87 minutos por sesión, están bien para hombres de más de 30 que no entrenan hace tiempo?
2. ¿Alcanza con el test del habla para medir la intensidad, sin pulsaciones?
3. ¿Van bien en principiantes las flexiones con apoyo alto, la esquiva baja, el uppercut y el gancho?
4. ¿Están bien los estiramientos de 20 a 30 segundos y la respiración 4-6?
5. ¿Alcanza con el aviso de salud que va en la guía y en la bienvenida de la app?

### 4. Pruebas antes de gastar en anuncios

- **La [lista antes de lanzar](deploy/README.md#lista-antes-de-lanzar)** de la guía, con una compra real de punta a punta y su reembolso.
- **Un iPhone y un Android de verdad.** Hasta ahora se probó con Chrome simulando celulares. Hay que revisar:
  - que los videos arranquen solos y sin sonido;
  - instalar la app (en iPhone, Compartir → Agregar a inicio);
  - el sonido, la vibración y la voz del timer;
  - que la pantalla no se apague durante la sesión.
- **Opcional:** la [prueba de humo](deploy/prueba-de-humo/) con Docker, para ver nginx y el servicio andando juntos antes de subirlos.

### 5. Detalles menores que quedaron abiertos

Salen de la auditoría ([`docs/auditoria-funnels.md`](docs/auditoria-funnels.md)). Ninguno rompe nada.

- **P2-10:** en 360×640, en las pantallas llenas del quiz (por ejemplo «cuerpo», «zonas» o el perfil) queda poco aire entre el botón y el pie legal. No se pisan.
- **P3-7:** en el quiz de peso, en 360×640, el aviso crece un poco al escribir un peso bajo y mueve el campo.
- **P3-3:** la barra de progreso y la franja de video animan el ancho y el alto en vez de usar `transform`. No se nota: van a 60 fps.
- **P2-8:** el video de escritorio conserva su filtro de color.
- **P3-9 y P3-10:** algunos muñecos de las opciones del quiz de peso no cuentan exactamente lo mismo que su texto. Se dejaron así a propósito.

## Qué hay en las carpetas

| Carpeta o archivo | Qué es |
|---|---|
| `prueba-quiz/src/` | **El código fuente.** Acá se hacen los cambios. |
| `prueba-quiz/src/datos.js` | Datos reales y precios, todo en un solo lugar. |
| `prueba-quiz/src/quiz.js` | Las pantallas del quiz (preguntas, carga, perfil). |
| `prueba-quiz/src/oferta.js` | Las páginas `/oferta`, `/back1` y `/back2`. |
| `prueba-quiz/src/comun.js` | Cosas compartidas (contadores, pantalla de reserva, bloques de especialista y noticia, campaña y link de pago). |
| `prueba-quiz/src/base.css` | Los estilos del quiz y la oferta (la app los usa tal cual y suma los suyos). |
| `prueba-quiz/src/ilustraciones.js` | Cómo se muestran los muñecos. |
| `prueba-quiz/src/gracias.js` | La página de gracias (adonde vuelve Hilvapay después del pago). |
| `prueba-quiz/src/app/` | **La app del comprador** (pantallas, reproductor con timer, progreso, service worker). |
| `prueba-quiz/contenido/` | **El plan de entrenamiento**: 4 semanas × 4 niveles × 2 perfiles, drills y la guía bono. `plan-para-revisar.md` es la versión para leer (y revisar) sin código. |
| `prueba-quiz/src/marca/` | Fuentes de los íconos y de las imágenes para compartir. |
| `prueba-quiz/scripts/` | `construir-quiz.mjs` y `construir-app.mjs` (arman las páginas), `marca.mjs` (íconos), `reporte.mjs` (clics y compras por campaña) y `compra-local.mjs` (compra simulada para probar la app). |
| `prueba-quiz/sitio/` | **Las páginas ya armadas.** Se generan solas: no se editan a mano. Incluye la app (`app/`), las figuras (`img/`: los 40 muñecos, 3 versiones nítidas `@2x`, los íconos en `marca/` y las imágenes para compartir) y los videos (`media/`). |
| `prueba-quiz/api/` | Servicio (Node 22+, sin dependencias): mails y clics del funnel, avisos de Hilvapay, acceso a la app, mails de acceso y medición para Meta. |
| `prueba-quiz/nginx.conf` | Configuración del servidor web para el VPS: HTTPS, reglas de seguridad, caché y rutas de la app y del servicio. |
| `deploy/` | **Cómo publicarlo en un VPS** (paso a paso), servicio de systemd y lista de variables. |
| `deploy/prueba-de-humo/` | Prueba de humo tipo producción con Docker (nginx real y el servicio, recorridos con Chrome) y Lighthouse. |
| `docs/entrega.md` | **Qué se entregó y cómo se verificó:** estado de cada punto del pedido, tests, Lighthouse, prueba de humo, capturas de la app y decisiones tomadas. |
| `docs/auditoria-funnels.md` | La auditoría visual de los dos funnels y en qué quedó cada punto. |
| `docs/lighthouse/` | Los reportes de Lighthouse de los dos quiz, las dos ofertas y la app (se abren en el navegador). |
| `docs/capturas/app/` | Capturas de las pantallas de la app. |
| `docs/pendientes-imagenes.md` | Qué imágenes conviene rehacer cuando se puedan generar. |
| `vista-previa-local/` | Servidor para verlo en tu compu, con datos de relleno y el servicio incluido. |
| `tests/` | Pruebas automáticas. |

## Cómo correrlo en tu compu

Necesitás [Node.js](https://nodejs.org) 22 o más nuevo.

```bash
npm install
npm run construir        # arma las páginas y la app desde prueba-quiz/src
npm run vista-previa     # abre un servidor en http://localhost:4173 (con el servicio incluido)
```

Después abrí:

- `http://localhost:4173/quiz/` y `http://localhost:4173/quiz-peso/` para ver los quiz como los ve la gente.
- `http://localhost:4173/quiz/?vista=1` para verlo con **datos de relleno** (cifra de personas, estrellas, testimonios, datos del especialista). Sirve solo para ver cómo queda el diseño completo. `?vista=0` lo apaga.

El quiz termina en `/oferta/`. Los rescates son `/back1/` (20% de descuento) y `/back2/` (50%).

**Para ver la app como un comprador**, con la vista previa abierta, simulá una compra en otra terminal:

```bash
npm run compra-local -- --funnel peso --nivel t2 --nombre Martín
```

Te imprime el link personal (`http://localhost:4173/app/<acceso>/`). Los datos de prueba quedan en `vista-previa-local/.datos/` (no van al repo).

## Dónde se cambia cada cosa

**Todo lo que es dato real o precio está en `prueba-quiz/src/datos.js`.** Después de cambiarlo, corré `npm run construir`.

- **Precios:** bloque `precios` (principal, back1, back2) y bloque `valor` (la lista del valor tachado; la suma de los ítems tiene que dar el `total`, y hay un test que lo controla).
- **Garantía:** `garantiaDias`.
- **Especialista:** bloque `especialista` (nombre, título, foto, matrícula, universidad, posgrados, resumen). Un campo vacío oculta su pedazo.
- **Cifras y testimonios:** `personas`, `diagnosticos`, `estrellas` y `testimonios`. Se dejan **vacíos** hasta tener datos reales. Mientras estén vacíos, la página no muestra nada de eso.
- **Noticia de la tercera pantalla:** bloque `noticia` (titular, bajada, fuente, enlace e imagen).
- **Links de pago de Hilvapay:** `pagoUrl`, uno por precio (`base` para la oferta, `b1` y `b2` para los rescates). Vacío = el botón no cobra nada y muestra «Todavía no abrimos el pago». Al link se le suman solos el acceso del comprador, el funnel, el nivel, la página y la campaña (ver «Medición y anuncios»).
- **Dirección de la app:** `appUrl` (`/app/`; el botón «Entrar a mi plan» de la página de gracias lleva a `/app/<acceso>/`).
- **Dirección final del sitio:** `sitioUrl` (con `https://` y sin barra final). Con valor, las imágenes para compartir salen con dirección completa, como piden Facebook y WhatsApp.
- **Responsable de los datos:** `responsable` (nombre o razón social; vacío = las legales dicen «el titular de BeastCamp»).
- **Contacto para pedir el borrado de datos o la devolución:** `contacto`.

**Textos del quiz:** `prueba-quiz/src/quiz.js`. **Textos de la oferta y los rescates:** `prueba-quiz/src/oferta.js`. **Gracias:** `prueba-quiz/src/gracias.js`. **Términos y privacidad:** `prueba-quiz/scripts/construir-quiz.mjs`. **Colores y tamaños:** `prueba-quiz/src/base.css`. **Rutinas de la app:** `prueba-quiz/contenido/` (después de cambiarlas, `node prueba-quiz/contenido/exportar.mjs` vuelve a armar `plan-para-revisar.md`). **Textos de la app:** `prueba-quiz/src/app/`.

## Cómo correr los tests

```bash
npm test
```

Incluye tests que abren Chrome y recorren los dos funnels en varios tamaños de pantalla, la app completa (bienvenida, sesión con timer, celebración, progreso, perfil, sin conexión, instalación) y el link de pago con la campaña. Necesitan Chrome o Edge instalado; si no lo encuentran, esos tests se saltean. Si está en otro lugar: `CHROME_PATH="ruta/al/chrome"`. El resto prueba el servicio (avisos de Hilvapay, acceso, progreso, mails y Meta sin salir a internet), el contenido del plan y las reglas de este README.

## Funnel de bajar de peso

Un segundo funnel, para hombres de 30 años o más sin experiencia que quieren bajar de peso con shadowboxing en casa. Mismo producto, mismos precios y **mismo aspecto** que el funnel de peleadores; el de peleadores no cambia.

- **Rutas:** `/quiz-peso/` → `/oferta-peso/` → `/back1-peso/` (20% OFF) → `/back2-peso/` (50% OFF). `/gracias/` y `/legal/*` se comparten.
- **Archivos** (todo en `prueba-quiz/src/peso/`): `quiz-peso.js` (pantallas del quiz), `oferta-peso.js` (oferta y rescates), `calculos-peso.js` (IMC, meta, semanas, fecha y curva), `datos-peso.js` (noticia, fuentes y testimonios), `peso.css` y `peso-oferta.css` (solo lo que el otro funnel no tiene: medidas, barra de IMC, proyección y tarjeta Hoy → Tu meta; todo lo demás sale de `base.css`). Se usan además `datos.js` (precios y garantía), `comun.js` e `ilustraciones.js`, igual que el otro funnel.
- **Qué se ve:** igual que `/quiz/`. Todas las opciones son tarjetas con muñeco 3D (los mismos de `img/`), las pantallas informativas llevan muñecos animados y la oferta tiene los mismos bloques y el mismo orden que `oferta.js` (video, sello, antes/después, pasos, semanas, precio, garantía y preguntas), más la tarjeta Hoy → Tu meta y el gráfico. «¿Cómo ves tu cuerpo hoy?» también lleva muñecos 3D, pero propios: el mismo boxeador en cuatro contexturas (`muneco-c_delgado`, `c_normal`, `c_kilos` y `c_sobrepeso`, generados con IA a partir de uno de los muñecos de `img/`; solo los usa este funnel). `muneco-c_guardia` es `e_guardia` sin la flecha roja. Esas cinco claves no están en `CLAVES_MUNECO` de `ilustraciones.js` (ese archivo es del otro funnel): se muestran con `img3d(clave)`, igual que las demás. Los cinco archivos son obligatorios: sin ellos la pantalla muestra imágenes rotas y los tests fallan.
- **Qué editar:** textos, orden de preguntas y muñeco de cada opción en `quiz-peso.js` (cada opción es `[texto, muñeco, detalle]`; el muñeco es la clave de `img/muneco-<clave>.webp` y no se repite dentro de una pantalla); textos de la oferta en `oferta-peso.js`; precios y garantía siguen en `datos.js`; la noticia, las fuentes citadas y los testimonios en `datos-peso.js` (testimonios vacío = no se ve el bloque; la noticia queda sin titular a propósito, así que esa pantalla no aparece; solo cargar datos reales y con fuente). Después, `npm run construir`.
- **Videos:** primera pantalla `hook`, pantalla de mail `mail` y perfil `oferta`. `espejo` no se usa nunca porque muestra a una mujer. La precarga baja primero las imágenes y después los videos en orden, igual que `/quiz/`.
- **Pantallas a pantalla completa:** `cuerpo` y `meta` son 4 tarjetas altas en 2x2 (muñeco grande arriba y texto abajo, centrados) y `zonas` son 5 filas en una columna con «Continuar» justo encima del pie legal; todas llenan el alto de la ventana sin scroll (se marcan con `alto: true` o `filas: true` en `quiz-peso.js` y su CSS está en `peso.css`). Las demás pantallas de opciones no cambian.
- **Barra fija de la oferta:** en `/oferta-peso/`, `/back1-peso/` y `/back2-peso/` la barra de abajo («Oferta termina en… / Reservar mi lugar») está oculta al cargar y entra recién cuando el borde de abajo del bloque «Por qué te sirve» (`#por-que`) queda dentro de la ventana o por encima; si la persona sube de nuevo por encima de ese punto se esconde. Sin ese bloque se muestra siempre. Con movimiento reducido no se anima.
- **Contador:** `/oferta-peso/`, `/back1-peso/` y `/back2-peso/` llevan el mismo contador que `/oferta/`, `/back1/` y `/back2/` (el de `comun.js`: 10:00, 09:57 y 04:57, que se reinicia solo al llegar a cero), en la barra de arriba y en la barra fija de abajo, con las mismas frases de barra que el funnel de peleadores.
- **Privacidad:** peso, altura, edad y nombre quedan solo en el navegador. Este quiz no manda ningún lead: la pantalla `mail` (nombre interno que se conserva, con su video) pide solo el nombre, opcional y para personalizar el plan, porque el servicio de leads exige un mail y ya no se pide. Lo único que puede salir de estas páginas es el clic de compra de la oferta.
- **Tests:** `tests/quiz-peso.test.ts` (cálculos, rutas, muñecos de cada opción, orden de la oferta y reglas de contenido) y `tests/pantallas-quiz-peso.test.ts` (Chrome: sin scroll en 5 tamaños, tarjetas con muñeco, videos, bloques de la oferta y su contador). Se corren con `npm test`; con `CAPTURAS_DIR=carpeta` guardan capturas con prefijo `peso-`.

## App del comprador (`/app/`)

- **Qué es:** una PWA que se instala en el celu: en Android con el botón de instalar, en iPhone con Compartir → Agregar a inicio. Si la abren desde Instagram o Facebook, avisa que hay que abrirla en Safari o Chrome. Funciona sin conexión con lo que ya cargó.
- **Acceso (como hilvalma):** cada compra tiene un link personal, `/app/<acceso>/`.
  - El acceso se crea en el navegador al tocar «Ir al pago», viaja en el link de Hilvapay y vuelve en el aviso de pago.
  - Hilvapay redirige a `/gracias/`, donde está el botón «Entrar a mi plan», y el servicio manda el mismo link por mail.
  - **Sin compra pagada no hay plan:** el contenido lo entrega el servicio solo a accesos activos.
  - Desde otro celu: `/app/` → «Recuperá tu link», con el mail de la compra.
  - Si en Hilvapay se configuran los avisos de reembolso y disputa, cualquiera de los dos da de baja el acceso.
- **Qué tiene:**
  - bienvenida, con apodo, nivel y aviso de salud;
  - Hoy: sesión del día, racha y semana;
  - Plan: las 4 semanas con los títulos de la oferta y cambio de nivel;
  - sesión guiada con timer de rounds: pitidos, vibración, voz opcional, pantalla siempre prendida y retomar;
  - drills y la guía de guardia y desplazamientos;
  - progreso: racha, calendario de 28 días y puntos;
  - perfil.
- **Ranking:** contra **rivales virtuales** que genera la app, marcados como virtuales. El comprador aparece con su apodo y sus puntos reales. No se muestran otros compradores ni cifras inventadas.
- **Contenido:** sale de `prueba-quiz/contenido/`. Está escrito para BeastCamp y **pendiente de revisión de Néstor J. Medina** (ver `plan-para-revisar.md`). Cada sesión vale sus minutos × 10 puntos, y la racha suma 10 puntos por día seguido, hasta 60.
- **Videos:** cada ejercicio, drill y sección de la guía tiene `video: ''`. Mientras esté vacío, la app muestra el muñeco y las indicaciones. Para cargar uno: subir el mp4 (sin audio, liviano) a `prueba-quiz/sitio/media/app/<id>.mp4`, poner esa ruta en `video` y correr `npm run construir`.
- **Progreso:** se guarda en el celu y se sube al servicio. Así no se pierde al cambiar de celu ni al instalar la app en iPhone, que guarda sus datos aparte de Safari.
- **Archivos:** las fuentes en `prueba-quiz/src/app/` y el caché sin conexión en `sw.js`. `prueba-quiz/scripts/construir-app.mjs` arma `sitio/app/`. Los íconos van en `sitio/img/marca/`.
- **Tests:** `tests/app.test.ts`, `tests/app-logica.test.ts` y `tests/pantallas-app.test.ts`.

## Medición y anuncios

- **URL de cada funnel para los anuncios** (reemplazá `DOMINIO`; Meta agrega el `fbclid` solo):
  - Peleadores: `https://DOMINIO/quiz/?utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}`
  - Bajar de peso: `https://DOMINIO/quiz-peso/?utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}`
- **Campaña:** al entrar se guardan `utm_*`, `fbclid`, `ttclid` y `gclid`, por 30 días, en el navegador (`bc_utm`). Viajan del quiz a la oferta y los rescates, y de ahí al link de Hilvapay.
- **Link de Hilvapay:** lleva `acceso`, `funnel`, `nivel`, `pagina`, `nombre`, `email` (si el quiz lo pidió), `utm_*`, `fbclid`, `fbc`, `ttclid` y `gclid`, solo los que tienen valor. Hilvapay los devuelve en el aviso de pago y al redirigir a `/gracias/`.
- **Clics de compra:** `/api/click` guarda precio, funnel, página y campaña, sin datos personales, en `clicks.jsonl`.
- **Compras:** cada aviso de Hilvapay queda en `compras.jsonl`, con la campaña y la página.
- **Reporte:** `npm run reporte -- --datos <carpeta de datos> [--desde AAAA-MM-DD]`. Muestra clics, compras, reembolsos, ingresos y conversión por funnel, página y campaña.
- **Meta (opcional):** con `META_PIXEL_ID` y `META_CAPI_TOKEN`, el servicio manda `InitiateCheckout` en cada clic de compra y `Purchase` en cada pago, por la Conversions API y desde el servidor. Las páginas no cargan ningún código de Meta.

## Publicar

Todo lo que hay que hacer en el VPS está en [`deploy/README.md`](deploy/README.md):
- nginx con HTTPS (certbot);
- el servicio con systemd y sus variables;
- Hilvapay: links de pago, página de gracias y los tres avisos (pagado, reembolso y disputa);
- Resend, para los mails de acceso;
- Meta.

Antes de salir con anuncios, ver [«Qué falta para salir con anuncios»](#qué-falta-para-salir-con-anuncios), al principio de este README.

Para probar nginx y el servicio juntos en tu compu antes de subirlos, ver [`deploy/prueba-de-humo/`](deploy/prueba-de-humo/), que usa Docker.

## Qué NO hay que tocar

1. **No editar nada dentro de `prueba-quiz/sitio/` a mano** (salvo `media/` e `img/`). Se pisa cada vez que se corre `npm run construir`. Un test falla si las páginas no coinciden con `src/`.
2. **No inventar cifras, estrellas, testimonios ni datos del especialista.** Solo datos reales y verificables. Hay tests que lo controlan.
3. **No cambiar el precio sin cambiarlo también en `prueba-quiz/api/server.mjs`** (lista `PRECIOS`): el servicio rechaza los clics con precios que no conoce. Un test avisa si no coinciden.
4. **No quitar las reglas de seguridad de `nginx.conf`** (CSP; solo GET/HEAD en lo estático y GET/POST/PUT en `/api/`) ni agregar scripts o imágenes de terceros: la página no puede cargar nada de afuera. La CSP permite además `worker-src 'self'` y `manifest-src 'self'`, que son para el service worker y el manifest de la app.
5. **No agregar emojis** (todos los dibujos son imágenes o SVG) ni textos de «prueba» o «ejemplo».
6. **No guardar mails, leads, claves ni archivos `.env`** en el repo (`.gitignore` ya excluye `.env`, `*.jsonl` y `*.log`).
7. **Todas las pantallas del quiz tienen que entrar sin scroll** en celular (360×640) y en compu (1280×600). El test de pantallas lo controla: si agregás contenido, tiene que seguir pasando.
8. **Los links `/app/<acceso>/` son la llave de cada comprador:** no se publican, ni se pegan en anuncios, reportes o capturas.
9. **El formato del plan y del progreso es el mismo en el servicio y en la app:** si se cambia en uno, se cambia en el otro. Hay tests que lo controlan.

## Qué no incluye esta copia

- El servidor ya armado.
- Los certificados.
- Las claves: el token de Hilvapay, la clave de Resend y el token de Meta.
- Los datos de clientes.
- Los scripts para generar imágenes con IA.
- Los videos originales sin reprocesar.
- Las capturas de trabajo de la auditoría y del pulido, unos 190 MB. Se vuelven a sacar con los tests (ver `docs/entrega.md`).
- El historial anterior.

Sí incluye la configuración de nginx y la guía para publicar todo en un VPS (`deploy/`).
