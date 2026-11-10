# Auditoría visual de los dos funnels (peleadores y bajar de peso)

## Estado después del pulido

La auditoría encontró 6 problemas para corregir (P1), 14 que convenía corregir (P2) y detalles (P3). El pulido (commit `b1f4ef0`) corrigió casi todo. Lo que quedó abierto también está en el README, en «Qué falta para salir con anuncios».

| Punto | Estado |
|---|---|
| P1-1 a P1-5 | Corregidos. En contraste solo quedaron sin tocar las estrellas decorativas y el botón «Continuar» deshabilitado. |
| P1-6. Muñecos de las medidas blandos | Mejorado: el muñeco tiene un tope de tamaño y una versión `@2x` (720×960) hecha con el mismo archivo. Para que quede nítido de verdad hay que generarlo de nuevo (`docs/pendientes-imagenes.md`, punto 2). |
| P2-1 a P2-7, P2-9 y P2-12 a P2-14 | Corregidos. |
| P2-8. Video de escritorio | En parte: en la compu, con ventanas de más de 700 px de alto, el video va en un recuadro redondeado de hasta 640 px; en ventanas más bajas sigue ocupando todo el alto. Se dejó el filtro de color del video para no cambiar cómo se ve. |
| P2-10. Poco aire sobre el pie en 360×640 | Sin cambios: con más margen, el perfil se quedaba sin lugar en 425×812. |
| P2-11. Muñecos propios del funnel de peso | Pendiente: hay que generarlos de nuevo (`docs/pendientes-imagenes.md`, punto 1). |
| P3-2, P3-4 a P3-6, P3-8, P3-11 y P3-14 a P3-16 | Corregidos. |
| P3-3. La barra de progreso y la franja de video animan ancho y alto | Sin cambios. La auditoría midió 60 fps sin caídas con la CPU a 4x. |
| P3-7. Salto del aviso al escribir el peso | En parte: en 360×640, con un peso bajo, queda un salto chico (CLS 0,039). Reservar más alto achicaría el muñeco. |
| P3-9 y P3-10. Muñecos que no cuentan lo mismo que su texto | Se dejaron así a propósito: los eligió el dueño del proyecto. |
| P3-12, P3-13 y P3-18 | Corregidos en otros commits: íconos de la marca, caché de 30 días en `nginx.conf` y `appUrl: '/app/'`. |
| P3-20 | No hacía falta cambiar nada. |

Después del pulido, Lighthouse da 100 en accesibilidad en los dos quiz, las dos ofertas y la app (ver `docs/entrega.md`).

---

Se auditó el repo en el commit `4d4a435` (10/11/2026), con la vista previa local y siempre con `?vista=1` (datos de relleno). Las líneas de código que se citan son de ese commit: con el pulido cambiaron.

## Cómo se midió

- Chrome real (playwright-core). Recorrido completo, pantalla por pantalla, de `/quiz/` → `/oferta/` → `/back1/` → `/back2/` y de `/quiz-peso/` → `/oferta-peso/` → `/back1-peso/` → `/back2-peso/`, más `/gracias/` y `/legal/*`. Seis tamaños: 360×640 (dpr 3), 390×844 (dpr 3), 412×915 (dpr 2,625), 768×1024 (dpr 2), 1280×600 y 1280×800 (dpr 1). Los tres primeros con `isMobile` y `hasTouch`.
- En peso se escribieron altura, peso y meta, con casos extra: altura 90 (error), peso 300 (error), 95 (obesidad, aviso), 55 (bajo peso, bloquea), 84 (sobrepeso, ok), meta 84 (igual al peso), 50 (muy baja) y 74 (ok).
- Capturas: `capturas/<funnel>-<tamaño>-<pantalla>.png`, con `<funnel>` = `pel` (peleadores) o `peso`. Son 707 PNG a tamaño CSS (67 MB). Las ofertas están sacadas por tramos de scroll (`oferta-00`, `-01`… `-fin`) y con la hoja de reserva (`-reservar`). Capturas del foco con Tab: `*-tab-*`. **No están en el repo** (con los datos crudos pesan 87 MB). Los tests de pantallas sacan capturas nuevas con `CAPTURAS_DIR=carpeta` (ver el README).
- Datos crudos: `datos/<funnel>-<tamaño>.json` (cada pantalla con todas las medidas), `datos/extras.json` (aire vacío, márgenes de texto en tarjetas), `datos/coherencia.json` (estilos por pantalla), `datos/tab-*.txt` (orden y foco de Tab), `datos/reducido-*.json` (animaciones con movimiento reducido), `datos/jank-*.txt` (fotogramas), `datos/mediciones-extra.txt` (CLS del brillo, barra fija, contador, LCP, teclado). Hojas de contacto en `datos/hojas/`. Scripts en `herr/`. Tampoco están en el repo.
- En ese momento la vista previa no traía el servicio y devolvía 404 en `/api/lead` (esperado) y en `/favicon.ico` (hallazgo P3-12). Hoy `npm run vista-previa` incluye el servicio.

## Lo que está bien (para no tocarlo)

- Sin scroll horizontal en ninguna pantalla, en ningún tamaño, en ningún funnel.
- Sin scroll vertical en las pantallas del quiz en los seis tamaños, salvo una excepción (P1-3).
- Sin elementos que se pisen, sin texto cortado, sin imágenes rotas (240 combinaciones imagen/tamaño medidas), todas las `<img>` con `width`/`height`, todos los muñecos son WebP.
- La barra fija de peso y el contador se comportan como dice el README (apéndice A).
- Fotogramas: 60 fps sin caídas con la CPU a 4× en las pantallas animadas y en el scroll de las ofertas (`datos/jank-*.txt`). Los problemas de movimiento son de CLS y de `prefers-reduced-motion`, no de fluidez.
- LCP de la primera pantalla: 680 ms (peleadores) y 892 ms (peso) en 4G lento con CPU 4×; el elemento es el póster `hook.jpg`, precargado con `fetchpriority="high"`. Nada que corregir.

---

# P1: hay que corregir

## P1-1. El brillo del botón anima `left` (cuesta layout, genera CLS sin parar y no respeta movimiento reducido)

