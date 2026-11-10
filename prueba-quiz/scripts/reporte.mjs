#!/usr/bin/env node
// Reporte de ventas a partir de los archivos del servicio (clicks.jsonl y compras.jsonl). No muestra datos personales:
// no lee mails, nombres, IPs ni accesos; solo cuenta por funnel, página y UTM.
// Uso: node prueba-quiz/scripts/reporte.mjs [--datos <carpeta>] [--desde AAAA-MM-DD] [--json]
//      (sin --datos usa la variable DATA_DIR)
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const valor = (nombre) => {
  const i = args.indexOf(nombre);
  return i >= 0 ? args[i + 1] : undefined;
};
if (args.includes("--ayuda") || args.includes("-h")) {
  console.log("Uso: node prueba-quiz/scripts/reporte.mjs [--datos <carpeta>] [--desde AAAA-MM-DD] [--json]\nSin --datos usa DATA_DIR.");
  process.exit(0);
}
const carpeta = valor("--datos") || process.env.DATA_DIR;
if (!carpeta) {
  console.error("Falta la carpeta de datos: pasá --datos <carpeta> o definí DATA_DIR.");
  process.exit(1);
}
const desdeTxt = valor("--desde");
if (desdeTxt && !/^\d{4}-\d{2}-\d{2}$/.test(desdeTxt)) {
  console.error("--desde tiene que ser AAAA-MM-DD (por ejemplo 2026-11-12).");
  process.exit(1);
}
const desdeMs = desdeTxt ? Date.parse(`${desdeTxt}T00:00:00Z`) : 0;
if (desdeTxt && Number.isNaN(desdeMs)) {
  console.error("--desde no es una fecha válida.");
  process.exit(1);
}

function leerJsonl(nombre) {
  const ruta = join(carpeta, nombre);
  if (!existsSync(ruta)) return [];
  const filas = [];
  for (const l of readFileSync(ruta, "utf8").split("\n")) {
    if (!l.trim()) continue;
    try {
      filas.push(JSON.parse(l));
    } catch {
      // línea cortada: se saltea
    }
  }
  return filas;
}
const enRango = (r) => !desdeMs || (Date.parse(r.ts) || 0) >= desdeMs;

const clics = leerJsonl("clicks.jsonl").filter(enRango);
const registros = leerJsonl("compras.jsonl");

// compras: un cobro por cobroId (el primer "pagado"); reembolsos y disputas se ligan por cobroId aunque sean de otra fecha
const cobros = new Map();
for (const r of registros) if (r.tipo === "pagado" && r.cobroId && !cobros.has(r.cobroId) && enRango(r)) cobros.set(r.cobroId, { ...r, reembolsado: false, disputado: false });
for (const r of registros) {
  const c = cobros.get(r.cobroId);
  if (!c) continue;
  if (r.tipo === "reembolso") c.reembolsado = true;
  if (r.tipo === "disputa") c.disputado = true;
}

const SIN = "(sin dato)";
const dato = (v) => (v === undefined || v === null || v === "" ? SIN : String(v));
const etiqueta = (v) => (v === SIN || v === "(directo)" ? "(directo)" : v);

function agrupar(claveClic, claveCobro) {
  const filas = new Map();
  const fila = (k) => {
    if (!filas.has(k)) filas.set(k, { clave: k, clics: 0, compras: 0, reembolsos: 0, disputas: 0, ingresos: {}, devuelto: {} });
    return filas.get(k);
  };
  for (const c of clics) fila(claveClic(c)).clics++;
  for (const c of cobros.values()) {
    const f = fila(claveCobro(c));
    f.compras++;
    const moneda = c.moneda || "?";
    const monto = Number(c.monto) || 0;
    if (c.reembolsado) f.reembolsos++;
    if (c.disputado) f.disputas++;
    const bucket = c.reembolsado || c.disputado ? f.devuelto : f.ingresos;
    bucket[moneda] = (bucket[moneda] ?? 0) + monto;
  }
  return [...filas.values()].sort((a, b) => b.compras - a.compras || b.clics - a.clics || a.clave.localeCompare(b.clave));
}

const porPagina = agrupar(
  (c) => `${dato(c.funnel)} / ${dato(c.pagina)}`,
  (c) => `${dato(c.funnel)} / ${dato(c.pagina)}`,
);
const porUtm = agrupar(
  (c) => `${etiqueta(dato(c.utm_campaign))} | ${etiqueta(dato(c.utm_content))}`,
  (c) => `${etiqueta(dato(c.utm_campaign))} | ${etiqueta(dato(c.utm_content))}`,
);

const total = {
  clics: clics.length,
  compras: cobros.size,
  reembolsos: [...cobros.values()].filter((c) => c.reembolsado).length,
  disputas: [...cobros.values()].filter((c) => c.disputado).length,
  ingresos: {},
};
for (const c of cobros.values()) if (!c.reembolsado && !c.disputado) total.ingresos[c.moneda || "?"] = (total.ingresos[c.moneda || "?"] ?? 0) + (Number(c.monto) || 0);

if (args.includes("--json")) {
  console.log(JSON.stringify({ desde: desdeTxt ?? null, total, porPagina, porUtm }, null, 2));
  process.exit(0);
}

const dinero = (o) => Object.entries(o).filter(([, v]) => v).map(([m, v]) => `${v.toLocaleString("es-AR", { maximumFractionDigits: 2 })} ${m}`).join(" + ") || "0";
const conversion = (f) => (f.clics ? `${((f.compras / f.clics) * 100).toFixed(1)} %` : "-");

function tabla(titulo, primera, filas) {
  const cab = [primera, "Clics", "Compras", "Reemb.", "Disputas", "Ingresos", "Clic a compra"];
  const cuerpo = filas.map((f) => [f.clave, f.clics, f.compras, f.reembolsos, f.disputas, dinero(f.ingresos), conversion(f)].map(String));
  const anchos = cab.map((h, i) => Math.max(h.length, ...cuerpo.map((r) => r[i].length)));
  const linea = (r) => r.map((c, i) => (i === 0 ? c.padEnd(anchos[i]) : c.padStart(anchos[i]))).join("  ");
  console.log(`\n${titulo}`);
  console.log(linea(cab));
  console.log(anchos.map((a) => "-".repeat(a)).join("  "));
  if (cuerpo.length === 0) console.log("(sin datos)");
  for (const r of cuerpo) console.log(linea(r));
}

console.log(`Reporte BeastCamp${desdeTxt ? ` desde ${desdeTxt}` : " (todo el período)"}`);
console.log(`Total: ${total.clics} clics, ${total.compras} compras (${total.reembolsos} reembolsos, ${total.disputas} disputas), ingresos ${dinero(total.ingresos)}`);
tabla("Por funnel y página", "Funnel / página", porPagina);
tabla("Por campaña y anuncio (utm_campaign | utm_content)", "Campaña | anuncio", porUtm);
console.log("\nIngresos = compras sin reembolso ni disputa. Clic a compra = compras / clics de esa fila; las compras pueden venir de clics de días anteriores.");
if (clics.length === 0 && cobros.size === 0) console.log("Todavía no hay datos en esa carpeta para ese período.");
