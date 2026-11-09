// Servicio mínimo del quiz BeastCamp: guarda el mail (lead) y el clic en comprar en archivos .jsonl. Sin dependencias.
// Solo POST /api/lead y POST /api/click · body máx. 4 KB · campos con lista cerrada · límite por IP · nunca loguea mails.
import { createServer } from "node:http";
import { appendFile, mkdir, chmod } from "node:fs/promises";

const PUERTO = Number(process.env.PORT || 3000);
const DATOS = process.env.DATA_DIR || "/data";
const MAX_BODY = 4096;
const NIVELES = new Set(["", "Estoy empezando", "Menos de 6 meses", "1 a 3 años", "Más de 3 años"]);
const PRECIOS = new Set(["$9.990", "$7.990", "$4.990"]);
const LIMITE = { ventanaMs: 60_000, lead: 5, click: 20 };

const visitas = new Map(); // ip|tipo -> [instantes]
function permitido(ip, tipo, ahora = Date.now()) {
  const k = `${ip}|${tipo}`;
  const lista = (visitas.get(k) ?? []).filter((t) => ahora - t < LIMITE.ventanaMs);
  if (lista.length >= LIMITE[tipo]) {
    visitas.set(k, lista);
    return false;
  }
  lista.push(ahora);
  visitas.set(k, lista);
  return true;
}
setInterval(() => {
  const ahora = Date.now();
  for (const [k, v] of visitas) if (v.every((t) => ahora - t >= LIMITE.ventanaMs)) visitas.delete(k);
}, 60_000).unref();

const soloClaves = (o, claves) => o && typeof o === "object" && !Array.isArray(o) && Object.keys(o).every((k) => claves.includes(k));
const texto = (v, max) => typeof v === "string" && v.length <= max && !/[\u0000-\u001f]/.test(v);
const hora = (v) => Number.isFinite(v) && v > 1.6e12 && v < 4.1e12;

export function validar(tipo, d) {
  if (tipo === "lead") {
    if (!soloClaves(d, ["nombre", "mail", "nivel", "t"])) return null;
    if (!texto(d.nombre, 60) || !texto(d.mail, 120) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.mail)) return null;
    if (!NIVELES.has(d.nivel ?? "")) return null;
    if (d.t !== undefined && !hora(d.t)) return null;
    return { nombre: d.nombre.trim(), mail: d.mail.trim().toLowerCase(), nivel: d.nivel ?? "" };
  }
  if (tipo === "click") {
    if (!soloClaves(d, ["precio", "t"])) return null;
    if (!PRECIOS.has(d.precio)) return null;
    if (d.t !== undefined && !hora(d.t)) return null;
    return { precio: d.precio };
  }
  return null;
}

async function guardar(archivo, registro) {
  const ruta = `${DATOS}/${archivo}`;
  await appendFile(ruta, JSON.stringify({ ...registro, ts: new Date().toISOString() }) + "\n", { mode: 0o600 });
  await chmod(ruta, 0o600).catch(() => {});
}

function leerBody(req) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const partes = [];
    req.on("data", (c) => {
      n += c.length;
      if (n > MAX_BODY) {
        if (partes.length) partes.length = 0;
        if (n - c.length <= MAX_BODY) reject(Object.assign(new Error("grande"), { codigo: 413 }));
        return; // se sigue leyendo y descartando; la respuesta cierra la conexión
      }
      partes.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(partes).toString("utf8")));
    req.on("error", reject);
  });
}

const responder = (res, codigo, cuerpo = "") => {
  res.writeHead(codigo, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...(codigo === 413 ? { connection: "close" } : {}) });
  res.end(cuerpo);
};

export function crear() {
  return createServer(async (req, res) => {
    try {
      const ruta = (req.url ?? "").split("?")[0];
      if (ruta === "/salud") return responder(res, 200, "ok\n");
      const tipo = ruta === "/api/lead" ? "lead" : ruta === "/api/click" ? "click" : null;
      if (!tipo) return responder(res, 404);
      if (req.method !== "POST") return responder(res, 405);
      const ip = String(req.headers["cf-connecting-ip"] ?? req.socket.remoteAddress ?? "?").slice(0, 64);
      if (!permitido(ip, tipo)) return responder(res, 429);
      const ct = String(req.headers["content-type"] ?? "");
      if (!ct.startsWith("application/json") && !ct.startsWith("text/plain")) return responder(res, 415);
      let datos;
      try {
        datos = JSON.parse(await leerBody(req));
      } catch (e) {
        return responder(res, e?.codigo === 413 ? 413 : 400);
      }
      const limpio = validar(tipo, datos);
      if (!limpio) return responder(res, 400);
      await guardar(tipo === "lead" ? "leads.jsonl" : "clicks.jsonl", limpio);
      console.log(`${tipo} guardado`); // nunca el contenido
      return responder(res, 204);
    } catch {
      console.log("error interno");
      return responder(res, 500);
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("server.mjs")) {
  await mkdir(DATOS, { recursive: true }).catch(() => {});
  crear().listen(PUERTO, "0.0.0.0", () => console.log(`api escuchando en ${PUERTO}`));
}
