#!/bin/sh
# Lighthouse en modo celular (4G lento y CPU 4x simulados) de los dos quiz, las dos ofertas y la app, contra lo que
# levantó levantar.sh. Deja un reporte HTML y uno JSON por página y muestra un resumen.
# Uso, desde la raíz del repo: sh deploy/prueba-de-humo/lighthouse.sh [carpeta de salida]
# La primera vez baja Lighthouse 13.6.0 con npx. Chrome: el de CHROME_PATH o, si no está, el de macOS.
set -eu

OUT=${1:-$(mktemp -d)}
mkdir -p "$OUT"
: "${CHROME_PATH:=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
export CHROME_PATH

# Una compra simulada, para tener un acceso válido: el servicio solo entrega el plan a compras pagadas.
ACCESO=$(node -e 'console.log(require("node:crypto").randomUUID())')
AHORA=$(date -u +%Y-%m-%dT%H:%M:%SZ)
curl -sk -o /dev/null -X POST 'https://localhost:8443/api/hilvapay?evento=pagado' \
  -H 'authorization: Bearer token-de-humo' -H 'content-type: application/json' \
  --data "{\"cobroId\":\"lighthouse-$(date +%s)\",\"email\":\"lighthouse@example.com\",\"nombre\":\"Martín\",\"monto\":\"9990\",\"moneda\":\"ARS\",\"purchasedAt\":\"$AHORA\",\"paramsExtra\":{\"acceso\":\"$ACCESO\",\"funnel\":\"peso\",\"nivel\":\"t2\",\"pagina\":\"oferta\"}}"

for ruta in quiz/ quiz-peso/ oferta/ oferta-peso/ "app/$ACCESO/"; do
  nombre=$(echo "$ruta" | cut -d/ -f1)
  # En la app, Lighthouse sin pantalla muchas veces da NO_FCP («no pintó nada»). No es la app: el trace muestra que pinta
  # a los pocos milisegundos, pero Chrome abre además un marco principal vacío y Lighthouse sigue a ese. Por eso se repite
  # hasta 5 veces. --disable-storage-reset no cambia la medición (cada corrida abre un Chrome con un perfil nuevo, así
  # que siempre es una primera visita). Una corrida suelta puede dar menos rendimiento si la compu está ocupada.
  for intento in 1 2 3 4 5; do
    npx --yes lighthouse@13.6.0 "https://localhost:8443/$ruta" --quiet \
      --chrome-flags="--headless=new --ignore-certificate-errors" \
      --only-categories=performance,accessibility,best-practices,seo --disable-full-page-screenshot \
      --disable-storage-reset --max-wait-for-fcp=15000 \
      --output=json --output=html --output-path="$OUT/$nombre" || true
    if node -e 'process.exit(JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).runtimeError ? 1 : 0)' "$OUT/$nombre.report.json"; then
      break
    fi
    echo "$nombre: Lighthouse no registró el primer pintado (intento $intento), repito." >&2
  done
done

# El link de la app es la llave del comprador: en los reportes se reemplaza por un acceso vacío.
node -e '
const fs = require("node:fs");
const [dir, acceso] = process.argv.slice(1);
for (const f of ["app.report.json", "app.report.html"]) {
  const ruta = `${dir}/${f}`;
  if (fs.existsSync(ruta)) fs.writeFileSync(ruta, fs.readFileSync(ruta, "utf8").split(acceso).join("00000000-0000-4000-8000-000000000000"));
}' "$OUT" "$ACCESO"

node -e '
const fs = require("node:fs");
const dir = process.argv[1];
for (const n of ["quiz", "quiz-peso", "oferta", "oferta-peso", "app"]) {
  const r = JSON.parse(fs.readFileSync(`${dir}/${n}.report.json`, "utf8"));
  if (r.runtimeError) { console.log(n.padEnd(12), "error:", r.runtimeError.code); continue; }
  const c = r.categories, a = r.audits, p = (k) => String(Math.round(c[k].score * 100)).padStart(3);
  console.log(n.padEnd(12), "rendimiento", p("performance"), " accesibilidad", p("accessibility"), " buenas prácticas", p("best-practices"), " SEO", p("seo"),
    " | FCP", a["first-contentful-paint"].displayValue, " LCP", a["largest-contentful-paint"].displayValue, " CLS", a["cumulative-layout-shift"].displayValue);
}' "$OUT"
echo "Reportes en $OUT"