- Funnel y pantalla: los dos, todas las pantallas con botón verde (`.cta`) y las barras fijas de oferta.
- Tamaños: todos.
- Evidencia:
  - `.cta:after` anima `left` en un `@keyframes` infinito (`base.css:56-57`). `document.getAnimations()` lista `CSSAnimation:brillo:left ::after` (1 en las pantallas del quiz, 2 en las ofertas: botón y barra fija).
  - Quieto 12 s en `/oferta/` a 390×844: 174 entradas de layout-shift, CLS 0,0226. Con `.cta:after{animation:none}`: 0 entradas, CLS 0,0000 (`datos/mediciones-extra.txt`). En el recorrido el CLS de las pantallas quietas sube de a 0,0007 a 0,0107 solo por esto (`datos/*.json`, campo `clsTotal`).
  - Con `prefers-reduced-motion: reduce` el brillo sigue animando: la regla `*{animation:none!important}` (`base.css:110`) no alcanza a los pseudoelementos. Medido con `reducedMotion:'reduce'`: `CSSAnimation:brillo ::after` vivo en las 6 pantallas con botón de peleadores (de 13), en las 11 de peso (de 24) y en las 6 ofertas; es lo único que sigue animado (`datos/reducido-*.json`). Todo lo demás sí se frena.
  - Captura: `pel-390x844-oferta-02.png` (el reflejo a mitad del botón).
- Corrección: `prueba-quiz/src/base.css`.
  - Líneas 56-57: `.cta:after{...;left:0;transform:translateX(-150%) skewX(-20deg);animation:brillo 3.2s infinite}` y `@keyframes brillo{0%{transform:translateX(-150%) skewX(-20deg)}60%,100%{transform:translateX(350%) skewX(-20deg)}}`. Con `width:40%`, −150% y +350% del propio ancho equivalen a los −60% y +140% de ahora. Solo transform: no hay layout ni CLS.
  - Línea 110: `@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}`.

## P1-2. Salto de diseño de 0,17 al entrar al perfil (la franja de video crece y empuja todo)

- Funnel y pantalla: los dos, pantalla `perfil` (la que viene después de la carga).
- Tamaños: 360×640 (0,181), 390×844 (0,172), 412×915 (0,171), 768×1024 (0,112), 1280×600 (0,184) y 1280×800 (0,184). Es más que el umbral de 0,1 de CLS «bueno».
- Evidencia:
  - Los `layout-shift` de la pantalla dicen `MAIN [0,0,390,507 → 0,133,390,711]`: en celular el contenido baja 133 px en 390×844 (102 px en 360×640, 143 px en 412×915); en escritorio `main` salta de centro a la columna derecha cuando aparece el video de la izquierda. Causa: la pantalla `carga` quita la franja de video (`#bg` vuelve a altura 0) y `perfil` la vuelve a poner con `transition:height .35s` (`base.css:11`).
  - Se muestrea `main.top` cada 16 ms: pasa de 0 a 133 al entrar al mail y de 133 a 0 al entrar a la carga (`datos/mediciones-extra.txt`). Esos dos saltos no aparecen en el CLS medido (probablemente porque vienen justo después de un toque, `hadRecentInput`), pero se ven igual. El de la carga al perfil sí cuenta: es automático.
  - Capturas: `pel-390x844-12-prueba-estamos-preparando-tu-inicio.png` (sin franja) y `pel-390x844-13-prueba-asi-queda-tu.png` (con franja). Peso: `peso-390x844-23-…` y `-24-…`.
- Corrección: dejar la franja puesta durante la carga, para que el único cambio sea de video y no de altura.
  - `prueba-quiz/src/quiz.js:92` y `prueba-quiz/src/peso/quiz-peso.js:236`: reemplazar `setBg(x.video);` por `if (x.t !== 'carga') setBg(x.video);`.
  - Así la carga conserva la franja (y el video de `mail`, que ya está reproduciéndose) y `perfil` solo cambia el video.
  - Opcional: `base.css:11` quitar `transition:height .35s` en celular, para que los saltos del toque (experto → mail → carga) tampoco se animen como empujón.

## P1-3. Perfil de peso con scroll en 360×640 y el botón pisando el pie legal

- Funnel y pantalla: peso, `/quiz-peso/` pantalla `perfil` («Prueba, así queda tu plan»).
- Tamaños: 360×640 (el README exige «sin scroll» en 360×640 y 1280×600).
- Evidencia: `scrollY = 11 px`; `button#ver` se mete 9 px en el texto del pie legal (`PISADOS button#ver.cta X footer.ft: 328x9px`). Captura: `peso-360x640-24-prueba-asi-queda-tu.png` y `datos/peso-360x640.json`. En los otros cinco tamaños no hay scroll. `peso.css:111-114` ya admite esto («si no entra, la página crece»), pero choca con la regla 7 del README.
- Corrección: ganar ≥ 11 px.
  - `prueba-quiz/src/peso/quiz-peso.js:171`: `window.innerHeight < 700 ? 106 : 134` → `window.innerHeight < 700 ? 90 : 134` (el gráfico baja ~16 px).
  - Si no alcanza: en `peso.css`, dentro de `@media(max-height:700px)`, `.nota-est{font-size:10.5px;line-height:1.3}` (hoy 11 px, línea 1.33).
  - Verificar con la prueba existente (`tests/pantallas-quiz-peso.test.ts`).

## P1-4. En las ofertas el pie legal queda tapado por la barra fija o encimado sobre el texto

- Funnel y pantalla: los dos, `/oferta/`, `/back1/`, `/back2/` y las tres de peso.
- Tamaños: todos.
- Evidencia:
  - El pie es `position:fixed` y la barra de abajo (`.sticky`) tiene `z-index:40` contra `20` del pie (`base.css:24` y `:106`). En peleadores la barra está siempre → los enlaces «Términos y condiciones» y «Política de privacidad» no se ven en ningún momento de la oferta (por ejemplo 390×844: barra desde y=745, pie desde y=782; capturas `pel-390x844-oferta-04-fin.png` y `pel-390x844-back2-04-fin.png`).
  - En peso la barra está oculta durante los primeros 2/3 de la página: ahí el pie fijo se dibuja encima del contenido que pasa por abajo (texto contra texto; capturas `peso-390x844-oferta-00.png` a `-03.png`, el gráfico y la lista «Qué incluye» pisados por «Términos y condiciones…») y después, cuando entra la barra, desaparece como en peleadores.
  - Con Tab, el foco llega a los enlaces del pie estando tapados por la barra (`datos/tab-peleadores.txt`, `/oferta/`: pasos 7 y 8; en peso, 21 y 22).
  - Importa: son las páginas de pago y los enlaces legales son el único acceso a términos y privacidad.
