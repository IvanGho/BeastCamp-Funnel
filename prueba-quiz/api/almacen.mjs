// Almacenamiento en DATA_DIR (carpeta 0700, archivos 0600). Solo agregar a los .jsonl; el progreso se escribe de forma atómica.
//   leads.jsonl · clicks.jsonl   registros simples
//   compras.jsonl                eventos de Hilvapay (pagado, reembolso, disputa) + marcas de Meta; al arrancar se relee y arma el índice
//   mails.jsonl                  qué mail salió y para qué cobro (sin contenido ni dirección)
//   progreso/<acceso>.json       progreso del comprador; el nombre sale solo de un UUID validado
import { open, readFile, mkdir, chmod, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { UUID_V4 } from "./util.mjs";

async function carpeta(ruta) {
  await mkdir(ruta, { recursive: true, mode: 0o700 });
  await chmod(ruta, 0o700).catch(() => {});
}

async function leerJsonl(ruta) {
  let texto;
  try {
    texto = await readFile(ruta, "utf8");
  } catch (e) {
    if (e?.code === "ENOENT") return [];
    throw e;
  }
  const filas = [];
  for (const linea of texto.split("\n")) {
    if (!linea.trim()) continue;
    try {
      const o = JSON.parse(linea);
      if (o && typeof o === "object") filas.push(o);
    } catch {
      // línea cortada (corte de luz a mitad de escritura): se saltea, el resto sigue valiendo
    }
  }
  return filas;
}

export async function abrirAlmacen(dir) {
  await carpeta(dir);
  await carpeta(join(dir, "progreso"));

  // ---- escritura de .jsonl: una a la vez por archivo ----
  const colas = new Map();
  const conPermisos = new Set();
  function encolar(clave, tarea) {
    const previa = colas.get(clave) ?? Promise.resolve();
    const siguiente = previa.catch(() => {}).then(tarea);
    colas.set(clave, siguiente);
    siguiente.catch(() => {}).finally(() => {
      if (colas.get(clave) === siguiente) colas.delete(clave);
    });
    return siguiente;
  }
  function anexar(archivo, registro, { sync = false } = {}) {
    const ruta = join(dir, archivo);
    return encolar(ruta, async () => {
      const completo = { ts: new Date().toISOString(), ...registro };
      const linea = JSON.stringify(completo) + "\n";
      const fh = await open(ruta, "a", 0o600);
      try {
        await fh.write(linea);
        if (sync) await fh.datasync();
      } finally {
        await fh.close();
      }
      if (!conPermisos.has(ruta)) {
        await chmod(ruta, 0o600).catch(() => {});
        conPermisos.add(ruta);
      }
      return completo;
    });
  }

  // ---- índice de compras (en memoria) ----
  const cobros = new Map(); // cobroId -> cobro
  const accesos = new Map(); // acceso -> Set(cobroId)
  const porMail = new Map(); // mail -> Set(cobroId)
  const huerfanos = new Map(); // cobroId -> Set(evento): reembolsos o disputas que llegaron antes que el pago
  const mailsEnviados = new Set(); // cobroId con mail de acceso ya enviado

  const sumar = (mapa, clave, valor) => {
    if (!mapa.has(clave)) mapa.set(clave, new Set());
    mapa.get(clave).add(valor);
  };

  /** Aplica un registro de compras.jsonl al índice. Devuelve true si cambió algo. */
  function aplicar(r) {
    if (r.tipo === "pagado") {
      if (typeof r.cobroId !== "string" || cobros.has(r.cobroId) || !UUID_V4.test(r.acceso ?? "")) return false;
      const previos = huerfanos.get(r.cobroId);
      const c = { ...r, tsMs: Date.parse(r.ts) || 0, activo: !previos, eventos: new Set(["pagado", ...(previos ?? [])]), metaEnviado: false };
      cobros.set(c.cobroId, c);
      sumar(accesos, c.acceso, c.cobroId);
      if (c.email) sumar(porMail, c.email, c.cobroId);
      huerfanos.delete(c.cobroId);
      return true;
    }
    if (r.tipo === "reembolso" || r.tipo === "disputa") {
      const c = cobros.get(r.cobroId);
      if (!c) {
        if (typeof r.cobroId !== "string") return false;
        if (!huerfanos.has(r.cobroId) && huerfanos.size >= 10_000) return false; // tope de memoria
        sumar(huerfanos, r.cobroId, r.tipo);
        return true;
      }
      if (c.eventos.has(r.tipo)) return false;
      c.eventos.add(r.tipo);
      c.activo = false;
      return true;
    }
    if (r.tipo === "meta") {
      const c = cobros.get(r.cobroId);
      if (!c) return false;
      c.metaEnviado = true;
      return true;
    }
    return false;
  }

  for (const r of await leerJsonl(join(dir, "compras.jsonl"))) aplicar(r);
  for (const r of await leerJsonl(join(dir, "mails.jsonl"))) if (r.tipo === "acceso" && typeof r.cobroId === "string") mailsEnviados.add(r.cobroId);

  // Escrituras de compras: una a la vez, para que "revisar si existe + guardar + indexar" sea atómico.
  const serie = (tarea) => encolar("compras", tarea);

  function accesoActivoDeMail(mail) {
    const lista = [...(porMail.get(mail) ?? [])].map((id) => cobros.get(id)).filter((c) => c?.activo);
    if (lista.length === 0) return null;
    lista.sort((a, b) => a.tsMs - b.tsMs);
    const c = lista[lista.length - 1];
    return { acceso: c.acceso, nombre: c.nombre };
  }

  function activosDeAcceso(acceso) {
    return [...(accesos.get(acceso) ?? [])].map((id) => cobros.get(id)).filter((c) => c?.activo);
  }

  // ---- progreso ----
  const colasProgreso = new Map();
  const rutaProgreso = (acceso) => {
    if (!UUID_V4.test(acceso)) throw new Error("acceso inválido");
    return join(dir, "progreso", `${acceso}.json`);
  };

  return {
    dir,
    anexar,

    // lectura
    cobro: (id) => cobros.get(id),
    todosLosCobros: () => [...cobros.values()],
    mailEnviado: (cobroId) => mailsEnviados.has(cobroId),

    /** Estado público de un acceso. No devuelve datos de otros accesos. */
    estadoAcceso(acceso) {
      const ids = accesos.get(acceso);
      if (!ids || ids.size === 0) return { estado: "pendiente" };
      const activos = activosDeAcceso(acceso);
      if (activos.length === 0) return { estado: "revocado" };
      activos.sort((a, b) => a.tsMs - b.tsMs);
      // los datos del comprador salen de la compra principal (la del módulo extra no trae nivel ni funnel propios)
      const base = activos.filter((c) => !c.extra);
      const ref = (base.length ? base : activos).at(-1);
      const extras = [...new Set(activos.map((c) => c.extra).filter((x) => x && x !== ref.funnel))];
      return { estado: "activo", nombre: ref.nombre || undefined, funnel: ref.funnel, nivel: ref.nivel || undefined, desde: activos[0].tsMs, ...(extras.length ? { extras } : {}) };
    },

    /** El acceso activo más reciente de un mail (o null). */
    accesoActivoDeMail,

    /**
     * Guarda un pago si el cobro es nuevo. `datos.acceso` puede venir vacío: entonces se reutiliza el último acceso
     * activo de ese mail o se crea uno. Devuelve { nuevo, cobro }. Si no puede guardar, lanza.
     */
    registrarPagado(datos) {
      return serie(async () => {
        const existente = cobros.get(datos.cobroId);
        if (existente) return { nuevo: false, cobro: existente };
        const acceso = datos.acceso || (datos.email && accesoActivoDeMail(datos.email)?.acceso) || randomUUID();
        const registro = { tipo: "pagado", ...datos, acceso };
        aplicar(await anexar("compras.jsonl", registro, { sync: true }));
        return { nuevo: true, cobro: cobros.get(datos.cobroId) };
      });
    },

    /** Reembolso o disputa. Idempotente por (cobro, evento). Cobro desconocido: se anota para cuando llegue el pago. */
    registrarEvento(tipo, cobroId) {
      return serie(async () => {
        const c = cobros.get(cobroId);
        if (c ? c.eventos.has(tipo) : huerfanos.get(cobroId)?.has(tipo)) return { cambio: false };
        aplicar(await anexar("compras.jsonl", { tipo, cobroId }, { sync: true }));
        return { cambio: true, conocido: Boolean(c) };
      });
    },

    marcarMeta(cobroId) {
      return serie(async () => {
        const c = cobros.get(cobroId);
        if (!c || c.metaEnviado) return;
        await anexar("compras.jsonl", { tipo: "meta", cobroId });
        c.metaEnviado = true;
      });
    },

    async marcarMail(tipo, acceso, cobroId) {
      await anexar("mails.jsonl", { tipo, acceso, ...(cobroId ? { cobroId } : {}) });
      if (tipo === "acceso" && cobroId) mailsEnviados.add(cobroId);
    },

    // progreso
    async leerProgreso(acceso) {
      try {
        return JSON.parse(await readFile(rutaProgreso(acceso), "utf8"));
      } catch (e) {
        if (e?.code === "ENOENT") return null;
        return null; // archivo ilegible: se trata como si no hubiera
      }
    },

    /** Lee, fusiona con `fusionar(previo)` y escribe de forma atómica (temporal + rename). Una a la vez por acceso. */
    actualizarProgreso(acceso, fusionar) {
      const ruta = rutaProgreso(acceso);
      const previa = colasProgreso.get(acceso) ?? Promise.resolve();
      const tarea = previa.catch(() => {}).then(async () => {
        let actual = null;
        try {
          actual = JSON.parse(await readFile(ruta, "utf8"));
        } catch {
          actual = null;
        }
        const nuevo = fusionar(actual);
        const tmp = `${ruta}.${randomUUID()}.tmp`;
        const fh = await open(tmp, "w", 0o600);
        try {
          await fh.write(JSON.stringify(nuevo));
          await fh.datasync();
        } finally {
          await fh.close();
        }
        try {
          await rename(tmp, ruta);
        } catch (e) {
          await unlink(tmp).catch(() => {});
          throw e;
        }
        return nuevo;
      });
      colasProgreso.set(acceso, tarea);
      tarea.catch(() => {}).finally(() => {
        if (colasProgreso.get(acceso) === tarea) colasProgreso.delete(acceso);
      });
      return tarea;
    },

    /** Espera a que terminen las escrituras en curso. */
    async vaciar() {
      await Promise.allSettled([...colas.values(), ...colasProgreso.values()]);
    },
  };
}
