// Progreso del comprador (versión 1): validación estricta y fusión entre dispositivos. Ver sección 5 del contrato.
import { esObjeto } from "./util.mjs";

export const MAX_SESIONES = 400;
export const MAX_DRILLS = 100;
const NIVELES = new Set(["t1", "t2", "t3", "t4"]);
const ID = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const APODO = /^[\p{L}\p{N} _.-]{0,20}$/u;
const AJUSTES = ["sonido", "voz", "vibracion"];

const hora = (v) => Number.isFinite(v) && v > 1.6e12 && v < 4.1e12;
const entero = (v, max) => Number.isInteger(v) && v >= 0 && v <= max;
const soloClaves = (o, claves) => Object.keys(o).every((k) => claves.includes(k));

/** Valida el progreso que manda la app. Devuelve el objeto limpio (con las claves en orden fijo) o null si algo no cierra. */
export function validarProgreso(d) {
  if (!esObjeto(d) || !soloClaves(d, ["v", "apodo", "nivel", "inicio", "sesiones", "drills", "ajustes", "actualizado"])) return null;
  if (d.v !== 1 || !NIVELES.has(d.nivel) || !hora(d.inicio) || !hora(d.actualizado)) return null;
  const apodo = d.apodo ?? "";
  if (typeof apodo !== "string" || !APODO.test(apodo)) return null;

  if (!esObjeto(d.sesiones) || !esObjeto(d.drills)) return null;
  const idsS = Object.keys(d.sesiones);
  const idsD = Object.keys(d.drills);
  if (idsS.length > MAX_SESIONES || idsD.length > MAX_DRILLS) return null;
  const sesiones = {};
  for (const id of idsS) {
    const s = d.sesiones[id];
    if (!ID.test(id) || !esObjeto(s) || !soloClaves(s, ["fin", "min", "pts"]) || !hora(s.fin)) return null;
    if (s.min !== undefined && !entero(s.min, 1440)) return null;
    if (s.pts !== undefined && !entero(s.pts, 100_000)) return null;
    sesiones[id] = { fin: s.fin, min: s.min ?? 0, pts: s.pts ?? 0 };
  }
  const drills = {};
  for (const id of idsD) {
    const r = d.drills[id];
    if (!ID.test(id) || !esObjeto(r) || !soloClaves(r, ["veces", "ultimo", "pts"]) || !entero(r.veces, 100_000) || !hora(r.ultimo)) return null;
    if (r.pts !== undefined && !entero(r.pts, 100_000)) return null;
    drills[id] = { veces: r.veces, ultimo: r.ultimo, pts: r.pts ?? 0 };
  }
  const ajustes = {};
  if (d.ajustes !== undefined) {
    if (!esObjeto(d.ajustes) || !soloClaves(d.ajustes, AJUSTES)) return null;
    for (const k of AJUSTES) {
      if (d.ajustes[k] === undefined) continue;
      if (typeof d.ajustes[k] !== "boolean") return null;
      ajustes[k] = d.ajustes[k];
    }
  }
  return { v: 1, apodo, nivel: d.nivel, inicio: d.inicio, sesiones, drills, ajustes, actualizado: d.actualizado };
}

/**
 * Fusiona lo guardado con lo que llega: unión de sesiones y drills; `inicio` es el más viejo de los dos (un celu nuevo
 * o la app instalada en iPhone, que arranca con su propio almacenamiento, no reinicia el plan); el resto (apodo, nivel,
 * ajustes) lo define el que tenga el `actualizado` más nuevo (si empatan, gana el que llega). `previo` puede ser null.
 */
export function fusionarProgreso(previo, nuevo) {
  if (!previo) return nuevo;
  const gana = nuevo.actualizado >= previo.actualizado ? nuevo : previo;
  const sesiones = { ...previo.sesiones };
  for (const [id, s] of Object.entries(nuevo.sesiones)) {
    const p = sesiones[id];
    sesiones[id] = !p || s.fin > p.fin || (s.fin === p.fin && s.pts >= p.pts) ? s : p;
  }
  const drills = { ...previo.drills };
  for (const [id, r] of Object.entries(nuevo.drills)) {
    const p = drills[id];
    drills[id] = p ? { veces: Math.max(p.veces, r.veces), ultimo: Math.max(p.ultimo, r.ultimo), pts: Math.max(p.pts, r.pts) } : r;
  }
  return {
    v: 1,
    apodo: gana.apodo,
    nivel: gana.nivel,
    inicio: Math.min(previo.inicio, nuevo.inicio),
    sesiones: recortar(sesiones, MAX_SESIONES, (s) => s.fin),
    drills: recortar(drills, MAX_DRILLS, (r) => r.ultimo),
    ajustes: gana.ajustes,
    actualizado: Math.max(previo.actualizado, nuevo.actualizado),
  };
}

/** Si la unión pasa el tope, se queda con las más recientes. */
function recortar(obj, max, clave) {
  const ids = Object.keys(obj);
  if (ids.length <= max) return obj;
  ids.sort((a, b) => clave(obj[b]) - clave(obj[a]));
  return Object.fromEntries(ids.slice(0, max).map((id) => [id, obj[id]]));
}
