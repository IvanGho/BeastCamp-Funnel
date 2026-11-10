# Prueba de humo tipo producción

Levanta en tu compu, con Docker, lo mismo que va al VPS:

- **nginx con la configuración real** (`prueba-quiz/nginx.conf`), con HTTPS y un certificado de prueba;
- **el servicio Node** (`prueba-quiz/api/server.mjs`).

Después lo recorre con Chrome como un comprador: los dos funnels, el botón de compra, el aviso de pago de Hilvapay, `/gracias/`, la app, la app sin servidor y un reembolso.

No usa claves reales ni sale a internet:

- el token del webhook es uno de prueba;
- los mails se escriben en el log del contenedor en vez de mandarse;
- si los links de pago ya están cargados, el recorrido anota adónde iba «Ir al pago», pero no lo abre.

## Qué necesita

- Docker andando (Docker Desktop, colima u otro), con los puertos 8443 y 8080 libres.
- El repo en una carpeta que Docker pueda montar. En colima, dentro de tu carpeta de usuario.
- Node 22 o más nuevo, con `npm install` hecho en la raíz del repo.
- Chrome o Edge. Si está en otro lugar, `CHROME_PATH="ruta"`.
- `openssl` y `curl`, que ya vienen en macOS y Linux.

## Cómo se corre

Desde la raíz del repo:

```bash
npm run construir                         # que prueba-quiz/sitio esté al día
sh deploy/prueba-de-humo/levantar.sh      # nginx en https://localhost:8443 y el servicio
node deploy/prueba-de-humo/humo.cjs       # el recorrido; con una carpeta como argumento, guarda capturas
sh deploy/prueba-de-humo/lighthouse.sh    # opcional: Lighthouse de los quiz, las ofertas y la app
sh deploy/prueba-de-humo/bajar.sh         # borra los contenedores, sus datos de prueba y la red
```

La primera vez, Docker baja `nginx:1.27-alpine` y `node:22-alpine`, y `lighthouse.sh` baja Lighthouse 13.6.0 con `npx`.

`humo.cjs` termina con código 0 si todo dio bien y con 1 si algo falló.

## Qué controla

1. **nginx:** cabeceras de seguridad (HSTS, CSP sin terceros, `noindex`), caché (HTML `no-cache`, imágenes 30 días), compresión, `/app/<acceso>` con y sin barra final, el manifest de cada acceso, `robots.txt`, `/salud`, redirección de http a https, POST rechazado en lo estático y archivos ocultos.
2. **Funnels:** los dos guardan la campaña (`utm_*`, `fbclid`). En la oferta, «Ir al pago» hace una de dos cosas:
   - sin link de pago, avisa «Todavía no abrimos el pago»;
   - con link, lleva a Hilvapay con el acceso y la campaña.

   En los dos casos el clic queda guardado con funnel, página y campaña.
3. **Compra simulada:**
   - un aviso sin token se rechaza;
   - el aviso de pago se guarda una sola vez, aunque llegue repetido;
   - se arma el mail con el link personal;
   - el mail del comprador no queda en los logs.
4. **`/gracias/` y la app:**
   - `/gracias/` saca el nombre y el mail de la barra de direcciones;
   - el botón lleva a `/app/<acceso>/`, que abre la bienvenida del comprador;
   - el service worker queda registrado y controla la app;
   - Chrome no marca errores de instalación.
5. **Sin servidor:** con nginx y el servicio apagados, la app sigue mostrando el plan guardado.
6. **Reembolso:** el aviso de reembolso da de baja el acceso.

## Último resultado

10/11/2026, con el código de esta entrega: **42 de 42 bien**, dos veces seguidas.

Lighthouse (celular, 4G lento y CPU 4x simulados):

- los dos quiz, las dos ofertas y la app dan 100 en rendimiento, accesibilidad y buenas prácticas;
- el SEO da 58 a 66 porque las páginas tienen `noindex` a propósito;
- los reportes están en [`docs/lighthouse/`](../../docs/lighthouse/).

En la app, Lighthouse sin pantalla muchas veces da `NO_FCP` («no pintó nada»). No es la app:

- el trace muestra que pinta a los pocos milisegundos, pero Chrome abre además un marco principal vacío y Lighthouse sigue a ese;
- `lighthouse.sh` lo repite hasta 5 veces;
- si las 5 fallan, volvé a correrlo.

Una corrida suelta también puede dar menos rendimiento si la compu está ocupada: repetila.

`nginx -t` avisa que `listen ... http2` está en desuso. Es esperado: ver el comentario en `nginx.conf`.