- Corrección:
  - `prueba-quiz/src/comun.js:43` (`pie()`), `prueba-quiz/src/peso/oferta-peso.js:166-172` (`piePesoOferta()`) y las llamadas `oferta.js:72` / `oferta-peso.js:173`: en las ofertas, colocar el pie al final del documento dentro de `#app` (después de «Pago único, sin suscripción»), no fijo.
  - Clase nueva `.ft.fin` en `base.css`: `position:static;background:none;pointer-events:auto;padding:18px 16px 24px`. `.oferta-main` ya reserva 140 px abajo (`base.css:108`), así que no lo tapa la barra al llegar al final.
  - En el quiz el pie fijo se queda como está.

## P1-5. Contraste del botón principal y del verde sobre blanco (WCAG AA)

- Funnel y pantalla: los dos, todas las pantallas con botón (`.cta`), barra fija, `.tag`, «Semana N», precios de rescate, contador de la barra fija, etiquetas verdes.
- Tamaños: todos.
- Evidencia (calculado con la luminancia WCAG, sobre el color real compuesto; `datos/*.json → contrastes`):

| Combinación | Contraste | Mínimo | Dónde |
|---|---|---|---|
| Blanco sobre degradado `#1fbf5b → #16A34A` (17 px/800) | 2,42:1 (3,30:1 en el extremo oscuro) | 4,5 | «Seguir», «Continuar», «Ver mi plan», «QUIERO MI PLAN…» en todas las pantallas |
| Blanco sobre el mismo degradado, 13 px/600 | 2,26:1 | 4,5 | «Empezar hoy mismo» / «Empezar hoy por…» bajo el botón de oferta |
| `#16A34A` sobre blanco/`#f4f7f5` | 3,30:1 / 3,06:1 | 4,5 | `.tag` («Tu perfil», «Último paso»), «Semana 1-4», contador de la barra fija, precio de rescate, «Garantía de devolución · 30 días» |
| `#16A34A` sobre `#f0fdf4`, 10,8 px/800 | 3,15:1 | 4,5 | «CON BEASTCAMP» |
| `#8a948d` sobre blanco, 10-11,5 px | 3,13:1 | 4,5 | pie legal, citas de fuente («Fuente:», «Sports (MDPI)…») |
| `#9aa49d` sobre blanco, 15 px | 2,57:1 | 4,5 | pasos de la carga que aún no se hicieron |
| `#854d0e` con opacidad .8 sobre `#fffbe6`, 11,5 px | 4,2:1 | 4,5 | «El IMC es una referencia general.» (aviso amarillo) |

  Pasan: `--m #5b665e` sobre blanco (5,99:1) y sobre `#f4f7f5` (5,55:1), `--gd #15803d` sobre blanco (5,02:1), sobre `#f4f7f5` (4,65:1) y sobre `#f0fdf4` (4,79:1). Se salvan por ser grandes: `.big` (46 px), el «JM» del avatar.
- Corrección: `prueba-quiz/src/base.css`.
  - Línea 55 (`.cta`): `background:linear-gradient(180deg,#15803d,#14773a)` (blanco 5,02 → 5,63:1) y, si se quiere conservar el verde de marca en el botón, `font-size:19px` (≥ 18,66 px en negrita cuenta como «grande» y exige 3:1; con `#16A34A → #15803d` queda en 3,3-5,0:1). Cambiar también la sombra a `rgba(21,128,61,.3)`.
  - Texto verde sobre claro: `.tag` (línea 29), `.sem b`, `.badge`, `.sticky b` (línea 107), `.pill`: usar `var(--gd)` (`#15803d`) en vez de `var(--g)`. Más `.tag`/«Semana» en `peso-oferta.css` si repiten.
  - Línea 24 (`.ft`): `color:#5b665e` y `.ft a{color:#5b665e}`; `.cita`, `.nota .fu`, `.nota-est a` (`peso.css:71-72,100`) de `#8a948d`/`#6b756e` a `#5b665e`.
  - Línea 89 (`.chkl`): `color:#6b756e`.
  - `peso.css:50` (`.msg small`): quitar `opacity:.8` o subir a `.9`.
  - Los muñecos y las estrellas decorativas (`.estr` `#f5a623` a 1,9:1) son decorativos: el texto de al lado dice lo mismo, se dejan.

## P1-6. Muñecos de las pantallas de altura, peso y meta salen blandos (estirados ~2,7×)

- Funnel y pantalla: peso, `medida` (altura, peso y meta, tres pantallas seguidas; muñecos `c_guardia`, `o_peso`, `o_tecnica`).
- Tamaños: 360×640, 390×844, 412×915 y 768×1024 (en 1280 el muñeco queda a 1:1, nítido).
- Evidencia: los archivos son 360×480. En `.scr.fijo .mu` (`peso.css:75-76`) el muñeco crece hasta 440 px de alto. Se dibuja a 428 px de alto en 390×844 (dpr 3 → hacen falta 1284 px reales y hay 480: factor de nitidez 0,37, o sea 37% de la resolución del pantalla), 440 px en 412×915 (0,42), 440 px en 768×1024 (0,55) y 261 px en 360×640 (0,61). Capturas: `peso-390x844-17-cuanto-medis-175.png`, `peso-390x844-18-cuanto-pesas-84.png`, `peso-390x844-19-a-que-peso-te-74.png`. En las otras pantallas de peso y en todo peleadores el muñeco se dibuja ≤ 205 px de alto (nitidez ≥ 0,78 y casi siempre > 1,5), sin problema.
- Corrección (no se pueden generar imágenes; esto usa las que hay): `prueba-quiz/src/peso/peso.css:75`, regla `.scr.fijo .mu`: `max-height:440px` → `max-height:min(300px,34dvh)`. A 300 px: 0,53 en dpr 3 y 0,71 en 412×915; con 240 px sube a 0,67-0,8. El campo y el botón quedan más cerca del título y el sobrante lo toman los márgenes `auto`, como ya hace la regla. El README (`peso.css:73`) dice que el muñeco ocupa el alto que sobra: se cambia ese tope. Ver sección de imágenes para la alternativa de remuestrear.

