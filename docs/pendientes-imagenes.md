# Pendientes de imágenes y videos

Esta lista es para cuando se puedan generar imágenes y videos nuevos. Todo lo de acá se detectó en la auditoría visual de los dos funnels (peleadores y bajar de peso). Mientras tanto, ninguno de estos puntos rompe nada: las páginas se ven y funcionan, solo que con una calidad o una coherencia un poco menor a la ideal.

Los archivos que se mencionan están en `prueba-quiz/sitio/img/` (muñecos) y `prueba-quiz/sitio/media/` (pósters y videos). Todos los muñecos miden 360×480 píxeles.

## 1. Los 5 muñecos propios del funnel de peso contra los otros 35

Los cinco son: `muneco-c_delgado`, `muneco-c_normal`, `muneco-c_kilos`, `muneco-c_sobrepeso` y `muneco-c_guardia`. Son el mismo boxeador que los otros 35 (pelado a máquina, barba corta, musculosa y short negros, guantes negros con rojo y vendas blancas) y tienen la misma escala vertical. Pero, puestos en la misma pantalla o en pantallas seguidas, se nota que son de otra tanda.

**Lo que les pasa a todos (comparado con los 35):**

- Están parados de frente y relajados, con los brazos caídos. Los otros 35 están en guardia o haciendo algo.
- Están centrados en el lienzo: los pies caen cerca de x = 172-177 de 360. En los otros 35 los pies caen en x = 118-182 (promedio 131). Quedan unos 42 px (12%) más a la derecha.
- La piel es un poco más pálida y más rosada que la de los otros (en promedio, verde +9 y azul +14).
- La sombra del piso es un 27% más chica y termina antes del borde. En los otros 35 la sombra llega hasta el borde del lienzo.
- La expresión es neutra. Los otros 35 tienen el ceño fruncido y la mandíbula tensa.

**Qué corregir, ítem por ítem:**

- `muneco-c_delgado`: figura de 248×447 con los pies en x = 172. Torso angosto con una barriguita leve, sin la musculatura marcada de los otros. Expresión neutra. Sombra de 6.024 px contra 8.534 de promedio.
- `muneco-c_normal`: figura de 249×448 con los pies en x = 172. Es el más pálido del grupo (piel 192, 152, 132) y la barba se ve más rala que en `n_empiezo` y `m_golpes`. Es la única pose sin tensión de todo el set.
- `muneco-c_kilos`: figura de 249×447 con los pies en x = 177 (el más a la derecha de los cinco). La cara es más redonda, con mandíbula más ancha y una sonrisa leve: se lee como otra persona y no como el mismo boxeador con más kilos.
- `muneco-c_sobrepeso`: es el más ancho de los cinco (263×445). La musculosa estirada es la mancha negra más grande de todo el set (16,1% de píxeles oscuros contra 8,5-14,1% en los otros). Cara ancha, expresión neutra, sin mueca.
- `muneco-c_guardia`: es `muneco-e_guardia` sin la flecha roja, pero no calza en el lienzo: el torso quedó 49 px a la derecha (en x = 167 contra 118) y la sombra se acortó 36%. Su cara sí es la de los otros 35, así que no coincide con la de los cuatro `c_*`.

**Dónde se nota:**

- Pantalla «¿Cómo ves tu cuerpo hoy?»: las cuatro tarjetas entre sí encajan, pero al pasar a «¿Cómo te gustaría verte?» cambian el encuadre y la piel.
- Pantalla «¿Qué querés cambiar primero?»: «Los costados» usa `c_guardia`, que queda unos 40 px más a la derecha que los otros cuatro muñecos de esa pantalla.
- Pantallas de altura, peso y meta: al pasar de altura (`c_guardia`) a peso (`o_peso`) y a meta (`o_tecnica`), la figura da un salto lateral de 35 a 45 px.
- Caras mezcladas: en «zonas» y en «forma» conviven la cara suave de `c_guardia` con las caras duras de los demás.

