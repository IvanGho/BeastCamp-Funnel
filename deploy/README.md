# Cómo subir BeastCamp a tu VPS

Guía para quien publica el sitio (quiz, ofertas, app del comprador) y el servicio que recibe los avisos de Hilvapay, manda los mails de acceso y avisa a Meta. Está pensada para un VPS con Ubuntu 22.04/24.04 o Debian 12, con acceso por SSH y `sudo`. Los comandos están para copiar y pegar; donde dice `DOMINIO` va el dominio real (sin `https://`).

## Cómo queda armado

```
Internet ──► nginx (80 y 443, HTTPS) ──► archivos de prueba-quiz/sitio/   (páginas, app, imágenes, videos)
                                    └──► /api/*  y  /salud  ──► servicio Node en 127.0.0.1:3000
Hilvapay ──► https://DOMINIO/api/hilvapay?evento=…   (avisos de pago, reembolso y disputa)
Servicio ──► Resend (mails)  ·  Meta (Conversions API)
Servicio ──► /var/lib/beastcamp  (compras, clics, leads y progreso de cada comprador)
```

- Las páginas son archivos estáticos: nginx las sirve directo.
- El servicio Node no tiene dependencias (nada de `npm install` en el servidor) y solo escucha en `127.0.0.1`: desde afuera se llega únicamente a través de nginx.
- Lo único que no se puede perder es `/var/lib/beastcamp` (ver [Respaldo](#respaldo)).
- Antes de subirlo podés probar esta misma configuración (nginx y el servicio) en tu compu, con Docker: [prueba de humo](prueba-de-humo/).

## 1. Requisitos

- Un VPS chico alcanza (1 vCPU, 1 GB de RAM, 10 GB de disco, más lo que pesen los videos de `media/`).
- Un dominio con el registro `A` (y `AAAA` si el VPS tiene IPv6) apuntando al VPS. Comprobalo con `dig +short DOMINIO`.
- Cuentas de [Hilvapay](#7-hilvapay-paso-a-paso), [Resend](#8-resend-los-mails-de-acceso) y, para medir los anuncios, [Meta](#9-meta-conversions-api).
- Acceso al repositorio (si es privado, una clave de despliegue o un token).

## 2. Preparar el servidor

```bash
sudo apt update
sudo apt install -y nginx certbot git ufw curl

# Node 22 o más nuevo (el Node de apt suele ser más viejo). Mirá el script antes de ejecutarlo.
curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource_setup.sh
sudo bash /tmp/nodesource_setup.sh
sudo apt install -y nodejs
node -v          # tiene que decir v22 o más

# Usuario sin privilegios para el servicio (no tiene shell ni contraseña)
sudo useradd --system --home /var/lib/beastcamp --shell /usr/sbin/nologin beastcamp

# Firewall: solo SSH, HTTP y HTTPS. El puerto 3000 queda cerrado (además el servicio solo escucha en 127.0.0.1).
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 3. Carpetas y código

| Dónde | Qué hay | Quién escribe |
|---|---|---|
| `/opt/beastcamp` | el repositorio (el sitio ya armado está en `prueba-quiz/sitio/`) | root (solo lectura para el servicio) |
| `/etc/beastcamp/beastcamp-api.env` | las claves y variables del servicio | root (permisos 600) |
| `/var/lib/beastcamp` | los datos (`DATA_DIR`), los crea systemd | solo el usuario `beastcamp` (permisos 700) |
| `/var/log/nginx/beastcamp.access.log` | accesos, **sin** query string | nginx |

```bash
sudo git clone <URL-DEL-REPOSITORIO> /opt/beastcamp
cd /opt/beastcamp
sudo git checkout <RAMA-A-PUBLICAR>
```

Sin git, desde tu compu: `rsync -av --exclude node_modules --exclude .git --exclude vista-previa-local/.datos ./ usuario@VPS:/tmp/beastcamp/` y después `sudo rsync -a --delete /tmp/beastcamp/ /opt/beastcamp/`.

**Qué tiene que estar en el servidor junto a `prueba-quiz/api/`:** la carpeta `prueba-quiz/contenido/` **completa**, no solo `plan.mjs` (ese archivo importa a sus hermanos `ejercicios.mjs`, `drills.mjs`, `guia.mjs` y `semanas-*.mjs`; si falta alguno, `/api/app/<acceso>/plan` responde 503). `plan-para-revisar.md` no hace falta en el servidor. También conviene `prueba-quiz/src/datos.js` (de ahí sale la garantía que dicen los mails) y `prueba-quiz/scripts/reporte.mjs`. Con `git clone` o el `rsync` de arriba ya queda todo.

El sitio que se publica es lo que está en `prueba-quiz/sitio/` **del repositorio**: si cambiaste algo en `prueba-quiz/src/`, corré `npm run construir` en tu compu y commiteá el resultado antes de subirlo (en el servidor no se arma nada).

## 4. Variables del servicio

```bash
sudo install -d -m 755 /etc/beastcamp
sudo install -m 600 -o root -g root /opt/beastcamp/deploy/beastcamp-api.env /etc/beastcamp/beastcamp-api.env
sudo nano /etc/beastcamp/beastcamp-api.env
```

| Variable | Qué es | Obligatoria |
|---|---|---|
| `BASE_URL` | `https://DOMINIO`, sin barra final. Va en los links de los mails y en los eventos de Meta. | Sí |
| `HILVAPAY_WEBHOOK_TOKEN` | Token que vos inventás (`openssl rand -hex 32`). El mismo en los tres destinos de Hilvapay. Sin esto no entra ninguna compra. | Sí |
| `RESEND_API_KEY` | Clave de Resend. Sin ella no sale ningún mail. | Sí, para los mails |
| `MAIL_DESDE` | Remitente con un dominio verificado, por ejemplo `BeastCamp <acceso@DOMINIO>`. | Sí, para los mails |
| `META_PIXEL_ID`, `META_CAPI_TOKEN` | Activan el aviso de compra y de inicio de pago a Meta. | Para medir anuncios |
| `META_TEST_EVENT_CODE` | Solo mientras probás en Events Manager. | No |
| `META_API_VERSION` | Versión del Graph API (por defecto `v21.0`). | No |
| `DATA_DIR`, `PORT`, `HOST` | Ya vienen bien (`/var/lib/beastcamp`, `3000`, `127.0.0.1`). | No |
| `MAIL_A_CONSOLA` | Solo desarrollo. **Dejala vacía en producción.** | No |

No pegues nunca estos valores en el repositorio, en un chat ni en un ticket.

## 5. Servicio con systemd

```bash
sudo cp /opt/beastcamp/deploy/beastcamp-api.service /etc/systemd/system/beastcamp-api.service
# Si `command -v node` no dice /usr/bin/node, cambiá la ruta de ExecStart en ese archivo.
sudo systemctl daemon-reload
sudo systemctl enable --now beastcamp-api
sudo systemctl status beastcamp-api        # tiene que decir «active (running)»
curl -s http://127.0.0.1:3000/salud        # ok
sudo journalctl -u beastcamp-api -n 20     # logs (nunca traen mails, nombres, IPs ni claves)
```

El servicio arranca solo con el servidor, se reinicia si se cae y no puede escribir fuera de `/var/lib/beastcamp`.

## 6. nginx y certificado HTTPS

El orden importa: primero el certificado (con la página que trae nginx), después nuestra configuración.

```bash
# 1) Certificado de Let's Encrypt (DNS ya apuntando al VPS; nginx instalado con su sitio por defecto)
sudo certbot certonly --webroot -w /var/www/html -d DOMINIO --agree-tos -m TU@MAIL --no-eff-email

# 2) Que nginx se recargue solo cuando el certificado se renueve
printf '#!/bin/sh\nsystemctl reload nginx\n' | sudo tee /etc/letsencrypt/renewal-hooks/deploy/recargar-nginx.sh
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/recargar-nginx.sh
sudo certbot renew --dry-run               # prueba la renovación automática (la instala el paquete certbot)

# 3) Nuestra configuración
sudo cp /opt/beastcamp/prueba-quiz/nginx.conf /etc/nginx/conf.d/beastcamp.conf
sudo sed -i 's/DOMINIO/TU-DOMINIO.com/g' /etc/nginx/conf.d/beastcamp.conf     # reemplaza todas las apariciones
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Qué hace esa configuración:

- 80 redirige a 443 (301); HSTS de un año; las cabeceras de seguridad y la política de contenido (CSP) que no permite cargar nada de afuera.
- HTML, `/app/sw.js` y los manifests: `no-cache` (el navegador revalida siempre). `/img/` y `/media/`: 30 días. **Sin `immutable`**: los nombres de archivo no llevan hash, así que si reemplazás una imagen con el mismo nombre, la gente la ve cuando vence el caché. Para cambiar algo ya publicado, subilo con otro nombre y actualizá la referencia.
- Lo estático solo acepta GET y HEAD; `/api/` acepta GET, POST y PUT, con cuerpo máximo de 64 KB y tiempos cortos.
- `/app/<acceso>/` y su `manifest.webmanifest` solo responden para UUID v4 en minúsculas.
- El registro de accesos **no guarda la query**: `/gracias/` llega con nombre y mail en la URL y no deben quedar en los logs.
- Si tu nginx es viejo (anterior a 1.19) y `nginx -t` protesta por alguna directiva, mandá el mensaje completo; no la borres a ciegas.

Comprobaciones rápidas:

```bash
curl -sI https://DOMINIO/quiz/ | head -20            # 200, HSTS, CSP, X-Robots-Tag, cache-control: no-cache
curl -sI http://DOMINIO/quiz/ | head -3              # 301 a https
curl -s https://DOMINIO/salud                         # ok (pasa por nginx hasta el servicio)
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://DOMINIO/quiz/   # 405: lo estático es de solo lectura
```

### Si el dominio pasa por Cloudflare

El servicio limita pedidos por IP. Detrás de Cloudflare, nginx ve la IP de Cloudflare y no la del visitante, así que hay que decirle que confíe en `CF-Connecting-IP` solo para las IPs de Cloudflare:

```bash
{ for r in $(curl -s https://www.cloudflare.com/ips-v4) $(curl -s https://www.cloudflare.com/ips-v6); do echo "set_real_ip_from $r;"; done; echo "real_ip_header CF-Connecting-IP;"; } | sudo tee /etc/nginx/conf.d/cloudflare-realip.conf
sudo nginx -t && sudo systemctl reload nginx
```

Y en Cloudflare, una regla que deje pasar sin desafío a `/api/hilvapay` (los avisos de Hilvapay son de servidor a servidor y un desafío los rompe). Sin Cloudflare, no hagas nada de esto.

## 7. Hilvapay, paso a paso

Referencia del formato de los avisos: `docs/integracion/webhooks-salientes.md` de Hilvapay.

### 7.1 Los tres links de pago (uno por precio)

El funnel usa tres precios: el principal (`/oferta`, $9.990), el del primer rescate (`/back1`, $7.990) y el del segundo (`/back2`, $4.990).

1. En Hilvapay creá el producto «BeastCamp» con su variante **Principal** al precio principal, y agregale dos variantes más (rescate 1 y rescate 2) con los otros dos precios. Cada variante tiene su propio **link de pago**.
2. Copiá los tres links y pegalos en `prueba-quiz/src/datos.js`:

   ```js
   pagoUrl: { base: 'LINK-DEL-PRECIO-PRINCIPAL', b1: 'LINK-DEL-RESCATE-1', b2: 'LINK-DEL-RESCATE-2' },
   ```
3. En el mismo archivo completá `sitioUrl: 'https://DOMINIO'` y, si corresponde, `responsable` y `contacto`.
4. En tu compu: `npm run construir`, `npm test`, commit y subida al servidor (ver [Actualizar](#actualizar)).

Los precios de `datos.js` y los de las variantes de Hilvapay tienen que coincidir. Si cambiás un precio, también hay que cambiarlo en `prueba-quiz/api/server.mjs` (lista `PRECIOS`); un test avisa si no coinciden.

### 7.2 Página de gracias propia

En la pestaña **Producto**, campo **Página de gracias**: `https://DOMINIO/gracias/`. (Si el producto entra a un funnel de Hilvapay con pasos, esa página se configura en el nodo **Página de gracias** del funnel.) Hilvapay redirige ahí con `nombre`, `email`, las UTM y los parámetros del link; desde ahí la persona entra a su plan.

### 7.3 Tres destinos de webhook

En **Configuración > Webhooks > Agregar destino**, tres veces. El cuerpo del aviso no dice qué evento es, por eso hay un destino por evento, cada uno con su URL:

| Nombre | URL del endpoint | Eventos que dispara |
|---|---|---|
| BeastCamp pagado | `https://DOMINIO/api/hilvapay?evento=pagado` | **Pagado** |
| BeastCamp reembolso | `https://DOMINIO/api/hilvapay?evento=reembolso` | **Reembolso** |
| BeastCamp disputa | `https://DOMINIO/api/hilvapay?evento=disputa` | **Disputa** |

En los tres, **Token de autenticación (Bearer)** = el valor de `HILVAPAY_WEBHOOK_TOKEN`.

Después, en la pestaña **Producto** de BeastCamp, **Enviar ventas a un panel externo > Asignar destino**, una vez por cada uno de los tres destinos. En **Identificador de este producto** escribí `beastcamp`. **No uses `prueba-generica`**: el servicio lo toma como un aviso de prueba y no registra la compra.

Si no configurás reembolso y disputa, nada se revoca: un comprador que pide la devolución sigue con acceso (igual que en los otros funnels).

### 7.4 Revisar el email de entrega de Hilvapay

Pestaña **Email de entrega** del producto: si está activo, el comprador recibe dos mails (el de Hilvapay y el de BeastCamp con su link). Decidí cuál dejar y que no prometa otra cosa.

### 7.5 Probar con el ping

1. En la lista de destinos de Hilvapay, tocá el **avión de papel** de cada uno. Tiene que mostrar la prueba como exitosa.
2. En el servidor: `sudo journalctl -u beastcamp-api -n 10` tiene que decir `hilvapay: ping de prueba`. El ping no guarda nada ni manda mails.
3. Si falla: `401` = token distinto; `503` = falta `HILVAPAY_WEBHOOK_TOKEN` en el `.env` (o el servicio está caído); `400` = el destino no tiene `?evento=…`; error de conexión = nginx o el certificado.

### 7.6 Una compra real de punta a punta (antes de gastar en anuncios)

1. Abrí el funnel, llegá a la oferta y comprá con tu tarjeta el precio más bajo.
2. Tiene que pasar: Hilvapay te lleva a `/gracias/`; llega el mail «Tu plan BeastCamp está listo»; el botón abre `https://DOMINIO/app/<acceso>/` y la app muestra tu plan; en `sudo journalctl -u beastcamp-api` aparece `hilvapay: pagado guardado`.
3. Reembolsá esa compra desde Hilvapay: en unos minutos el acceso pasa a revocado (la app deja de mostrar el plan).
4. Si un reembolso o una disputa no llegó (Hilvapay no los reenvía), podés revocar a mano:

   ```bash
   curl -s -X POST 'http://127.0.0.1:3000/api/hilvapay?evento=reembolso' \
     -H "Authorization: Bearer $(sudo grep ^HILVAPAY_WEBHOOK_TOKEN= /etc/beastcamp/beastcamp-api.env | cut -d= -f2-)" \
     -H 'Content-Type: application/json' -d '{"cobroId":"EL-ID-DEL-COBRO"}'
   ```

Si el mail o el aviso a Meta fallan por una caída de Resend o de Meta, el servicio reintenta cada 5 minutos durante 24 horas. Hilvapay recibe 200 apenas la compra queda guardada.

## 8. Resend: los mails de acceso

1. Creá cuenta en [resend.com](https://resend.com) y agregá el dominio (**Domains > Add Domain**).
2. Resend te muestra unos registros DNS (SPF, DKIM y MX). Cargalos donde tengas el DNS del dominio y esperá a que diga **Verified**. Conviene agregar también un registro DMARC (`_dmarc`, `v=DMARC1; p=none; rua=mailto:TU@MAIL`).
3. **API Keys > Create API Key** con permiso **Sending access** sobre ese dominio. Copiala en `RESEND_API_KEY`.
4. `MAIL_DESDE=BeastCamp <acceso@DOMINIO>` (la dirección tiene que ser del dominio verificado; no hace falta que exista como casilla).
5. `sudo systemctl restart beastcamp-api`.
6. Probalo con la compra real de arriba, o pidiendo «recuperar mi link» en `/app/` con el mail de esa compra. Los envíos se ven en **Logs** de Resend.

Con un dominio sin verificar, Resend solo deja mandar a tu propio mail y el resto falla: el servicio lo anota en el log (`mail acceso falló (http 403)`) y lo reintenta, pero nadie recibe su acceso. Verificá el dominio **antes** de lanzar.

## 9. Meta (Conversions API)

Las páginas no cargan el píxel de Meta (la política de contenido no deja scripts de terceros). Todo se avisa desde el servidor: **InitiateCheckout** cuando alguien toca «Ir al pago» y **Purchase** cuando entra el pago. No hay PageView ni ViewContent.

1. En Events Manager elegí (o creá) el píxel. Su ID numérico va en `META_PIXEL_ID`.
2. **Configuración > API de conversiones > Generar token de acceso**. Va en `META_CAPI_TOKEN`.
3. **Probar eventos** (Test events) muestra un código tipo `TEST12345`. Ponelo en `META_TEST_EVENT_CODE`, `sudo systemctl restart beastcamp-api`, tocá «Ir al pago» en el funnel y hacé una compra: los dos eventos tienen que aparecer en esa pestaña, con «Purchase» y «InitiateCheckout», valor y moneda.
4. Sacá `META_TEST_EVENT_CODE` (dejala vacía) y reiniciá. Con el código puesto los eventos van a «Probar eventos» y no cuentan para las campañas.
5. En la campaña, elegí el píxel y el evento **Compra** como objetivo de conversión.

Notas:

- El `event_id` de cada compra es `hp_<id del cobro>`, para que Meta no la cuente dos veces si algún día se suma un píxel con el mismo id.
- Se mandan el mail y el nombre en SHA-256, el id de acceso en SHA-256, la IP y el navegador del comprador (los trae Hilvapay), y `fbc`/`fbp` si llegaron. Más datos de coincidencia = mejor atribución.
- `InitiateCheckout` asume que los precios son en pesos (`ARS`).

## 10. Links para los anuncios

En Meta Ads Manager, en cada anuncio, campo **Parámetros de URL** (sin el signo `?`):

```
utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}
```

Y la **URL del sitio web**:

| Funnel | URL |
|---|---|
| Peleadores | `https://DOMINIO/quiz/` |
| Bajar de peso | `https://DOMINIO/quiz-peso/` |

Meta reemplaza `{{campaign.name}}`, `{{ad.name}}` y `{{adset.name}}` por los nombres reales y agrega `fbclid` sola. El funnel guarda todo eso y lo manda en el link de pago, así cada venta queda atada a su campaña y anuncio. **Si renombrás un anuncio, el reporte lo cuenta como uno nuevo.**

## 11. Reporte de ventas

```bash
sudo -u beastcamp node /opt/beastcamp/prueba-quiz/scripts/reporte.mjs --datos /var/lib/beastcamp --desde 2026-11-12
```

Muestra, por funnel y página y por campaña y anuncio: clics, compras, reembolsos, disputas, ingresos por moneda y conversión de clic a compra. No incluye datos personales. `--json` lo da en JSON. Sin `--desde` cuenta todo.

## 12. Operación

**Logs y monitoreo**

- `sudo journalctl -u beastcamp-api -f` (servicio) y `/var/log/nginx/beastcamp.access.log`, `/var/log/nginx/error.log` (nginx).
- Poné un monitor externo (UptimeRobot o similar) en `https://DOMINIO/salud`: responde `ok` si nginx y el servicio andan.
- Si el servicio se cae mientras entra una compra, Hilvapay reintenta hasta 10 veces en unas 5 horas.

**Respaldo**

`/var/lib/beastcamp` contiene todo lo que importa:

| Archivo | Qué es | Si se pierde |
|---|---|---|
| `compras.jsonl` | cada pago, reembolso y disputa | **los compradores pierden el acceso** (de acá se reconstruye todo) |
| `progreso/<acceso>.json` | el progreso de cada comprador | pierden su avance |
| `mails.jsonl` | qué mails salieron | se podrían repetir mails de las últimas 24 h |
| `clicks.jsonl`, `leads.jsonl` | clics en comprar y mails del quiz | se pierde la medición |

Todo tiene datos personales: permisos 600/700 y no lo copies a lugares abiertos. Un respaldo diario, guardado **fuera** del VPS:

```bash
sudo tee /etc/cron.daily/beastcamp-respaldo >/dev/null <<'EOF'
#!/bin/sh
set -eu
umask 077
DEST=/var/backups/beastcamp
mkdir -p "$DEST"
tar -C /var/lib -czf "$DEST/datos-$(date +%F).tar.gz" beastcamp
find "$DEST" -name 'datos-*.tar.gz' -mtime +30 -delete
EOF
sudo chmod +x /etc/cron.daily/beastcamp-respaldo
```

Una copia en el mismo disco no es un respaldo: copiá `/var/backups/beastcamp` a otro lado (`rclone`, `scp` o los snapshots del proveedor). Para restaurar: `sudo systemctl stop beastcamp-api`, descomprimir en `/var/lib`, `sudo chown -R beastcamp:beastcamp /var/lib/beastcamp`, `sudo systemctl start beastcamp-api`.

**Pedido de borrado de datos**: buscá el mail del comprador en `compras.jsonl`/`leads.jsonl` con el servicio parado, borrá esas líneas y su `progreso/<acceso>.json`, y volvé a arrancar.

## Actualizar

```bash
cd /opt/beastcamp
sudo git pull                                   # (o el rsync de arriba)
sudo systemctl restart beastcamp-api            # solo si cambió algo en prueba-quiz/api/ o prueba-quiz/contenido/
sudo cp prueba-quiz/nginx.conf /etc/nginx/conf.d/beastcamp.conf && sudo sed -i 's/DOMINIO/TU-DOMINIO.com/g' /etc/nginx/conf.d/beastcamp.conf && sudo nginx -t && sudo systemctl reload nginx   # solo si cambió nginx.conf
```

- Cambios en las páginas (`prueba-quiz/sitio/`): no hace falta reiniciar nada. Los HTML se revalidan siempre; las imágenes y videos tardan hasta 30 días en actualizarse si se reemplazó un archivo con el mismo nombre.
- La app se actualiza sola: el service worker se revalida en cada visita.
- Un reinicio del servicio dura un segundo; si justo entra un aviso de Hilvapay, lo reintenta.

## Lista antes de lanzar

- [ ] `https://DOMINIO/quiz/` y `/quiz-peso/` cargan por HTTPS, con candado y sin errores en la consola del navegador.
- [ ] `pagoUrl` tiene los tres links y los precios coinciden con los de Hilvapay.
- [ ] Los tres destinos de webhook responden bien al ping y están asignados al producto con el identificador `beastcamp`.
- [ ] Una compra real de punta a punta: gracias, mail, app con el plan, y el reembolso lo revoca.
- [ ] El dominio está verificado en Resend y el mail no cae en spam.
- [ ] Los eventos de Meta aparecen en «Probar eventos» y después `META_TEST_EVENT_CODE` quedó vacío.
- [ ] Hay un respaldo diario y una copia fuera del VPS.
- [ ] El monitor de `/salud` está activo.
- [ ] `MAIL_A_CONSOLA` está vacía.
