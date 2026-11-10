// Utilidades del servicio: respuestas HTTP, lectura acotada del cuerpo, IP del cliente, límites por IP y comparaciones seguras.
// Sin dependencias. Nada de esto escribe en los logs.
import { createHash, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

/** UUID v4 en minúsculas: el formato del acceso de la app. */
export const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const sha256 = (s) => createHash("sha256").update(String(s), "utf8").digest("hex");

/** Compara dos textos en tiempo constante (se comparan los SHA-256, así no se filtra ni el largo). */
export function igualesSeguro(a, b) {
  const x = createHash("sha256").update(String(a), "utf8").digest();
  const y = createHash("sha256").update(String(b), "utf8").digest();
  return timingSafeEqual(x, y);
}

/** Texto limpio: sin caracteres de control, recortado y con largo máximo. Devuelve "" si no es texto. */
export function limpiarTexto(v, max) {
  if (typeof v !== "string") return "";
  return v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}

export const esObjeto = (o) => o !== null && typeof o === "object" && !Array.isArray(o);

/** De un objeto cualquiera deja solo las claves con valor texto (para paramsExtra y utms). */
export function soloTextos(o, maxClave = 64, maxValor = 500) {
  const sal = Object.create(null);
  if (!esObjeto(o)) return sal;
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === "string" && k.length <= maxClave && /^[\w.-]+$/.test(k)) sal[k] = v.slice(0, maxValor);
  }
  return sal;
}

const CABECERAS = { "cache-control": "no-store", "x-content-type-options": "nosniff" };

export function responder(res, codigo, cuerpo = "", extra = {}) {
  res.writeHead(codigo, { "content-type": "text/plain; charset=utf-8", ...CABECERAS, ...(codigo === 413 ? { connection: "close" } : {}), ...extra });
  res.end(cuerpo);
}

export function responderJson(res, codigo, objeto, extra = {}) {
  res.writeHead(codigo, { "content-type": "application/json; charset=utf-8", ...CABECERAS, ...extra });
  res.end(JSON.stringify(objeto));
}

/**
 * Lee el cuerpo con un tope. Si el tamaño declarado ya pasa el tope, falla sin leer.
 * Si se pasa leyendo, falla con codigo 413 y descarta el resto (hasta un margen; después corta la conexión).
 */
export function leerBody(req, max) {
  return new Promise((resolve, reject) => {
    const declarado = Number(req.headers["content-length"]);
    if (Number.isFinite(declarado) && declarado > max) return reject(Object.assign(new Error("grande"), { codigo: 413 }));
    let n = 0;
    let roto = false;
    const partes = [];
    req.on("data", (c) => {
      n += c.length;
      if (roto) {
        if (n > max + 1_048_576) req.destroy();
        return;
      }
      if (n > max) {
        roto = true;
        partes.length = 0;
        reject(Object.assign(new Error("grande"), { codigo: 413 }));
        return;
      }
      partes.push(c);
    });
    req.on("end", () => {
      if (!roto) resolve(Buffer.concat(partes).toString("utf8"));
    });
    req.on("error", (e) => {
      if (!roto) reject(e);
    });
    req.on("aborted", () => {
      if (!roto) reject(Object.assign(new Error("cortado"), { codigo: 400 }));
    });
  });
}

/** ¿El Content-Type es JSON o texto plano (lo que manda sendBeacon)? */
export function tipoJson(req) {
  const ct = String(req.headers["content-type"] ?? "").toLowerCase();
  return ct.startsWith("application/json") || ct.startsWith("text/plain");
}

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/**
 * IP del cliente: `cf-connecting-ip` si viene; si la conexión llega de este mismo equipo (nginx), `x-real-ip`; si no, la del socket.
 * Cada valor se acepta solo si es una IP válida. Detrás de nginx, el propio nginx pisa x-real-ip y borra cf-connecting-ip.
 */
export function ipDe(req) {
  const h = req.headers;
  const cf = typeof h["cf-connecting-ip"] === "string" ? h["cf-connecting-ip"].trim() : "";
  if (cf && isIP(cf)) return cf;
  const socket = String(req.socket?.remoteAddress ?? "");
  if (LOOPBACK.has(socket)) {
    const real = typeof h["x-real-ip"] === "string" ? h["x-real-ip"].trim() : "";
    if (real && isIP(real)) return real;
  }
  return socket || "?";
}

/** Límite por clave en ventana deslizante. Cada clave guarda sus instantes; se limpia solo. */
export function crearLimitador({ ventanaMs = 60_000, maxClaves = 50_000 } = {}) {
  const mapa = new Map(); // clave -> { ventana, t: [instantes] }
  const vigentes = (e, ahora) => e.t.filter((t) => ahora - t < e.ventana);
  return {
    /** Anota un intento y dice si entra (true) o ya pasó el máximo (false). */
    permitir(clave, max, ventana = ventanaMs, ahora = Date.now()) {
      const previo = mapa.get(clave);
      const lista = previo ? vigentes({ ventana, t: previo.t }, ahora) : [];
      if (lista.length >= max) {
        mapa.set(clave, { ventana, t: lista });
        return false;
      }
      lista.push(ahora);
      mapa.delete(clave);
      mapa.set(clave, { ventana, t: lista });
      while (mapa.size > maxClaves) mapa.delete(mapa.keys().next().value);
      return true;
    },
    /** ¿Hay lugar sin anotar nada? */
    libre(clave, max, ventana = ventanaMs, ahora = Date.now()) {
      const e = mapa.get(clave);
      return !e || vigentes({ ventana, t: e.t }, ahora).length < max;
    },
    anotar(clave, ventana = ventanaMs, ahora = Date.now()) {
      this.permitir(clave, Infinity, ventana, ahora);
    },
    limpiar(ahora = Date.now()) {
      for (const [k, e] of mapa) if (e.t.every((t) => ahora - t >= e.ventana)) mapa.delete(k);
    },
    get tamaño() {
      return mapa.size;
    },
  };
}