---

# P2: conviene corregir

## P2-1. En celular, las pantallas sin video quedan pegadas arriba y dejan 35 a 60% de la pantalla vacía

- Funnel y pantalla: los dos. Pantallas de opciones sin `alto/filas/fijo`: peleadores `nivel`, `lograr`, `entrenar mal`, `noticia`, `dónde`, `tiempo`, `precio`, `experto`; peso `exp`, `escaleras`, `día`, `sueño`, `tiempo`, `precio`, `evento`.
- Tamaños: 360×640, 390×844 y 412×915. En 1280 está centrado (`gridTemplateRows` de una sola fila).
- Evidencia: `datos/extras.json` → `vacioInf` (px entre el final del contenido y el pie legal): peleadores 412×915 `nivel` 418 px, `precio` 457 px; peso 412×915 `evento` 541 px, `día` 485 px; en 360×640 `precio` 272 px, `evento` 330 px. Causa medida: `.shell` tiene filas `auto 1fr` y, cuando `#bg` está `display:none` (`base.css:10` y la regla `.shell:not(.conbg) #bg{display:none}`), `main` cae en la fila `auto`; la fila `1fr` queda vacía (`gridTemplateRows: 419px 221px` con `main` de 419 px). Por eso en celular el contenido no se centra aunque `main` tenga `justify-content:center`. Capturas: `pel-412x915-02-cual-es-tu-nivel.png`, `peso-412x915-20-tenes-algo-importante-en.png`, `peso-412x915-15-cuanto-tiempo-le-podes.png`.
  - Además mezcla dos estilos en peso: unas pantallas llenan todo el alto (cuerpo, meta, zonas…) y otras son compactas arriba.
- Corrección: `prueba-quiz/src/base.css:10`, agregar `.shell:not(.conbg){grid-template-rows:1fr}` (peso ya lo hace para `.shell.alto`). Queda centrado verticalmente. Si se prefiere llenar como en las demás pantallas de peso, agregar `min-height` a `.c` con `dvh` en esas pantallas (`.scr:not(.alto):not(.filas) .c{min-height:clamp(96px,19dvh,200px)}`); la primera opción es más barata y no cambia nada que ya entre.

## P2-2. El foco se pierde en cada cambio de pantalla y no hay anuncio para lectores de pantalla

- Funnel y pantalla: los dos, todo el quiz.
- Tamaños: todos (teclado y lector de pantalla).
- Evidencia: `datos/mediciones-extra.txt`. Tras Enter en una tarjeta la pantalla cambia pero `document.activeElement` queda en `BODY`. `#app` no tiene `aria-live`; hay 1 `main` y 0 `h1` (cada pantalla usa `h2`). En peso, en las pantallas de altura/peso/meta el primer Tab cae en «Términos y condiciones» y no en el campo (`datos/tab-peso.txt`, pantallas 17-19, pasos 1-2).
- Corrección: `prueba-quiz/src/quiz.js` (`dibuja()`, tras `raiz.innerHTML = …`, línea ~120) y `prueba-quiz/src/peso/quiz-peso.js` (idem): dar `tabindex="-1"` al `h2` de la pantalla y llamar `h.focus({preventScroll:true})`, y poner `aria-live="polite"` en `#app`. En las pantallas de medida, enfocar `#n` con `{preventScroll:true}` solo si `matchMedia('(hover:hover)').matches` (en celular enfocar abre el teclado y tapa la pantalla). Convertir el `h2` de cada pantalla en `h1` (el CSS de `h1` es 28 px; mantener 23 px con `.scr h1{font-size:23px;margin:4px 0 6px;text-align:center}` si se quiere el mismo aspecto).

## P2-3. Campos de texto sin `label` ni `aria-label`

- Funnel y pantalla: peleadores `mail` (`#nm`, `#m`) y peso `mail` (`#nm`).
- Tamaños: todos.
- Evidencia: `datos/*.json → campos`: `label:null, aria:null` (solo `placeholder`). Los campos numéricos de peso sí tienen `aria-label` y `inputmode="numeric"`.
- Corrección: `prueba-quiz/src/quiz.js` (pantalla `mail`) y `prueba-quiz/src/peso/quiz-peso.js:269`: agregar `aria-label="Tu nombre o apodo"` a `#nm` y `aria-label="Tu mail"` a `#m` (más `inputmode="email"` en `#m`). El borde rojo del mail inválido (`quiz.js:~156`, `e.style.borderColor='#dc2626'`) no dice por qué: sumar `aria-invalid="true"` y un `<p id="mailerr" role="alert">` («Revisá el mail») bajo el campo.

## P2-4. Foco visible débil en los campos y ninguno propio del diseño

- Funnel y pantalla: los dos, `#nm`, `#m` y `#n`.
- Tamaños: todos.
- Evidencia: `base.css:62` `input:focus{outline:0;border-color:var(--g)}`: con teclado solo cambia el borde de `#dfe6e1` a `#16A34A` (3,3:1 contra blanco). El resto (tarjetas, botones, enlaces, `summary`) usa el anillo por defecto de Chrome (`outline:auto 1px`, azul `rgb(0,95,204)`): visible sobre fondo claro pero fino sobre el botón verde (`datos/tab-*.txt`).
- Corrección: `base.css`, una regla única: `:focus-visible{outline:3px solid #14773a;outline-offset:2px}` y `.cta:focus-visible{outline-color:#0b0f0c}`; y en `input:focus` mantener el borde pero sin `outline:0` (`input:focus-visible{outline:3px solid #14773a;outline-offset:2px}`).

## P2-5. Zonas táctiles chicas: enlaces legales, fuentes y preguntas frecuentes

