#!/bin/sh
# Levanta en Docker lo mismo que va al VPS: nginx con prueba-quiz/nginx.conf (HTTPS con un certificado de prueba) y el
# servicio Node. Queda en https://localhost:8443 (y http://localhost:8080 para ver la redirección a HTTPS).
# No usa claves reales ni manda mails: el token del webhook es de prueba y los mails se escriben en el log.
# Uso, desde la raíz del repo: sh deploy/prueba-de-humo/levantar.sh   (ver README.md de esta carpeta)
set -eu

RAIZ=$(cd "$(dirname "$0")/../.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# Lo que haya quedado de una corrida anterior se borra.
docker rm -f bc-web bc-api >/dev/null 2>&1 || true
docker network create bchumo >/dev/null 2>&1 || true

# 1) La configuración de nginx del repo, con localhost en lugar del dominio y el servicio en el contenedor bc-api.
sed -e 's/DOMINIO/localhost/g' -e 's#http://127.0.0.1:3000#http://bc-api:3000#g' "$RAIZ/prueba-quiz/nginx.conf" > "$TMP/beastcamp.conf"

# 2) Certificado autofirmado para localhost, válido 3 días. Vive solo dentro del contenedor (no va al repo).
mkdir -p "$TMP/letsencrypt/live/localhost"
openssl req -x509 -newkey rsa:2048 -nodes -days 3 -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost" \
  -keyout "$TMP/letsencrypt/live/localhost/privkey.pem" -out "$TMP/letsencrypt/live/localhost/fullchain.pem" >/dev/null 2>&1

# 3) El servicio, con un token de prueba. MAIL_A_CONSOLA=1 escribe el link de acceso en el log en vez de mandarlo
#    (solo para esta prueba: en el VPS va vacía). Los datos quedan en /datos, dentro del contenedor.
docker run -d --name bc-api --network bchumo \
  -e HOST=0.0.0.0 -e PORT=3000 -e DATA_DIR=/datos -e BASE_URL=https://localhost:8443 \
  -e HILVAPAY_WEBHOOK_TOKEN=token-de-humo -e MAIL_A_CONSOLA=1 \
  -v "$RAIZ:/srv/repo:ro" node:22-alpine node /srv/repo/prueba-quiz/api/server.mjs >/dev/null

# 4) nginx con el sitio ya armado (prueba-quiz/sitio), la configuración y el certificado.
docker create --name bc-web --network bchumo -p 8443:443 -p 8080:80 \
  -v "$RAIZ/prueba-quiz/sitio:/opt/beastcamp/prueba-quiz/sitio:ro" nginx:1.27-alpine >/dev/null
docker cp "$TMP/beastcamp.conf" bc-web:/etc/nginx/conf.d/default.conf
docker cp "$TMP/letsencrypt" bc-web:/etc/letsencrypt
docker start bc-web >/dev/null
# nginx 1.25.1 o más nuevo avisa que «listen ... http2» está en desuso: es esperado (ver el comentario en nginx.conf).
docker exec bc-web nginx -t 2>&1 | tail -n 1

# 5) Esperar a que nginx y el servicio respondan.
i=0
until curl -sk https://localhost:8443/salud | grep -q ok; do
  i=$((i + 1))
  if [ "$i" -gt 30 ]; then
    echo "No responde https://localhost:8443/salud. Mirá: docker logs bc-web; docker logs bc-api" >&2
    exit 1
  fi
  sleep 1
done
echo "Listo: https://localhost:8443/quiz/ (el navegador va a avisar por el certificado de prueba)."
echo "Siguiente: node deploy/prueba-de-humo/humo.cjs   Al terminar: sh deploy/prueba-de-humo/bajar.sh"
