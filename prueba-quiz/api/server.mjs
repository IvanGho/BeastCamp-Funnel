// Servicio del quiz y la app BeastCamp. Node 22+, sin dependencias. Detrás de nginx (127.0.0.1).
//   POST /api/lead · POST /api/click                     mail y clic de compra (listas cerradas, 4 KB, límite por IP)
//   POST /api/hilvapay?evento=pagado|reembolso|disputa[&extra=peleador|peso]   aviso de Hilvapay (token Bearer, idempotente por cobroId).
//        `extra` = el aviso es de un módulo extra (upsell) que se suma al acceso del mismo mail.
//   GET  /api/app/<acceso>[/plan[?perfil=peleador|peso]] · PUT /api/app/<acceso>/progreso · POST /api/app/recuperar
//   GET  /salud
// Nunca loguea mails, nombres, IPs ni tokens. Los datos viven en DATA_DIR (ver almacen.mjs). Contrato: sección 4.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { isIP } from "node:net";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { abrirAlmacen } from "./almacen.mjs";
import { armarCorreo, enviarResend } from "./correo.mjs";
import { configMeta, eventoCheckout, eventoPurchase, enviarMeta } from "./meta.mjs";
import { validarProgreso, fusionarProgreso } from "./progreso.mjs";
import { UUID_V4, crearLimitador, esObjeto, igualesSeguro, ipDe, leerBody, limpiarTexto, responder, responderJson, sha256, soloTextos, tipoJson } from "./util.mjs";

const NIVELES = new Set(["", "Estoy empezando", "Menos de 6 meses", "1 a 3 años", "Más de 3 años"]);
// Precios que acepta /api/click. Tienen que coincidir con `precios` de src/datos.js (hay un test que lo controla).
const PRECIOS = new Set(["$9.990", "$7.990", "$4.990"]);
const FUNNELS = new Set(["peleador", "peso"]);
const PAGINAS = new Set(["oferta", "back1", "back2"]);
const NIVELES_APP = new Set(["t1", "t2", "t3", "t4"]);
const UTMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
const EVENTOS = new Set(["pagado", "reembolso", "disputa"]);
// Módulos extra (upsell): otro perfil del plan que se suma al acceso que ya compró el mismo mail.
const EXTRAS = new Set(["peleador", "peso"]);
const MAX_BODY = { lead: 4096, click: 4096, hilvapay: 65_536, progreso: 32_768, recuperar: 1024 };
const LIMITE = { lead: 5, click: 20, estado: 60, plan: 30, progreso: 30, recuperar: 5, authFallida: 10 };
const HORA_MS = 3_600_000;

const soloClaves = (o, claves) => esObjeto(o) && Object.keys(o).every((k) => claves.includes(k));
const texto = (v, max) => typeof v === "string" && v.length <= max && !/[\u0000-\u001f]/.test(v);
const hora = (v) => Number.isFinite(v) && v > 1.6e12 && v < 4.1e12;
const MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalizarMail = (v) => (typeof v === "string" && v.trim().length <= 120 && MAIL.test(v.trim()) ? v.trim().toLowerCase() : "");

export function validar(tipo, d) {
  if (tipo === "lead") {
    if (!soloClaves(d, ["nombre", "mail", "nivel", "t"])) return null;
    if (!texto(d.nombre, 60) || !texto(d.mail, 120) || !MAIL.test(d.mail)) return null;
    if (!NIVELES.has(d.nivel ?? "")) return null;
    if (d.t !== undefined && !hora(d.t)) return null;
    return { nombre: d.nombre.trim(), mail: d.mail.trim().toLowerCase(), nivel: d.nivel ?? "" };
  }
  if (tipo === "click") {
    if (!soloClaves(d, ["precio", "funnel", "pagina", ...UTMS, "fbc", "t"])) return null;
    if (!PRECIOS.has(d.precio)) return null;
    if (d.t !== undefined && !hora(d.t)) return null;
    if (d.funnel !== undefined && !FUNNELS.has(d.funnel)) return null;
    if (d.pagina !== undefined && !PAGINAS.has(d.pagina)) return null;
    const sal = { precio: d.precio };
    if (d.funnel !== undefined) sal.funnel = d.funnel;
    if (d.pagina !== undefined) sal.pagina = d.pagina;
    for (const k of UTMS) {
      if (d[k] === undefined) continue;
      if (typeof d[k] !== "string") return null;
      const v = limpiarTexto(d[k], 200);
      if (v) sal[k] = v;
    }
    if (d.fbc !== undefined) {
      if (typeof d.fbc !== "string") return null;
      const v = limpiarTexto(d.fbc, 300);
      if (v) sal.fbc = v; // solo se usa para Meta; no se guarda
    }
    return sal;
  }
  return null;
}

