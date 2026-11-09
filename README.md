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
| `prueba-quiz/sitio/` | **Las páginas ya armadas.** Se generan solas: no se editan a mano. Incluye las 35 figuras (`img/`) y los videos (`media/`). |
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