- Funnel y pantalla: los dos. Pie legal (13 px de alto, texto de 10 px) en todas las pantallas; `summary` de las preguntas frecuentes (21 px de alto, 298-474 px de ancho) en las seis ofertas; enlaces «Ver el estudio» (peleadores `noticia`, 60×13) y «Volpi, Nazemi y Fujita» / «CDC» (peso, 24×13).
- Tamaños: todos.
- Evidencia: `datos/*.json → tactil`. Los botones, tarjetas, campos y botones de los pop-ups sí miden ≥ 44 px.
- Corrección: `base.css`.
  - Línea 25: `.ft a{display:inline-block;padding:8px 2px}` y subir `.ft` a `font-size:11px`; con 3 líneas el pie ocupa 63 px y el `padding-bottom` de `main` (66 px) alcanza: verificar con la prueba (si no, `--pie` en peso.css se recalcula solo).
  - Línea 104: `.faq summary{padding:12px 0}` (resulta de 44 px).
  - Enlaces de fuente (`.cita a`, `.nota .fu a`, `.nota-est a`): `padding:10px 0;display:inline-block`.

## P2-6. El texto de «Arranque / Ritmo / Impulso» se corta en medio del rango

- Funnel y pantalla: peleadores `tiempo` (4 tarjetas) y peso `tiempo` (3 tarjetas).
- Tamaños: 360×640, 390×844 y 412×915 (en 1280×600 entra en una línea; 768×1024 no se midió con este chequeo).
- Evidencia: el `small` de la tarjeta pasa a dos líneas y parte «2-3 días · 15-» / «30 min» (`datos/extras.json → small>1linea`: 4 de 4 y 3 de 3). Captura: `pel-412x915-08-cuanto-queres-dedicarle-por.png`, `peso-412x915-15-cuanto-tiempo-le-podes.png`.
- Corrección: `prueba-quiz/src/quiz.js:17` y las equivalentes en `peso/quiz-peso.js`: escribir el detalle con espacios duros y guión no cortable, por ejemplo `'2‑3 días · 15‑30 min'` con U+2011 (guión que no corta) y ` ` alrededor del `·`; o en `tarjeta()` separar en dos líneas con `<br>` («2-3 días» / «15-30 min»).

## P2-7. Texto casi a ras del borde de la tarjeta en 360×640

- Funnel y pantalla: peleadores `nivel` («Estoy empezando»), peso `edad`.
- Tamaños: 360×640.
- Evidencia: margen entre el texto y el borde interior de la tarjeta: −1,4 px en `nivel` («empezando» se mete en el borde), 5,8 px en el hook (`datos/extras.json → margenTextoMin`). Captura: `pel-360x640-02-cual-es-tu-nivel.png`.
- Corrección: `base.css`, `.c:has(img.im3d){padding:4px 8px 4px 4px}` → `padding:4px 12px 4px 4px` y `.c b{overflow-wrap:anywhere}`; o bajar `.c img.im3d{max-width:48%}` a `max-width:44%`.

## P2-8. Video de escritorio: 960×540 estirado en una columna de 640×alto y mucho recorte

- Funnel y pantalla: los dos, `hook`, `mail`, `perfil` (peleadores: `espejo`; peso: `oferta`).
- Tamaños: 768×1024 y 1280×600 / 1280×800 (en celular la franja es de 127 px de alto y el video no se nota blando).
- Evidencia: `.shell.conbg #bg{height:100dvh}` en columna de 640 px (`base.css:12-16`): `object-fit:cover` de un 960×540 en 640×800 lo escala 1,48× (2,96× en pantalla retina) y deja ver 43% del ancho. Con el póster (480×270, 2,96× a 1×; mientras no arranca) se ve peor. Capturas: `peso-1280x800-24-prueba-asi-queda-tu.png` (pixelado), `pel-1280x600-01-que-te-pasa-mas.png`. En celular la franja (390×127) recorta la cara a los ojos: `pel-360x640-01-que-te-pasa-mas.png`.
- Corrección (sin generar videos nuevos): `base.css`.
  - En escritorio limitar la altura del video a un recuadro 4:5: `@media(min-width:900px){.shell.conbg #bg{height:min(100dvh,640px);align-self:center;margin:auto 0;border-radius:var(--r)}}` con `#bg video{object-position:50% 35%}` y quitar el degradado lateral (`#bg:after`) o mantenerlo; escala máxima 1,18×.
  - Quitar `filter:saturate(1.15) contrast(1.03)` de `#bg video` (línea 12): fuerza un paso de composición por cuadro; el brillo se obtiene con el color del póster.
  - En celular, `#bg video{object-position:50% 30%}` para que la franja muestre la cara.

## P2-9. Barra fija de oferta gigante en escritorio

- Funnel y pantalla: los dos, `/oferta/`, `/back1/`, `/back2/` y las tres de peso.
- Tamaños: 768×1024, 1280×600 y 1280×800.
- Evidencia: `.sticky` ocupa todo el ancho (`left:0;right:0`) y el botón «Reservar mi lugar» mide 1143×56 px con «Oferta termina en 09:58» pegado a la izquierda, mientras la página es una columna de 520 px. Captura: `pel-1280x800-oferta-00.png`, `peso-1280x800-oferta-02.png`.
- Corrección: `base.css:106`, agregar `.sticky{justify-content:center}` y `.sticky .cta{flex:0 1 360px}` y, dentro de `@media(min-width:900px)`, `.sticky{padding-left:calc(50% - 260px);padding-right:calc(50% - 260px)}` para que la barra caiga sobre la columna.

## P2-10. Perfil de peleadores y primeras pantallas: el pie de 3 líneas deja solo 17-23 px de aire

- Funnel y pantalla: los dos, pantallas llenas (`cuerpo`, `meta`, `zonas`, `forma`, `actividad`, `causas`, `frenos`, medidas, perfil).
- Tamaños: 360×640 sobre todo.
- Evidencia: `vacioInf` 17-23 px en esas pantallas (`datos/extras.json`): el botón o las tarjetas quedan a 17 px del texto del pie, sin margen de respiro; con el pie en 2 líneas en pantallas anchas sobran. No es un error (no se pisan) pero queda ajustado.
- Corrección: `base.css:24` y `peso.css` (`padding-bottom:calc(var(--pie,64px) + 2px)`): `+ 2px` → `+ 6px`. Solo si P1-3 deja margen (si 360×640 se queda justo, no se toca).

## P2-11. Muñecos propios de peso: persona, escala y posición que no calzan con los otros 35