/** De un cuerpo de Hilvapay saca lo que se guarda, con todo acotado. `null` si falta el cobroId. */
function datosDePago(c) {
  const cobroId = typeof c.cobroId === "string" ? c.cobroId.trim() : "";
  if (!/^[\w.:-]{1,100}$/.test(cobroId)) return null;
  const extra = soloTextos(c.paramsExtra);
  const utms = soloTextos(c.utms);
  const acceso = (extra.acceso ?? "").toLowerCase();
  const montoTxt = typeof c.monto === "number" && Number.isFinite(c.monto) ? String(c.monto) : typeof c.monto === "string" ? c.monto.trim() : "";
  const compra = new Date(typeof c.purchasedAt === "string" ? c.purchasedAt : NaN);
  const ip = typeof c.ip === "string" && isIP(c.ip.trim()) ? c.ip.trim() : "";
  const r = {
    cobroId,
    acceso: UUID_V4.test(acceso) ? acceso : "",
    email: normalizarMail(c.email),
    nombre: limpiarTexto(c.nombre, 60),
    monto: /^\d{1,12}(\.\d{1,4})?$/.test(montoTxt) ? montoTxt : "",
    moneda: typeof c.moneda === "string" && /^[A-Za-z]{3}$/.test(c.moneda) ? c.moneda.toUpperCase() : "",
    funnel: FUNNELS.has(extra.funnel) ? extra.funnel : "peleador",
    nivel: NIVELES_APP.has(extra.nivel) ? extra.nivel : "",
    pagina: PAGINAS.has(extra.pagina) ? extra.pagina : "",
    producto: limpiarTexto(c.whopPlanId, 100),
    purchasedAt: Number.isNaN(compra.getTime()) ? "" : compra.toISOString(),
    fbclid: limpiarTexto(c.fbclid ?? extra.fbclid, 300),
    fbc: limpiarTexto(c.fbc ?? extra.fbc, 300),
    fbp: limpiarTexto(c.fbp ?? extra.fbp, 300),
    ip,
    ua: limpiarTexto(c.userAgent, 500),
  };
  for (const k of UTMS) {
    const v = limpiarTexto(utms[k], 200);
    if (v) r[k] = v;
  }
  return r;
}

/** Lee la garantía de src/datos.js (un solo lugar para el dato). Si el archivo no está, 30. */
async function leerGarantia() {
  try {
    const t = await readFile(new URL("../src/datos.js", import.meta.url), "utf8");
    const m = /garantiaDias:\s*(\d{1,3})/.exec(t);
    if (m) return Number(m[1]);
  } catch {
    // sin datos.js en el servidor: se usa el valor por defecto
  }
  return 30;
}

/**
 * Crea el servicio. Carga lo guardado en `dataDir` y devuelve { manejar(req, res), cerrar() }.
 * Para pruebas: `planDe`, `fetch` (Resend y Meta), `garantiaDias` y `esperaReintentoMs` se pueden inyectar.
 */
