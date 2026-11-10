// Regenera la marca de BeastCamp: íconos (PNG) e imágenes para compartir (JPEG).
// Las fuentes (SVG y HTML) están en prueba-quiz/src/marca/. Se renderiza con Chrome (playwright-core).
//
//   node prueba-quiz/scripts/marca.mjs
//   node prueba-quiz/scripts/marca.mjs --hoja ruta/hoja.png   (además arma una hoja de contacto para revisar)
//
// Chrome: CHROME_PATH="ruta/al/chrome" si no está en el lugar de siempre.
import { chromium } from "playwright-core";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inflateSync, deflateSync } from "node:zlib";

const aca = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(aca, "../src/marca");
const IMG = resolve(aca, "../sitio/img");
const MARCA = join(IMG, "marca");
mkdirSync(MARCA, { recursive: true });

const MAX_JPG = 195 * 1024; // el límite pedido es 200 KB; queda un margen

function buscarChrome() {
  const candidatos = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  const ruta = candidatos.find((c) => existsSync(c));
  if (!ruta) throw new Error("No encuentro Chrome. Definí CHROME_PATH.");
  return ruta;
}

/* ---------- PNG: se sacan los bloques de más, se pasa a RGB si no hay transparencia
   y se recomprime con el mejor filtro por fila y deflate al máximo. ---------- */
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const bloque = (tipo, datos) => {
  const t = Buffer.from(tipo, "latin1");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(datos.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, datos])));
  return Buffer.concat([len, t, datos, crc]);
};

function optimizarPng(png) {
  const firma = png.subarray(0, 8);
  let pos = 8;
  let ihdr = null;
  const idat = [];
  while (pos < png.length) {
    const len = png.readUInt32BE(pos);
    const tipo = png.toString("latin1", pos + 4, pos + 8);
    const datos = png.subarray(pos + 8, pos + 8 + len);
    if (tipo === "IHDR") ihdr = datos;
    if (tipo === "IDAT") idat.push(datos);
    pos += 12 + len;
  }
  const ancho = ihdr.readUInt32BE(0);
  const alto = ihdr.readUInt32BE(4);
  if (ihdr[8] !== 8 || ihdr[9] !== 6 || ihdr[12] !== 0) return png; // solo RGBA de 8 bits sin entrelazar (lo que da Chrome)
  const crudo = inflateSync(Buffer.concat(idat));
  const bpp = 4;
  const fila = ancho * bpp;
  // quitar filtros
  const px = Buffer.alloc(alto * fila);
  for (let y = 0; y < alto; y++) {
    const f = crudo[y * (fila + 1)];
    const o = y * (fila + 1) + 1;
    for (let x = 0; x < fila; x++) {
      const a = x >= bpp ? px[y * fila + x - bpp] : 0;
      const b = y > 0 ? px[(y - 1) * fila + x] : 0;
      const c = x >= bpp && y > 0 ? px[(y - 1) * fila + x - bpp] : 0;
      let v = crudo[o + x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * fila + x] = v & 255;
    }
  }
  // ¿hay transparencia?
  let opaco = true;
  for (let i = 3; i < px.length; i += 4) if (px[i] !== 255) { opaco = false; break; }
  const canales = opaco ? 3 : 4;
  const filaN = ancho * canales;
  const img = Buffer.alloc(alto * filaN);
  for (let y = 0; y < alto; y++)
    for (let x = 0; x < ancho; x++)
      for (let k = 0; k < canales; k++) img[y * filaN + x * canales + k] = px[y * fila + x * bpp + k];
  // elegir filtro por fila (suma mínima de valores absolutos)
  const salida = Buffer.alloc(alto * (filaN + 1));
  const cand = [0, 1, 2, 3, 4].map(() => Buffer.alloc(filaN));
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < filaN; x++) {
      const v = img[y * filaN + x];
      const a = x >= canales ? img[y * filaN + x - canales] : 0;
      const b = y > 0 ? img[(y - 1) * filaN + x] : 0;
      const c = x >= canales && y > 0 ? img[(y - 1) * filaN + x - canales] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      cand[0][x] = v;
      cand[1][x] = (v - a) & 255;
      cand[2][x] = (v - b) & 255;
      cand[3][x] = (v - ((a + b) >> 1)) & 255;
      cand[4][x] = (v - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
    }
    let mejor = 0, menor = Infinity;
    cand.forEach((buf, f) => {
      let s = 0;
      for (const v of buf) s += v < 128 ? v : 256 - v;
      if (s < menor) { menor = s; mejor = f; }
    });
    salida[y * (filaN + 1)] = mejor;
    cand[mejor].copy(salida, y * (filaN + 1) + 1);
  }
  const nuevoIhdr = Buffer.from(ihdr);
  nuevoIhdr[9] = opaco ? 2 : 6;
  return Buffer.concat([firma, bloque("IHDR", nuevoIhdr), bloque("IDAT", deflateSync(salida, { level: 9, memLevel: 9 })), bloque("IEND", Buffer.alloc(0))]);
}