- Funnel y pantalla: peso, `cuerpo` (los cuatro `c_*`), `zonas` (`c_guardia` en «Los costados»), `altura` (`c_guardia`).
- Tamaños: todos.
- Evidencia y corrección: en `docs/pendientes-imagenes.md`, punto 1. Resumen: los cinco están centrados en el lienzo (pies a x = 172-177 de 360) y los otros 35 están corridos a la izquierda (pies a x = 118-182, promedio 131), la piel es más pálida (G +9, B +14 en promedio), la sombra es 27% menor y no llega al borde, y el gesto es neutro en vez de la mueca de pelea. Al pasar de `altura` (`c_guardia`) a `peso` (`o_peso`) la figura da un salto lateral de unos 40 px.

## P2-12. Tono distinto entre el funnel de peso y el de peleadores, y entre pantallas del mismo funnel

- Funnel y pantalla: peso (casi todo) y peleadores (`experto`, `mail`, `oferta`).
- Tamaños: no aplica.
- Evidencia (textos):
  - Peso `experto` dice «Tu análisis está casi listo» y la pantalla siguiente (`mail`) dice «Tu plan está casi listo»: dos «casi listo» seguidos. La tarjeta del especialista, común a los dos, habla de «diagnósticos realizados». Peleadores usa «diagnóstico» de punta a punta («Generar mi diagnóstico →»).
  - Botones del mismo paso: peleadores «Generar mi diagnóstico →» / «Quiero mi plan»; peso «Ver mi análisis →» / «Ver mi plan».
  - Vocabulario: peleadores dice «Rounds completos de 3 minutos», «Esquivas y sombra», «Drills y ranking»; peso mezcla «Timer de rounds» (qué incluye, cómo funciona) con «Rondas completas de 3 minutos, con descanso» y «Boxeo al aire».
  - «Prueba, estamos preparando tu plan» / «Prueba, así queda tu plan» y «Listo, Prueba» muestran el nombre de prueba de este recorrido; sin nombre cae a «Campeón» en peleadores y a «Tu plan» en peso (`quiz.js:~170`, `peso/quiz-peso.js:~380`); en peso «Campeón» se usa en la carga y puede chocar con el tono (hombres de 30+ que quieren bajar de peso).
  - Sellos de la oferta: peleadores «Rutinas probadas por profesionales, semiprofesionales y amateurs» / peso «Hecho para arrancar de cero».
- Corrección: decidir un solo vocabulario. Propuesta mínima: en `peso/quiz-peso.js:268` título de `experto` → «Tu plan personalizado está en marcha» y chip «análisis» → «diagnósticos» (o dejar «análisis» en toda la pantalla y pasar el chip a «análisis realizados» en `comun.js:~78`); `oferta-peso.js` «Rondas completas» → «Rounds completos» (igual que peleadores) y «Boxeo al aire» → «Sombra» solo si el vocabulario de peleadores es el elegido; «Campeón» → «Vos» en peso.

## P2-13. Hojas de «Reservá tu lugar»: caja vacía

- Funnel y pantalla: los dos, hoja `reservar` de las tres ofertas.
- Tamaños: todos.
- Evidencia: `<div class="box" id="pg"></div>` (`comun.js:~92`) se dibuja vacía entre el resumen y «Ir al pago» (captura `pel-390x844-oferta-reservar.png`, `peso-390x844-oferta-reservar.png`): una píldora gris sin contenido de 29 px.
- Corrección: `prueba-quiz/src/comun.js` (`reservar()`): `<div class="box" id="pg" hidden></div>` y que `pagar()` quite `hidden` al escribir el mensaje; o CSS `#pg:empty{display:none}`.

## P2-14. Franja del contador pegada arriba deja asomar texto 6 px por encima

- Funnel y pantalla: los dos, ofertas, al hacer scroll.
- Tamaños: todos.
- Evidencia: `.tbar` es `position:sticky;top:6px` (`base.css:95`): el contenido que pasa por detrás se ve en la franja de 6 px por encima de la barra negra. Captura: `pel-390x844-oferta-02.png`, `pel-1280x600-oferta-01.png` («semiprofesionales y amateurs» asomando).
- Corrección: `base.css:95`, `.tbar{top:0;border-radius:0 0 12px 12px;padding-top:15px}` o `.tbar{box-shadow:0 -6px 0 #fff}` (tapa los 6 px con blanco).

---

# P3: detalle

