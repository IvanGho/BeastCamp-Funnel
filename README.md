# BeastCamp: quiz y oferta

Quiz de shadowboxing (de la primera pregunta a la oferta) y páginas de oferta. Es un sitio **estático**: HTML, CSS y JavaScript sin frameworks. Hay un servicio chico aparte que guarda el mail y el clic de compra.

## Qué hay en las carpetas

| Carpeta o archivo | Qué es |
|---|---|
| `prueba-quiz/src/` | **El código fuente.** Acá se hacen los cambios. |
| `prueba-quiz/src/datos.js` | Datos reales y precios, todo en un solo lugar. |
| `prueba-quiz/src/quiz.js` | Las pantallas del quiz (preguntas, carga, perfil). |
| `prueba-quiz/src/oferta.js` | Las páginas `/oferta`, `/back1` y `/back2`. |
| `prueba-quiz/src/comun.js` | Cosas compartidas (contadores, pantalla de reserva, bloques de especialista y noticia). |
| `prueba-quiz/src/base.css` | Todos los estilos. |
| `prueba-quiz/src/ilustraciones.js` | Cómo se muestran los muñecos. |
| `prueba-quiz/scripts/construir-quiz.mjs` | Arma las páginas finales a partir de `src/`. |
| `prueba-quiz/sitio/` | **Las páginas ya armadas.** Se generan solas: no se editan a mano. Incluye las figuras (`img/`: las 35 del quiz de peleadores y las 4 propias del funnel de peso) y los videos (`media/`). |
| `prueba-quiz/api/server.mjs` | Servicio que guarda mails y clics (Node, sin dependencias). |
| `prueba-quiz/nginx.conf` | Configuración del servidor web, con las reglas de seguridad. |
| `vista-previa-local/` | Servidor para verlo en tu compu, con datos de relleno. |
| `tests/` | Pruebas automáticas. |

## Cómo correrlo en tu compu

Necesitás [Node.js](https://nodejs.org) 22 o más nuevo.

```bash
npm install
npm run construir        # arma las páginas desde prueba-quiz/src
npm run vista-previa     # abre un servidor en http://localhost:4173
```

Después abrí:

- `http://localhost:4173/quiz/` para ver el quiz como lo ve la gente.
- `http://localhost:4173/quiz/?vista=1` para verlo con **datos de relleno** (cifra de personas, estrellas, testimonios, datos del especialista). Sirve solo para ver cómo queda el diseño completo. `?vista=0` lo apaga.

El quiz termina en `/oferta/`. Los rescates son `/back1/` (20% de descuento) y `/back2/` (50%).

## Dónde se cambia cada cosa

**Todo lo que es dato real o precio está en `prueba-quiz/src/datos.js`.** Después de cambiarlo, corré `npm run construir`.

- **Precios:** bloque `precios` (principal, back1, back2) y bloque `valor` (la lista del valor tachado; la suma de los ítems tiene que dar el `total`, y hay un test que lo controla).
- **Garantía:** `garantiaDias`.
- **Especialista:** bloque `especialista` (nombre, título, foto, matrícula, universidad, posgrados, resumen). Un campo vacío oculta su pedazo.
- **Cifras y testimonios:** `personas`, `diagnosticos`, `estrellas` y `testimonios`. Se dejan **vacíos** hasta tener datos reales. Mientras estén vacíos, la página no muestra nada de eso.
- **Noticia de la tercera pantalla:** bloque `noticia` (titular, bajada, fuente, enlace e imagen).
- **Link de pago:** `pagoUrl`. Vacío = el botón no cobra nada y muestra «Todavía no abrimos el pago».
- **Dirección de la app para el comprador:** `appUrl` (botón «Entrar a mi plan» de la página de gracias).
- **Contacto para pedir el borrado de datos:** `contacto`.

**Textos del quiz:** `prueba-quiz/src/quiz.js`. **Textos de la oferta y los rescates:** `prueba-quiz/src/oferta.js`. **Términos y privacidad:** `prueba-quiz/scripts/construir-quiz.mjs`. **Colores y tamaños:** `prueba-quiz/src/base.css`.

## Cómo correr los tests

```bash
npm test
```

Incluye un test que abre Chrome y recorre todo el quiz en cinco tamaños de pantalla. Necesita Chrome o Edge instalado; si no lo encuentra, ese test se saltea. Si está en otro lugar: `CHROME_PATH="ruta/al/chrome"`.

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

## Qué NO hay que tocar

1. **No editar nada dentro de `prueba-quiz/sitio/` a mano** (salvo `media/` e `img/`). Se pisa cada vez que se corre `npm run construir`. Un test falla si las páginas no coinciden con `src/`.
2. **No inventar cifras, estrellas, testimonios ni datos del especialista.** Solo datos reales y verificables. Hay tests que lo controlan.
3. **No cambiar el precio sin cambiarlo también en `prueba-quiz/api/server.mjs`** (lista `PRECIOS`): el servicio rechaza los clics con precios que no conoce. Un test avisa si no coinciden.
4. **No quitar las reglas de seguridad de `nginx.conf`** (CSP, solo GET/HEAD) ni agregar scripts o imágenes de terceros: la página no puede cargar nada de afuera.
5. **No agregar emojis** (todos los dibujos son imágenes o SVG) ni textos de «prueba» o «ejemplo».
6. **No guardar mails, leads, claves ni archivos `.env`** en el repo (`.gitignore` ya excluye `.env`, `*.jsonl` y `*.log`).
7. **Todas las pantallas del quiz tienen que entrar sin scroll** en celular (360×640) y en compu (1280×600). El test de pantallas lo controla: si agregás contenido, tiene que seguir pasando.

## Qué no incluye esta copia

La infraestructura de publicación (servidor, contenedores, certificados), los scripts para generar imágenes con IA, los videos originales sin reprocesar, el historial anterior y los datos de clientes. El servicio `api/server.mjs` se incluye para entenderlo y probarlo, pero hoy no se ejecuta desde acá.