**Qué se necesita cuando se puedan generar:**

- Regenerar los cinco con la cara de los 35, para que `c_kilos` y `c_sobrepeso` se lean como la misma persona con más kilos.
- Con la figura corrida a x ≈ 131 (como los demás), la sombra del mismo largo que los otros (unos 8.500 píxeles de sombra) y la sombra llegando al borde, igual que los 35.
- Con la misma piel que los otros (190, 143, 117 de promedio).
- Idealmente a 720×960 (ver el punto siguiente).
- Si se prefiere no mezclar caras en «zonas», una alternativa más barata es cambiar `c_guardia` de esa pantalla por otro muñeco que ya existe.

Esto no se puede arreglar con CSS: el tono de piel no se puede corregir sin teñir también el rojo de los guantes y el fondo blanco.

## 2. Muñecos de las medidas a 720×960

Las pantallas de altura, peso y meta muestran el muñeco grande (hasta unos 340 px de alto). Los archivos de 360×480 quedan blandos en celulares de pantalla de alta densidad (la mayoría).

- Archivos: `muneco-c_guardia`, `muneco-o_peso` y `muneco-o_tecnica`.
- Hoy: se les agregó una versión `@2x` de 720×960, hecha achicando y agrandando el mismo archivo con un filtro (Lanczos) y un afilado suave. Se ve más nítido que antes, pero no tiene detalle nuevo: es el mismo dibujo.
- Pendiente: generar estos tres muñecos directamente a 720×960 o más (con el encuadre corregido del punto 1) y reemplazar los `@2x`.
- Después, en este orden: los cuatro `c_*` (tarjetas altas de «¿Cómo ves tu cuerpo hoy?», que se dibujan a unos 205-220 px de alto) y los muñecos que se usan en «Por qué te sirve» (198-222 px de alto). Son blandos apenas, solo en celulares de alta densidad.

## 3. Pósters de mejor resolución

Los cuatro pósters (`media/hook.jpg`, `mail.jpg`, `espejo.jpg`, `oferta.jpg`) son JPEG de 480×270, la mitad del tamaño de los videos (960×540). Se ven blandos en la columna de la compu mientras el video todavía no arrancó.

- Pendiente: sacarlos de nuevo a 960×540 (o 640×360 como mínimo) a partir de un fotograma de cada video, preferentemente en WebP (pesan cerca de 30% menos).
- Los videos (`media/hd/*.mp4`) son 960×540, 6 segundos, sin audio. En la compu, con la columna del video, se ven estirados: para mejorarlo de verdad hacen falta videos nuevos de más resolución (1280×720 o más).
- `espejo.mp4` no se usa en el funnel de peso porque muestra a una mujer.

## 4. Foto del especialista e imagen de la noticia

Hoy los dos campos están vacíos en `prueba-quiz/src/datos.js`, y la página reserva el lugar:

- Foto del especialista: se ven las iniciales dentro del círculo (por ejemplo «JM»). Se llena con `especialista.foto` cuando haya una foto real.
- Imagen de la noticia: se ve un ícono blanco (un pulmón en el funnel de peleadores, una línea de pulso en el de peso) sobre fondo verde. Se llena con `noticia.imagen` cuando haya una imagen real.
- No inventar ni completar datos del especialista ni de la noticia: tienen que ser reales y verificables.

## 5. Videos de la app

La app (`/app/`) tiene lugar para un video en cada ejercicio y en la guía, pero hoy no hay ninguno: en su lugar se ve un muñeco. Cuando existan los videos, tienen que ser sin audio, livianos (que arranquen rápido en celular) y con su póster, igual que los del quiz.

## Lo que no hay que tocar

Los muñecos que se eligieron para cada opción de cada pregunta (por ejemplo los de «edad», «sueño», «forma», «causas» y «meta») los eligió el dueño del proyecto. La auditoría marcó que algunos no siempre cuentan lo mismo que el texto, pero se dejaron como están a propósito.