- **P3-2. `transition` genérico.** `.c{transition:.15s}` (`base.css:43`), `.sale{transition:.16s}` (`:65`), `.chkl{transition:.3s}` (`:89`), `.toast{transition:.3s}` (`:159`) equivalen a `transition:all`. Escribir las propiedades: `.c{transition:border-color .15s,box-shadow .15s,transform .15s}`, `.sale{transition:opacity .16s,transform .16s}`, `.chkl{transition:color .3s}`, `.toast{transition:opacity .3s,transform .3s}`.
- **P3-3. Propiedades de layout animadas.** `#bg{transition:height .35s}` (`:11`, ver P1-2) y `.prog i{transition:width .5s}` (`:8`): la barra puede ir con `transform:scaleX()` y `transform-origin:left` (`quiz.js:81`/`quiz-peso.js:~140` ponen `style.width`).
- **P3-4. `:hover` pegado en táctil.** `.c:hover{transform:translateY(-2px);…}` (`:44`) queda aplicado tras tocar. Envolver en `@media(hover:hover)`. Se ve como tarjeta verde levantada en las capturas de varias pantallas de peso.
- **P3-5. Barra fija con `padding-bottom:34px` fijo** (`base.css:106`): sobran 34 px en Android/escritorio (la barra mide 93-99 px). Usar `padding-bottom:max(10px,env(safe-area-inset-bottom))` y `viewport-fit=cover` en el `<meta viewport>` (`construir-quiz.mjs`).
- **P3-6. Toast encima del título durante la carga** (`.toast{top:22px}`): tapa «Prueba, estamos preparando tu plan» 1,7 s (`pel-390x844-12-…-aviso1.png`). Bajarlo a `top:auto;bottom:calc(var(--pie,64px) + 12px)`.
- **P3-7. Franja de salto en `.msg` de peso** al escribir: el aviso crece de 126 a 155 px y el campo sube 28 px (CLS 0,0085 en 390×844 al pasar de 84 kg a 55 kg). Subir `.msg{min-height:7.4rem}` a `min-height:9.5rem` en pantallas ≥ 700 px de alto, o reservar el alto del caso «bajo peso» (`peso.css:46`).
- **P3-8. Tarjeta de especialista con hueco abajo** en 360×640 (peso `experto`): `.scr.experto .exp{flex:1 1 auto;margin:auto 0}` la estira más que su contenido (`peso-360x640-21-tu-analisis-esta-casi.png`). `flex:0 1 auto` y `margin:auto 0`.
- **P3-9. Muñecos y texto no siempre cuentan lo mismo** (solo remapear claves ya existentes, en `peso/quiz-peso.js`): `edad` usa los muñecos de nivel de experiencia (planta, medalla, fuego, cinturón de campeón con vincha) para «18 a 29 … 50 o más», con lo que «50 o más» sale como campeón; `sueño` usa un cronómetro (`t1`) para «5 a 6 horas»; `forma` usa los cronómetros `t2/t3/t1` y el confundido `m_plan` para «Nunca»; `causas` usa `o_peso` para «Picotear». Cambiar por claves neutras (`n_empiezo`, `l_casa`, `o_estres`) donde convenga.
- **P3-10. Peso `meta`: mismos muñecos que peleadores en `o_tecnica` y `n_anios`** (puño con blanco y fuego) para «Atlético» y «Marcado»: el fuego no significa «marcado». Ídem punto anterior.
- **P3-11. «marzo de 2027» se parte en dos líneas** («marzo de» / «2027») en 360-412 px (`oferta-peso.js`, `po-fecha`): usar `&nbsp;` entre «de» y el año (`peso/oferta-peso.js:~63`, `esc(plan.mes)` → `.replace(' de ',' de ')`), y en el gráfico (`quiz-peso.js:~180`).
- **P3-12. Sin favicon:** `GET /favicon.ico` 404 en las 11 páginas (`datos/*.json → log.http` y consola). Agregar `<link rel="icon" href="data:,">` o un ícono real en `cabeza()` (`construir-quiz.mjs`). (La PWA ya lo pide en el checklist.)
- **P3-13. Caché corta para imágenes y videos:** `nginx.conf:25-26` `Cache-Control: public, max-age=3600`. Con nombres estables y un funnel que se repite, convendría `max-age=86400` como mínimo, o `immutable` con nombres con hash.
- **P3-14. Atributo `muted` de los videos creados por JS:** `quiz.js:~58` y `quiz-peso.js:~114` hacen `v.muted = true`: la propiedad quedó en `true` pero no hay atributo `muted` en el DOM (`videos[].attrs.muted:false, mutedProp:true`). Para iOS conviene `v.setAttribute('muted','')` (más `v.setAttribute('webkit-playsinline','')` y `v.disablePictureInPicture = true`), antes de asignar `src`. El video de la oferta (HTML) ya lleva `muted playsinline autoplay loop`; le falta `preload="metadata"` y `width`/`height` (16/9 ya se resuelve con `aspect-ratio`).
- **P3-15. Letra de 10-11,5 px**: pie legal (10 px), `.cita`/`.nota-est`/«Salud · Estudio»/«ANTES»/«HOY» (11 px), `.c small` (11,5 px), `.chips` (12 px). Subir el pie a 11 px y `.c small` a 12 px (`base.css:24,46`).
- **P3-16. Espaciados y tamaños que se desvían entre pantallas de peso** (`datos/coherencia.json`): en peleadores todo es uniforme (h2 23 px, radio 16, borde 2, gap de grilla 10, botón 56 px alto, margen superior del botón 12). En peso aparecen margen superior del botón de 0, 8 y 10 px en vez de 12 (`peso.css:34,37,45`), `gap` de tarjeta de 4 y 10 px en vez de 6 (`peso.css:31`) y de grilla de 8 px en vez de 10 (`peso.css:12`); radios: `po-col` y `.nbox input` 14 px, el resto 16 px; sombras de `.nota`/`.exp` 0 10px 26px con alfa .07/.06. Todo dentro de lo razonable: unificar `.scr.alto .cta,.scr.filas .cta{margin-top:12px}`.
- **P3-18. Páginas de gracias sin salida si `appUrl` está vacío** (`construir-quiz.mjs:59`): la página muestra solo el check, el mensaje y la garantía, sin botón; con `appUrl` cargado aparece «Entrar a mi plan». Verificar que `appUrl` esté cargado antes de publicar (README: pendiente del checklist de PWA).
- **P3-20. Orden de Tab en las ofertas**: preguntas frecuentes → botón de la página → botón de la barra → pie (`datos/tab-*.txt`). Es lógico. En peso la barra `.sticky.oculta` no recibe foco mientras está escondida (bien); quien navega con teclado la encuentra recién al bajar.

---

# Apéndice A. Barra fija y contador (según el README)

- Barra fija de peso (`/oferta-peso/`, `/back1-peso/`, `/back2-peso/`): cumple. Oculta al cargar (`visibility:hidden`, fuera de pantalla, sin foco ni lector). Entra cuando el borde de abajo de `#por-que` queda dentro de la ventana por encima de la barra, y se esconde al subir por encima de ese punto, con una histéresis de 5 a 29 px (aparece al bajar por scrollY 2000 y se esconde al subir por 1971 en 360×640; ver tabla completa en `datos/mediciones-extra.txt`). Con movimiento reducido la transición vale 0 s. Cuando aparece, hay 109-129 px entre el borde de `#por-que` y el borde de arriba de la barra.
- En peleadores la barra está visible siempre (como dice el README).
- Contador: `/oferta/` y `/oferta-peso/` 10:00, `/back1*/` 09:57, `/back2*/` 04:57; el de la barra de arriba y el de la barra fija muestran siempre lo mismo; se reinicia solo (probado a 3 s del cero: 00:03, 00:02, 00:01, 10:00) y nunca muestra 00:00.

# Apéndice B. Imágenes y videos

## Inventario y estado