export async function crearServicio({ dataDir, env = process.env, planDe, fetch: fetchInyectado, garantiaDias, esperaReintentoMs = 1000, log } = {}) {
  const e = (k) => String(env[k] ?? "").trim();
  const salida = log ?? ((m) => console.log(m)); // se busca console.log en cada uso (los tests lo reemplazan)
  const registrar = (m) => salida(m);
  const hacerFetch = fetchInyectado ?? ((...a) => globalThis.fetch(...a));

  const dir = dataDir || e("DATA_DIR") || e("STATE_DIRECTORY") || "/data";
  const FUNNEL_FIJO = FUNNELS.has(e("FUNNEL_FIJO")) ? e("FUNNEL_FIJO") : "";   // peleador | peso: si está, este servicio es de ese producto y nada más
  const baseCruda = e("BASE_URL").replace(/\/+$/, "");
  const baseUrl = /^https?:\/\/[^\s/?#]+$/i.test(baseCruda) ? baseCruda : "";
  const consola = e("MAIL_A_CONSOLA") === "1";
  const apiKey = e("RESEND_API_KEY");
  const desde = e("MAIL_DESDE");
  const tokenHilvapay = e("HILVAPAY_WEBHOOK_TOKEN");
  const meta = configMeta(e);
  const garantia = garantiaDias ?? (await leerGarantia());
  const mailListo = consola || Boolean(apiKey && desde && baseUrl);
  const baseLink = baseUrl || (consola ? "http://localhost" : "");
  if (baseCruda && !baseUrl) registrar("BASE_URL inválida: se ignora");

  const alm = await abrirAlmacen(dir);
  const lim = crearLimitador();
  const enCurso = new Set();
  const segundoPlano = new Set();
  const intentosBarrido = new Map();

  // ---- trabajo en segundo plano (mail y Meta); nunca rompe la respuesta ----
  function enSegundoPlano(tarea) {
    const p = Promise.resolve()
      .then(tarea)
      .catch(() => registrar("error en segundo plano"))
      .finally(() => segundoPlano.delete(p));
    segundoPlano.add(p);
    return p;
  }
  async function esperar() {
    while (segundoPlano.size) await Promise.allSettled([...segundoPlano]);
    await alm.vaciar();
  }
  async function unaVez(clave, tarea) {
    if (enCurso.has(clave)) return;
    enCurso.add(clave);
    try {
      await tarea();
    } finally {
      enCurso.delete(clave);
    }
  }

  const linkDe = (acceso) => `${baseLink}/app/${acceso}/`;

  /** Manda el mail (o lo muestra en consola en desarrollo). Devuelve true si salió. */
  async function mandarCorreo({ tipo, para, nombre, acceso, claveIdem }) {
    const link = linkDe(acceso);
    if (consola) {
      registrar(`[desarrollo] link de la app: ${link}`);
      return true;
    }
    const { asunto, html, texto: plano } = armarCorreo({ tipo, nombre, link, garantiaDias: garantia });
    const r = await enviarResend({ fetch: hacerFetch, apiKey, desde, para, asunto, html, texto: plano, claveIdem, esperaMs: esperaReintentoMs });
    registrar(r.ok ? `mail ${tipo} enviado` : `mail ${tipo} falló (http ${r.estado})`);
    return r.ok;
  }

  async function correoDeAcceso(cobroId) {
    const c = alm.cobro(cobroId);
    if (!c || !c.activo || !c.email || alm.mailEnviado(cobroId) || !mailListo) return;
    await unaVez(`mail:${cobroId}`, async () => {
      if (alm.mailEnviado(cobroId)) return;
      const ok = await mandarCorreo({ tipo: "acceso", para: c.email, nombre: c.nombre, acceso: c.acceso, claveIdem: `bc-acceso-${cobroId}` });
      if (ok) await alm.marcarMail("acceso", c.acceso, cobroId);
    });
  }

  async function compraEnMeta(cobroId) {
    const c = alm.cobro(cobroId);
    if (!meta.activo || !c || !c.activo || c.metaEnviado) return;
    await unaVez(`meta:${cobroId}`, async () => {
      const evento = eventoPurchase({ cobro: c, baseUrl });
      if (!evento) return registrar("meta Purchase omitido: monto o moneda inválidos");
      const r = await enviarMeta({ fetch: hacerFetch, config: meta, evento, esperaMs: esperaReintentoMs });
      registrar(r.ok ? "meta Purchase enviado" : `meta Purchase falló (http ${r.estado})`);
      if (r.ok) await alm.marcarMeta(cobroId);
    });
  }

  const despuesDelPago = (cobroId) =>
    Promise.allSettled([alm.cobro(cobroId)?.extra ? Promise.resolve() : correoDeAcceso(cobroId), compraEnMeta(cobroId)]);

  /** Reintenta lo pendiente de las últimas 24 horas (mails y Purchase que no salieron: corte, caída de Resend o de Meta). */
  async function barrer() {
    const desdeMs = Date.now() - 24 * HORA_MS;
    for (const c of alm.todosLosCobros()) {
      if (!c.activo || c.tsMs < desdeMs) continue;
      const pendiente = (mailListo && c.email && !c.extra && !alm.mailEnviado(c.cobroId)) || (meta.activo && !c.metaEnviado);
      const n = intentosBarrido.get(c.cobroId) ?? 0;
      if (!pendiente || n >= 6) continue;
      intentosBarrido.set(c.cobroId, n + 1);
      await despuesDelPago(c.cobroId);
    }
  }

  // ---- plan (lo escribe la tarea de contenido; si todavía no existe, el endpoint responde 503) ----
  let planFn = planDe ?? null;
  async function obtenerPlan(funnel) {
    if (!planFn) {
      try {
        planFn = (await import("../contenido/plan.mjs")).planDe;
      } catch {
        return null;
      }
    }
    try {
      return (await planFn(funnel)) ?? null;
    } catch {
      return null;
    }
  }

  // ---- manejadores ----
  async function leerJson(req, res, max) {
    if (!tipoJson(req)) return void responder(res, 415);
    try {
      return JSON.parse(await leerBody(req, max));
    } catch (err) {
      responder(res, err?.codigo === 413 ? 413 : 400);
    }
  }

  async function guardarSimple(req, res, tipo, ip) {
    if (!lim.permitir(`${tipo}|${ip}`, LIMITE[tipo])) return responder(res, 429);
    const datos = await leerJson(req, res, MAX_BODY[tipo]);
    if (datos === undefined) return;
    const limpio = validar(tipo, datos);
    if (!limpio) return responder(res, 400);
    if (tipo === "lead") {
      await alm.anexar("leads.jsonl", limpio);
    } else {
      const { fbc, ...guardar } = limpio; // el fbc no se guarda
      await alm.anexar("clicks.jsonl", guardar);
      if (meta.activo) {
        const ua = limpiarTexto(req.headers["user-agent"], 500);
        enSegundoPlano(async () => {
          const evento = eventoCheckout({ precio: limpio.precio, funnel: limpio.funnel, pagina: limpio.pagina, fbc, ip, ua, baseUrl });
          const r = await enviarMeta({ fetch: hacerFetch, config: meta, evento, esperaMs: esperaReintentoMs });
          if (!r.ok) registrar(`meta InitiateCheckout falló (http ${r.estado})`);
        });
      }
    }
    registrar(`${tipo} guardado`); // nunca el contenido
    return responder(res, 204);
  }

  async function hilvapay(req, res, url, ip) {
    if (!tokenHilvapay) {
      registrar("hilvapay: falta HILVAPAY_WEBHOOK_TOKEN, se rechaza el aviso");
      return responder(res, 503);
    }
    if (!lim.libre(`auth|${ip}`, LIMITE.authFallida)) return responder(res, 429);
    const m = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization ?? ""));
    if (!m || !igualesSeguro(m[1].trim(), tokenHilvapay)) {
      lim.anotar(`auth|${ip}`);
      registrar("hilvapay: token ausente o incorrecto");
      return responder(res, 401);
    }
    const evento = url.searchParams.get("evento");
    if (!EVENTOS.has(evento)) return responder(res, 400);
    const cuerpo = await leerJson(req, res, MAX_BODY.hilvapay);
    if (cuerpo === undefined) return;
    if (!esObjeto(cuerpo)) return responder(res, 400);
    // Ping de prueba del panel de Hilvapay: 200 y sin efectos.
    if (cuerpo.whopPlanId === "prueba-generica" || (typeof cuerpo.cobroId === "string" && cuerpo.cobroId.startsWith("test_"))) {
      registrar("hilvapay: ping de prueba");
      return responderJson(res, 200, { ok: true, ping: true });
    }
    const datos = datosDePago(cuerpo);
    if (datos && FUNNEL_FIJO) datos.funnel = FUNNEL_FIJO;   // cada dominio vende un solo producto
    const extra = url.searchParams.get("extra");
    if (extra !== null) {
      if (!EXTRAS.has(extra)) return responder(res, 400);
      if (datos) datos.extra = extra;
    }
    if (!datos) return responder(res, 400);
    // IP, navegador y los identificadores de anuncios solo sirven para mandarle la compra a Meta:
    // sin Meta configurado no se guardan (menos datos personales en disco).
    if (!meta.activo) for (const k of ["ip", "ua", "fbclid", "fbc", "fbp"]) datos[k] = "";
    const corto = datos.cobroId.slice(0, 8);
    try {
      if (evento === "pagado") {
        const { nuevo } = await alm.registrarPagado(datos);
        registrar(`hilvapay: pagado ${nuevo ? "guardado" : "repetido"} (${corto})`);
        responderJson(res, 200, { ok: true });
        if (nuevo) enSegundoPlano(() => despuesDelPago(datos.cobroId));
        return;
      }
      const r = await alm.registrarEvento(evento, datos.cobroId);
      registrar(`hilvapay: ${evento} ${r.cambio ? "guardado" : "repetido"} (${corto})`);
      return responderJson(res, 200, { ok: true });
    } catch {
      registrar("hilvapay: no se pudo guardar el aviso");
      return responder(res, 503); // Hilvapay reintenta
    }
  }

  async function estado(res, acceso, ip) {
    if (!lim.permitir(`estado|${ip}`, LIMITE.estado)) return responder(res, 429);
    const est = alm.estadoAcceso(acceso);
    if (est.estado !== "activo") return responderJson(res, 200, { estado: est.estado });
    const progreso = await alm.leerProgreso(acceso);
    return responderJson(res, 200, { ...est, ...(progreso ? { progreso } : {}) });
  }

  async function plan(req, res, acceso, ip, url) {
    if (!lim.permitir(`plan|${ip}`, LIMITE.plan)) return responder(res, 429);
    const est = alm.estadoAcceso(acceso);
    if (est.estado !== "activo") return responder(res, 403);
    // ?perfil= elige entre el perfil comprado y los módulos extra; uno no comprado da 404 (403 haría que la app recargue el acceso)
    const pedido = url.searchParams.get("perfil");
    const perfil = pedido === null || pedido === est.funnel ? est.funnel : (est.extras ?? []).includes(pedido) ? pedido : null;
    if (!perfil) return responder(res, 404);
    const p = await obtenerPlan(perfil);
    if (!p) {
      registrar("plan: no disponible");
      return responder(res, 503);
    }
    const cuerpo = JSON.stringify(p);
    const etag = `"${createHash("sha256").update(cuerpo).digest("hex").slice(0, 24)}"`;
    const cab = { "cache-control": "private, no-cache", etag };
    if (req.headers["if-none-match"] === etag) {
      res.writeHead(304, { "x-content-type-options": "nosniff", ...cab });
      return void res.end();
    }
    res.writeHead(200, { "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff", ...cab });
    return void res.end(cuerpo);
  }

  async function guardarProgreso(req, res, acceso, ip) {
    if (!lim.permitir(`progreso|${ip}`, LIMITE.progreso)) return responder(res, 429);
    if (alm.estadoAcceso(acceso).estado !== "activo") return responder(res, 403);
    const datos = await leerJson(req, res, MAX_BODY.progreso);
    if (datos === undefined) return;
    const limpio = validarProgreso(datos);
    if (!limpio) return responder(res, 400);
    try {
      await alm.actualizarProgreso(acceso, (previo) => fusionarProgreso(previo ? validarProgreso(previo) : null, limpio));
    } catch {
      registrar("progreso: no se pudo guardar");
      return responder(res, 503);
    }
    return responder(res, 204);
  }

  async function recuperar(req, res, ip) {
    // Responde 204 siempre (exista o no el mail, con o sin límite) para no revelar quién compró.
    if (!lim.permitir(`recuperar|${ip}`, LIMITE.recuperar)) return responder(res, 204);
    const datos = await leerJson(req, res, MAX_BODY.recuperar);
    if (datos === undefined) return;
    if (!soloClaves(datos, ["mail"]) || typeof datos.mail !== "string") return responder(res, 400);
    const mail = normalizarMail(datos.mail);
    responder(res, 204);
    if (!mail || !lim.permitir(`recuperar-mail|${sha256(mail)}`, 3, HORA_MS)) return;
    enSegundoPlano(async () => {
      const a = alm.accesoActivoDeMail(mail);
      if (!a || !mailListo) return;
      if (await mandarCorreo({ tipo: "recuperar", para: mail, nombre: a.nombre, acceso: a.acceso })) await alm.marcarMail("recuperar", a.acceso);
    });
  }

  async function manejar(req, res) {
    try {
      let url;
      try {
        url = new URL(req.url ?? "/", "http://localhost");
      } catch {
        return responder(res, 400);
      }
      const ruta = url.pathname;
      const metodo = req.method ?? "GET";
      const soloMetodo = (ok) => (metodo === ok ? false : (responder(res, 405, "", { allow: ok }), true));
      if (ruta === "/salud") {
        if (metodo !== "GET" && metodo !== "HEAD") return responder(res, 405, "", { allow: "GET, HEAD" });
        return responder(res, 200, "ok\n");
      }
      if (!ruta.startsWith("/api/")) return responder(res, 404);
      const ip = ipDe(req);

      if (ruta === "/api/lead" || ruta === "/api/click") {
        if (soloMetodo("POST")) return;
        return await guardarSimple(req, res, ruta === "/api/lead" ? "lead" : "click", ip);
      }
      if (ruta === "/api/hilvapay") {
        if (soloMetodo("POST")) return;
        return await hilvapay(req, res, url, ip);
      }
      if (ruta === "/api/app/recuperar") {
        if (soloMetodo("POST")) return;
        return await recuperar(req, res, ip);
      }
      const m = /^\/api\/app\/([^/]+)(?:\/(plan|progreso))?$/.exec(ruta);
      if (m) {
        const [, acceso, sub] = m;
        if (!UUID_V4.test(acceso)) return responder(res, 400);
        if (!sub) return soloMetodo("GET") ? undefined : await estado(res, acceso, ip);
        if (sub === "plan") return soloMetodo("GET") ? undefined : await plan(req, res, acceso, ip, url);
        return soloMetodo("PUT") ? undefined : await guardarProgreso(req, res, acceso, ip);
      }
      return responder(res, 404);
    } catch {
      registrar("error interno");
      if (!res.headersSent) responder(res, 500);
      else res.end();
    }
  }

  // limpieza de límites y reintento de lo pendiente
  const timers = [setInterval(() => lim.limpiar(), 60_000), setInterval(() => void barrer().catch(() => {}), 5 * 60_000)];
  timers.push(setTimeout(() => void barrer().catch(() => {}), 3000));
  for (const t of timers) t.unref();

  return {
    manejar,
    async cerrar() {
      for (const t of timers) {
        clearInterval(t);
        clearTimeout(t);
      }
      await esperar();
    },
    // Extras para pruebas y operación
    esperar,
    barrer,
  };
}