/* ---------- Render ---------- */
const navegador = await chromium.launch({ executablePath: buscarChrome(), args: ["--force-color-profile=srgb", "--font-render-hinting=none"] });
const salidas = [];

async function pagina(ancho, alto) {
  const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: 1 });
  return { p: await ctx.newPage(), ctx };
}

async function icono(svg, lado, destino) {
  const { p, ctx } = await pagina(lado, lado);
  await p.goto(pathToFileURL(join(SRC, svg)).href);
  await p.evaluate((l) => {
    const s = document.documentElement;
    s.setAttribute("width", l);
    s.setAttribute("height", l);
  }, lado);
  const png = await p.screenshot({ type: "png", omitBackground: true });
  await ctx.close();
  writeFileSync(join(MARCA, destino), optimizarPng(png));
  salidas.push(join(MARCA, destino));
}

async function og(html, destino) {
  const { p, ctx } = await pagina(1200, 630);
  await p.goto(pathToFileURL(join(SRC, html)).href);
  await p.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  await p.evaluate(() => document.fonts.ready);
  let jpg;
  for (let q = 92; q >= 60; q -= 2) {
    jpg = await p.screenshot({ type: "jpeg", quality: q });
    if (jpg.length <= MAX_JPG) break;
  }
  await ctx.close();
  writeFileSync(join(IMG, destino), jpg);
  salidas.push(join(IMG, destino));
}

copyFileSync(join(SRC, "favicon.svg"), join(MARCA, "favicon.svg"));
salidas.push(join(MARCA, "favicon.svg"));
await icono("favicon.svg", 32, "favicon-32.png");
await icono("icono-lleno.svg", 180, "apple-touch-icon.png");
await icono("icono.svg", 192, "icono-192.png");
await icono("icono.svg", 512, "icono-512.png");
await icono("icono-lleno.svg", 512, "icono-maskable-512.png");
await og("og-quiz.html", "og-quiz.jpg");
await og("og-quiz-peso.html", "og-quiz-peso.jpg");

/* ---------- Hoja de contacto (opcional): --hoja ruta.png ---------- */
const i = process.argv.indexOf("--hoja");
if (i > 0 && process.argv[i + 1]) {
  const destino = resolve(process.argv[i + 1]);
  mkdirSync(dirname(destino), { recursive: true });
  const { p, ctx } = await pagina(1400, 900);
  await p.goto(pathToFileURL(join(SRC, "hoja.html")).href);
  await p.evaluate(() => Promise.all([...document.images].map((im) => im.decode())));
  await p.screenshot({ path: destino, fullPage: true });
  await ctx.close();
  console.log("Hoja:", destino);
}

await navegador.close();
for (const f of salidas) console.log(`${(statSync(f).size / 1024).toFixed(1).padStart(7)} KB  ${f}`);