| Elemento | Cantidad / tamaño | Formato | Observaciones |
|---|---|---|---|
| `img/muneco-*.webp` | 40 archivos, 10.000 a 18.516 bytes (promedio 12,2 KB; total 489 KB) | WebP lossy VP8, todos 360×480, sin canal alfa | Fondo blanco puro horneado en los 40 (esquinas `#fff`; ninguno con fondo sucio); el efecto de recorte depende de `mix-blend-mode:multiply`. Los 5 propios de peso: 14,2 a 15,0 KB |
| `media/*.jpg` (pósters) | 4 archivos, 11,4 a 17,5 KB | JPEG 480×270 | Medio tamaño del video: se ve blando en la columna de escritorio hasta que arranca el video. Se podrían servir en WebP (≈ -30%) sin cambiar nada más |
| `media/hd/*.mp4` | 4 archivos, 217 a 436 KB, 6 s, 24 fps | H.264 960×540, sin audio, `moov` al principio (faststart) | Bien armados para iOS. `espejo.mp4` no se usa en peso |
| Resto de imágenes | ninguna | | La foto del especialista y la imagen de la noticia están vacías (`datos.js`): se ven las iniciales «JM» y el ícono de pulmón |

- Rotas: ninguna (0 de 240 combinaciones imagen × tamaño). Faltantes: ninguno.
- `width`/`height`: todos los muñecos llevan `width="360" height="480"` (`ilustraciones.js:3`) y las demás `<img>` de la página no existen hoy. Sin CLS por imágenes.
- `alt`: los 40 muñecos tienen `alt=""`. Es correcto (decorativos: al lado hay un texto con el mismo sentido). Los `<video>` no llevan `aria-hidden` ni etiqueta (decorativos): conviene `aria-hidden="true"` y `tabindex="-1"`.
- Peso por pantalla: la primera pantalla de peleadores baja 44 KB de HTML + 11 KB del póster + 49 KB de los 4 muñecos precargados; el resto (36 muñecos, 3 pósters, 4 videos, ~1,9 MB) arranca a los 15-37 ms en paralelo. `saveData` se respeta.

## Qué se precarga y LCP

- Se precargan con `<link rel="preload" as="image" fetchpriority="high">`: en `/quiz/` el póster `hook.jpg` y los 4 muñecos de la primera pantalla; en `/quiz-peso/` el póster y los 4 muñecos de la edad; en las seis ofertas el póster `oferta.jpg`. No hay avisos de «preload no usado» en la consola.
- Después, `precargar()` (quiz.js / quiz-peso.js) lanza `new Image()` por los 36 muñecos restantes y los tres pósters, y luego baja los videos en orden. Con el servidor de vista previa (`no-store`) la segunda petición del mismo archivo vuelve a bajar; en producción `max-age=3600` evita el doble.
- LCP: ver arriba (680/892 ms en 4G lento con CPU 4×: el póster, que ya llega precargado). En las ofertas: 504/592 ms (póster de la oferta). El mp4 de la oferta termina a ~2,8 s en 4G lento: no es LCP.

## Borrosas (nitidez = píxeles reales del archivo / píxeles necesarios, < 1 = estirada)

- Peleadores: el peor caso es 1,56 (muñeco dibujado a 77×102 px en 390×844): todo es nítido. En 1280×600 y 1280×800 se dibujan a 90-106 px de ancho: sobra resolución.
- Peso: ver P1-6 (medidas a 0,37-0,61) y además las tarjetas altas de `cuerpo`/`meta` (dibujadas a 205-220 px de alto en 390×844/412×915: 0,78-0,83) y `por qué te sirve` (198-222 px: 0,81-0,85); a 360×640 las de `cuerpo` quedan a 0,80. Son blandas apenas, solo en celulares dpr 3.

## Qué se puede hacer con lo que hay (sin generar imágenes)

1. Limitar el tamaño con que se dibujan en peso (P1-6 y, para `cuerpo`/`meta`, en `peso.css:56` `.scr.alto .c img.im3d`: agregar `max-height:min(100%,220px)`).
2. Remuestrear los tres archivos de las medidas a 720×960 con Lanczos y un afilado suave (`convert muneco-c_guardia.png -filter Lanczos -resize 720x960 -unsharp 0x0.6 …`, sin dibujar nada nuevo) y servirlos como `muneco-c_guardia@2x.webp` con `srcset` solo en `.mu`. Ganancia modesta (más suave que un estirado del navegador, no inventa detalle); probar contra la opción 1 antes de decidir.
3. Compensar en CSS el descentrado de los muñecos (P2-11 y `docs/pendientes-imagenes.md`): `position:relative;left:…` por clave, no se toca ningún archivo.
4. Pósters a WebP y, si se quiere, a 640×360 (≈ 18-24 KB) para que el recuadro de escritorio no se vea blando antes de arrancar el video.
5. Si más adelante se pueden generar imágenes: las `c_*` y `c_guardia` a 720×960 en lugar de 360×480, y las tres de las medidas primero.

## Videos (hook, mail, oferta)

| Video | Dónde | `playsinline` | `muted` (atributo / propiedad) | `autoplay` | `loop` | `preload` | `poster` |
|---|---|---|---|---|---|---|---|
| `hook` (`#bg`, creado por JS) | primera pantalla | sí | no / sí | sí | sí | `auto` | `/media/hook.jpg` |
| `mail`, `espejo` (peleadores), `oferta` (peso `perfil`) | `#bg` por JS | sí | no / sí | sí | sí | `auto` | sí |
| `oferta` (`<video>` en el HTML de las ofertas) | las seis ofertas | sí | sí / sí | sí | sí | no (`metadata` por defecto) | `/media/oferta.jpg` |

- Sin `controls` en ninguno; sin `webkit-playsinline` (solo lo necesitan iOS < 10).
- Reproducen en Chrome (`paused:false, readyState:4, 960×540`). En iOS el `preload` se ignora hasta el primer `play()`; el código ya hace el `play().then(pause)` de la precarga.
- Ver P3-14 para el atributo `muted`.

# Apéndice C. Archivos de la auditoría

Este informe se escribió junto con las capturas (`capturas/`, 707 PNG), los datos crudos (`datos/`, JSON y hojas de contacto) y los scripts de medición (`herr/`). Esos archivos no se subieron al repo: pesan 87 MB y se pueden volver a generar con los tests de pantallas. La comparación detallada de los muñecos quedó en `docs/pendientes-imagenes.md`.