function servidorHttp(manejar) {
  const srv = createServer(async (req, res) => {
    try {
      await manejar(req, res);
    } catch {
      console.log("error interno");
      if (!res.headersSent) responder(res, 500);
    }
  });
  srv.headersTimeout = 10_000;
  srv.requestTimeout = 20_000;
  srv.keepAliveTimeout = 5_000;
  return srv;
}

/** Servidor HTTP ya armado (lo usa el test existente). Carga el servicio en el primer pedido; al cerrarse, lo cierra. */
export function crear(opciones = {}) {
  const servicio = crearServicio(opciones);
  servicio.catch(() => {}); // si falla al abrir, cada pedido responde 500 (no se cae el proceso)
  const srv = servidorHttp(async (req, res) => (await servicio).manejar(req, res));
  srv.on("close", () => void servicio.then((s) => s.cerrar()).catch(() => {}));
  return srv;
}

const esPrincipal = (() => {
  try {
    return Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
})();
if (esPrincipal) {
  process.on("unhandledRejection", () => console.log("promesa rechazada sin manejar"));
  process.on("uncaughtException", () => {
    console.log("error no capturado: se reinicia");
    process.exit(1);
  });
  const servicio = await crearServicio();
  const servidor = servidorHttp(servicio.manejar);
  const puerto = Number(process.env.PORT) || 3000;
  // Solo escucha en el propio equipo: nginx es la única puerta. HOST=0.0.0.0 solo para contenedores.
  servidor.listen(puerto, (process.env.HOST || "").trim() || "127.0.0.1", () => console.log(`api escuchando en ${puerto}`));
  let cerrando = false;
  for (const senal of ["SIGTERM", "SIGINT"]) {
    process.on(senal, () => {
      if (cerrando) return;
      cerrando = true;
      setTimeout(() => process.exit(0), 8000).unref();
      servidor.close(async () => {
        await servicio.cerrar().catch(() => {});
        process.exit(0);
      });
    });
  }
}
