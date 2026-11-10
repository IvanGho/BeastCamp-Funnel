#!/bin/sh
# Borra lo que levantó levantar.sh: los contenedores bc-web y bc-api (con los datos de prueba) y la red bchumo.
# Las imágenes de Docker (nginx:1.27-alpine y node:22-alpine) quedan, para la próxima vez.
docker rm -f bc-web bc-api >/dev/null 2>&1 || true
docker network rm bchumo >/dev/null 2>&1 || true
echo "Listo: se borraron los contenedores y la red de la prueba de humo."
