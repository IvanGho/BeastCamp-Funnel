// Servicio de la app (prueba-quiz/api): webhook de Hilvapay, estado, plan, progreso, recuperar, mails (Resend) y Meta (CAPI).
// Todo con fetch inyectado: no sale nada a la red. Carpeta de datos temporal por prueba. Puertos aleatorios (nunca el 4173).
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { test } from "node:test";

const { crearServicio, validar } = await import("../prueba-quiz/api/server.mjs");
const { ipDe, igualesSeguro } = await import("../prueba-quiz/api/util.mjs");
const { validarProgreso, fusionarProgreso } = await import("../prueba-quiz/api/progreso.mjs");

const TOKEN = "token-de-hilvapay-12345";
const RESEND = "re_clave_resend_secreta";
const META_TOKEN = "EAAmeta_token_secreto";
const PIXEL = "123456789012345";
const BASE = "https://beast.example";
const ACC_A = "a1111111-1111-4111-8111-111111111111";
const ACC_B = "b2222222-2222-4222-9222-222222222222";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const T0 = 1762000000000;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

type Montaje = Awaited<ReturnType<typeof montar>>;
const montajes: Montaje[] = [];

/** Monta un servicio con datos en una carpeta temporal, fetch falso y un servidor HTTP en un puerto aleatorio. */
async function montar(opciones: { dir?: string; env?: Record<string, string | undefined>; planDe?: unknown; estado?: (url: string, intento: number) => number } = {}) {
  const dir = opciones.dir ?? mkdtempSync(`${tmpdir()}/bcapp-`);
  const llamadas: { url: string; init: any; json: any }[] = [];
  const logs: string[] = [];
  const intentos: Record<string, number> = {};
  const orig = { log: console.log, error: console.error, warn: console.warn };
  const guardar = (...a: unknown[]) => void logs.push(a.join(" "));
  console.log = guardar;
  console.error = guardar;
  console.warn = guardar;
  const fetchFalso = async (url: string, init: any) => {
    const host = new URL(url).host;
    intentos[host] = (intentos[host] ?? 0) + 1;
    llamadas.push({ url, init, json: init?.body ? JSON.parse(init.body) : null });
    const status = opciones.estado?.(url, intentos[host]) ?? 200;
    return { ok: status >= 200 && status < 300, status, text: async () => "{}" };
  };
  const env: Record<string, string | undefined> = {
    HILVAPAY_WEBHOOK_TOKEN: TOKEN,
    BASE_URL: BASE,
    RESEND_API_KEY: RESEND,
    MAIL_DESDE: "BeastCamp <acceso@beast.example>",
    META_PIXEL_ID: PIXEL,
    META_CAPI_TOKEN: META_TOKEN,
    ...opciones.env,
  };
  const servicio = await crearServicio({
    dataDir: dir,
    env,
    planDe: (opciones.planDe as any) ?? ((funnel: string) => ({ funnel, version: "t", niveles: [{ id: "t1" }] })),
    fetch: fetchFalso as any,
    esperaReintentoMs: 1,
    garantiaDias: 30,
  });
  const srv = createServer((req, res) => void servicio.manejar(req, res));
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(srv.address() as { port: number }).port}`;
  const pedir = (ruta: string, o: { metodo?: string; cuerpo?: unknown; cab?: Record<string, string>; ip?: string } = {}) =>
    fetch(url + ruta, {
      method: o.metodo ?? "GET",
      headers: { ...(o.cuerpo !== undefined ? { "content-type": "application/json" } : {}), ...(o.ip ? { "x-real-ip": o.ip } : {}), ...o.cab },
      body: o.cuerpo === undefined ? undefined : typeof o.cuerpo === "string" ? o.cuerpo : JSON.stringify(o.cuerpo),
    });
  const hp = (evento: string, cuerpo: unknown, token: string | null = TOKEN) =>
    pedir(`/api/hilvapay?evento=${evento}`, { metodo: "POST", cuerpo, cab: token === null ? {} : { authorization: `Bearer ${token}` } });
  const m = {
    dir,
    url,
    servicio,
    llamadas,
    logs,
    pedir,
    hp,
    resend: () => llamadas.filter((l) => l.url.startsWith("https://api.resend.com/")),
    meta: () => llamadas.filter((l) => l.url.startsWith("https://graph.facebook.com/")),
    lineas: (archivo: string) => (existsSync(`${dir}/${archivo}`) ? readFileSync(`${dir}/${archivo}`, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []),
    async cerrar() {
      await servicio.cerrar();
      await new Promise((r) => srv.close(r));
      console.log = orig.log;
      console.error = orig.error;
      console.warn = orig.warn;
    },
    /** Pago + espera del segundo plano (mail y Meta). */
    async pagar(cuerpo: unknown) {
      const r = await hp("pagado", cuerpo);
      await servicio.esperar();
      return r;
    },
  };
  montajes.push(m);
  return m;
}

/** Cierra todo lo que se montó en la prueba, pase lo que pase. */
async function conServicio(opciones: Parameters<typeof montar>[0], prueba: (m: Montaje) => Promise<void>) {
  const m = await montar(opciones);
  try {
    await prueba(m);
  } finally {
    await m.cerrar();
  }
}

let n = 0;
function pago(extra: Record<string, unknown> = {}) {
  n++;
  return {
    cobroId: `cobro-${n}-${Math.random().toString(36).slice(2, 8)}`,
    whopPlanId: "beastcamp-base",
    email: "Martin@Correo.com",
    nombre: "Martín Pérez",
    monto: "9990.00",
    moneda: "ARS",
    purchasedAt: new Date().toISOString(),
    utms: { utm_source: "facebook", utm_medium: "paid", utm_campaign: "camp-uno", utm_content: "ad-uno", utm_term: "(directo)" },
    fbclid: "IwAR0abc",
    fbc: "fb.1.1760360000000.IwAR0abc",
    fbp: "fb.1.1760360000000.1234567890",
    sessionId: "sesion-de-hilvapay",
    ip: "203.0.113.25",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)",
    paramsExtra: { acceso: ACC_A, funnel: "peso", nivel: "t2", pagina: "oferta" },
    pasoFunnel: null,
    ...extra,
  };
}

function prog(extra: Record<string, unknown> = {}) {
  return {
    v: 1,
    apodo: "Martín",
    nivel: "t2",
    inicio: T0,
    sesiones: { "peso-t1-s1-1": { fin: T0 + 1000, min: 32, pts: 320 } },
    drills: { "drill-jab-60": { veces: 3, ultimo: T0 + 2000, pts: 90 } },
    ajustes: { sonido: true, voz: true, vibracion: true },
    actualizado: T0 + 3000,
    ...extra,
  };
}

test("api-app: webhook con token ausente, incorrecto y correcto; sin la variable responde 503", async () => {
  await conServicio({}, async (m) => {
    const c = pago();
    assert.equal((await m.hp("pagado", c, null)).status, 401, "sin token");
    assert.equal((await m.pedir("/api/hilvapay?evento=pagado", { metodo: "POST", cuerpo: c, cab: { authorization: "Basic abc" } })).status, 401, "esquema distinto");
    assert.equal((await m.hp("pagado", c, "token-equivocado")).status, 401, "token incorrecto");
    assert.equal((await m.hp("pagado", c, TOKEN + "x")).status, 401, "token más largo");
    assert.equal(m.lineas("compras.jsonl").length, 0, "nada se guardó");
    assert.equal((await m.hp("otro", c)).status, 400, "evento inválido");
    assert.equal((await m.pedir("/api/hilvapay", { metodo: "POST", cuerpo: c, cab: { authorization: `Bearer ${TOKEN}` } })).status, 400, "sin evento");
    assert.equal((await m.pedir("/api/hilvapay?evento=pagado")).status, 405, "solo POST");
    assert.equal((await m.hp("pagado", { ...c, cobroId: undefined })).status, 400, "sin cobroId");
    assert.equal((await m.hp("pagado", [1, 2])).status, 400, "cuerpo que no es un objeto");
    assert.equal((await m.hp("pagado", "{no json")).status, 400, "JSON roto");
    assert.equal((await m.hp("pagado", c)).status, 200, "token correcto");
  });
  await conServicio({ env: { HILVAPAY_WEBHOOK_TOKEN: undefined } }, async (m) => {
    assert.equal((await m.hp("pagado", pago())).status, 503, "sin HILVAPAY_WEBHOOK_TOKEN no se acepta nada");
    assert.equal((await m.hp("pagado", pago(), "")).status, 503);
    assert.match(m.logs.join("\n"), /falta HILVAPAY_WEBHOOK_TOKEN/);
    assert.equal(m.lineas("compras.jsonl").length, 0);
  });
});

test("api-app: demasiados tokens incorrectos desde la misma IP cortan con 429", async () => {
  await conServicio({}, async (m) => {
    let cortado = 0;
    for (let i = 0; i < 14; i++) if ((await m.hp("pagado", pago(), "mal")).status === 429) cortado++;
    assert.ok(cortado >= 3, "después de 10 intentos fallidos se corta");
    assert.equal((await m.hp("pagado", pago())).status, 429, "ni con el token bueno mientras dure el corte");
  });
});

test("api-app: el ping de prueba de Hilvapay responde 200 y no registra nada", async () => {
  await conServicio({}, async (m) => {
    for (const cuerpo of [
      { cobroId: "test_1760360000000", whopPlanId: "prueba-generica", email: "dueño@correo.com", monto: "7799.00", moneda: "ARS", utms: { utm_source: "test" }, pasoFunnel: null },
      { cobroId: "test_1760360000001", whopPlanId: "beastcamp-base", email: "dueño@correo.com", monto: "7799.00", moneda: "ARS", pasoFunnel: null },
      { cobroId: "00000000-0000-0000-0000-000000000010", whopPlanId: "prueba-generica", email: "x@y.co", monto: "1.00", moneda: "ARS" },
    ]) {
      const r = await m.hp("pagado", cuerpo);
      assert.equal(r.status, 200);
      assert.deepEqual(await r.json(), { ok: true, ping: true });
    }
    await m.servicio.esperar();
    assert.equal(m.lineas("compras.jsonl").length, 0);
    assert.equal(m.llamadas.length, 0, "ni mail ni Meta");
  });
});

test("api-app: pagado es idempotente por cobroId (un registro, un mail, un Purchase)", async () => {
  await conServicio({}, async (m) => {
    const c = pago();
    for (let i = 0; i < 3; i++) assert.equal((await m.pagar(c)).status, 200);
    const reg = m.lineas("compras.jsonl").filter((r) => r.tipo === "pagado");
    assert.equal(reg.length, 1);
    assert.equal(reg[0].acceso, ACC_A);
    assert.equal(m.resend().length, 1, "un solo mail");
    assert.equal(m.meta().length, 1, "un solo Purchase");
    assert.equal(m.lineas("mails.jsonl").length, 1);
    const est = await (await m.pedir(`/api/app/${ACC_A}`)).json();
    assert.equal(est.estado, "activo");
    assert.equal(est.nombre, "Martín Pérez");
    assert.equal(est.funnel, "peso");
    assert.equal(est.nivel, "t2");
    assert.equal(typeof est.desde, "number");
  });
});

test("api-app: sin acceso en el aviso se reutiliza el último acceso activo del mail o se crea uno nuevo", async () => {
  await conServicio({}, async (m) => {
    await m.pagar(pago({ paramsExtra: { funnel: "peleador" } }));
    await m.pagar(pago({ paramsExtra: { funnel: "peleador", acceso: "no-es-un-uuid" } }));
    await m.pagar(pago({ email: "otro@correo.com", paramsExtra: { funnel: "peso" } }));
    const accesos = m.lineas("compras.jsonl").filter((r) => r.tipo === "pagado").map((r) => r.acceso);
    assert.equal(accesos.length, 3);
    assert.ok(accesos.every((a) => UUID_V4.test(a)), "todos son UUID v4");
    assert.equal(accesos[0], accesos[1], "mismo mail: se reutiliza el acceso");
    assert.notEqual(accesos[0], accesos[2], "otro mail: acceso nuevo");
    assert.equal(m.lineas("compras.jsonl")[0].funnel, "peleador");
  });
});

test("api-app: reembolso y disputa revocan el acceso solo si no queda otro cobro activo; cobro desconocido da 200", async () => {
  await conServicio({}, async (m) => {
    const c1 = pago();
    const c2 = pago();
    await m.pagar(c1);
    await m.pagar(c2);
    const estado = async (a = ACC_A) => (await (await m.pedir(`/api/app/${a}`)).json()).estado;
    assert.equal(await estado(), "activo");
    assert.equal((await m.hp("reembolso", { cobroId: c1.cobroId })).status, 200);
    assert.equal(await estado(), "activo", "queda otro cobro activo");
    assert.equal((await m.hp("reembolso", { cobroId: c1.cobroId })).status, 200, "repetido");
    assert.equal(m.lineas("compras.jsonl").filter((r) => r.tipo === "reembolso").length, 1, "idempotente");
    assert.equal((await m.hp("disputa", { cobroId: c2.cobroId })).status, 200);
    assert.equal(await estado(), "revocado");
    assert.equal((await m.hp("pagado", c1)).status, 200, "el pagado reenviado no reactiva un cobro devuelto");
    assert.equal(await estado(), "revocado");
    assert.equal((await m.hp("reembolso", { cobroId: "cobro-que-no-existe" })).status, 200);
    assert.equal((await m.hp("disputa", { cobroId: "otro-que-no-existe" })).status, 200);
    // un reembolso que llega antes que el pago deja el cobro inactivo y no manda mail ni Purchase
    const c3 = pago({ paramsExtra: { acceso: ACC_B, funnel: "peleador" } });
    assert.equal((await m.hp("reembolso", { cobroId: c3.cobroId })).status, 200);
    const antes = m.llamadas.length;
    await m.pagar(c3);
    assert.equal(await estado(ACC_B), "revocado");
    assert.equal(m.llamadas.length, antes, "sin mail ni Purchase para un cobro ya devuelto");
  });
});

test("api-app: estados pendiente, activo y revocado; formato inválido da 400; no hay datos de otro comprador", async () => {
  await conServicio({}, async (m) => {
    assert.deepEqual(await (await m.pedir(`/api/app/${ACC_A}`)).json(), { estado: "pendiente" });
    for (const malo of ["abc", ACC_A.toUpperCase(), ACC_A.replace("-4", "-1"), `${ACC_A}x`, "..%2f..%2fetc"]) assert.equal((await m.pedir(`/api/app/${malo}`)).status, 400, malo);
    await m.pagar(pago());
    await m.pagar(pago({ email: "ana@correo.com", nombre: "Ana Gómez", paramsExtra: { acceso: ACC_B, funnel: "peleador", nivel: "t4" } }));
    const a = await m.pedir(`/api/app/${ACC_A}`);
    assert.equal(a.headers.get("cache-control"), "no-store");
    assert.equal(a.headers.get("x-content-type-options"), "nosniff");
    const textoA = JSON.stringify(await a.json());
    assert.doesNotMatch(textoA, /Ana|ana@|t4|peleador|correo\.com|beast|cobro-/, "la respuesta de A no trae nada de B ni mails");
    const b = await (await m.pedir(`/api/app/${ACC_B}`)).json();
    assert.equal(b.nombre, "Ana Gómez");
    assert.equal(b.nivel, "t4");
    assert.equal((await m.pedir(`/api/app/${ACC_A}`, { metodo: "POST", cuerpo: {} })).status, 405);
    assert.equal((await m.pedir("/api/otra-cosa")).status, 404);
    assert.equal((await m.pedir("/fuera")).status, 404);
    assert.equal((await m.pedir("/salud")).status, 200);
  });
});

test("api-app: el plan solo se sirve a accesos activos, con caché privado y ETag", async () => {
  await conServicio({}, async (m) => {
    assert.equal((await m.pedir(`/api/app/${ACC_A}/plan`)).status, 403, "pendiente");
    const c = pago();
    await m.pagar(c);
    const r = await m.pedir(`/api/app/${ACC_A}/plan`);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("cache-control"), "private, no-cache");
    assert.match(r.headers.get("content-type") ?? "", /application\/json/);
    assert.equal((await r.json()).funnel, "peso", "el plan es el del funnel del comprador");
    const etag = r.headers.get("etag") ?? "";
    assert.ok(etag);
    assert.equal((await m.pedir(`/api/app/${ACC_A}/plan`, { cab: { "if-none-match": etag } })).status, 304);
    await m.hp("reembolso", { cobroId: c.cobroId });
    assert.equal((await m.pedir(`/api/app/${ACC_A}/plan`)).status, 403, "revocado");
    assert.equal((await m.pedir("/api/app/no-es-uuid/plan")).status, 400);
    assert.equal((await m.pedir(`/api/app/${ACC_A}/plan`, { metodo: "PUT", cuerpo: {} })).status, 405);
  });
  // si el contenido todavía no está (o falla), el plan responde 503 y el resto sigue andando
  await conServicio({ planDe: () => { throw new Error("no hay plan"); } }, async (m) => {
    await m.pagar(pago());
    assert.equal((await m.pedir(`/api/app/${ACC_A}/plan`)).status, 503);
    assert.equal((await m.pedir(`/api/app/${ACC_A}`)).status, 200);
  });
});

test("api-app: progreso se valida, se fusiona entre dispositivos y respeta el tamaño", async () => {
  await conServicio({}, async (m) => {
    const put = (cuerpo: unknown, a = ACC_A) => m.pedir(`/api/app/${a}/progreso`, { metodo: "PUT", cuerpo });
    assert.equal((await put(prog())).status, 403, "sin compra");
    await m.pagar(pago());
    // validación
    const malos: Record<string, unknown> = {
      "versión": prog({ v: 2 }),
      "nivel": prog({ nivel: "t9" }),
      "apodo largo": prog({ apodo: "a".repeat(21) }),
      "apodo con símbolos": prog({ apodo: "<script>" }),
      "clave de más": prog({ extra: 1 }),
      "inicio": prog({ inicio: 5 }),
      "sesión con clave de más": prog({ sesiones: { "a-1": { fin: T0, min: 1, pts: 1, otro: 1 } } }),
      "id de sesión raro": prog({ sesiones: { "../x": { fin: T0, min: 1, pts: 1 } } }),
      "__proto__": JSON.parse(`{"v":1,"nivel":"t2","inicio":${T0},"sesiones":{"__proto__":{"fin":${T0}}},"drills":{},"actualizado":${T0}}`),
      "ajustes": prog({ ajustes: { sonido: "sí" } }),
      "drill": prog({ drills: { d1: { veces: -1, ultimo: T0, pts: 0 } } }),
      "demasiadas sesiones": prog({ sesiones: Object.fromEntries(Array.from({ length: 401 }, (_, i) => [`s-${i}`, { fin: T0, min: 1, pts: 1 }])) }),
      "demasiados drills": prog({ drills: Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`d-${i}`, { veces: 1, ultimo: T0, pts: 1 }])) }),
    };
    for (const [nombre, cuerpo] of Object.entries(malos)) assert.equal((await put(cuerpo)).status, 400, nombre);
    assert.equal((await put("{no json")).status, 400);
    assert.equal((await m.pedir(`/api/app/${ACC_A}/progreso`, { metodo: "PUT", cuerpo: JSON.stringify(prog()), cab: { "content-type": "image/png" } })).status, 415);
    assert.equal((await put(prog({ apodo: "x".repeat(40_000) }))).status, 413, "más de 32 KB");
    assert.equal((await m.pedir(`/api/app/${ACC_A}/progreso`, { metodo: "POST", cuerpo: prog() })).status, 405);
    // dispositivo 1
    assert.equal((await put(prog())).status, 204);
    // dispositivo 2: otra sesión, otro drill y un apodo más nuevo
    const d2 = prog({
      apodo: "Tincho",
      sesiones: { "peso-t1-s1-2": { fin: T0 + 5000, min: 20, pts: 200 }, "peso-t1-s1-1": { fin: T0 + 500, min: 5, pts: 50 } },
      drills: { "drill-jab-60": { veces: 5, ultimo: T0 + 1000, pts: 120 }, "drill-cruzado": { veces: 1, ultimo: T0 + 4000, pts: 30 } },
      actualizado: T0 + 9000,
    });
    assert.equal((await put(d2)).status, 204);
    // un dispositivo viejo que sube tarde no pisa lo nuevo
    assert.equal((await put(prog({ apodo: "Viejo", actualizado: T0 + 100 }))).status, 204);
    const est = await (await m.pedir(`/api/app/${ACC_A}`)).json();
    assert.equal(est.progreso.apodo, "Tincho", "gana el actualizado más nuevo");
    assert.deepEqual(Object.keys(est.progreso.sesiones).sort(), ["peso-t1-s1-1", "peso-t1-s1-2"], "unión de sesiones");
    assert.equal(est.progreso.sesiones["peso-t1-s1-1"].pts, 320, "de una sesión repetida queda la de fin más nuevo");
    assert.deepEqual(est.progreso.drills["drill-jab-60"], { veces: 5, ultimo: T0 + 2000, pts: 120 }, "drills: máximos");
    assert.ok(est.progreso.drills["drill-cruzado"]);
    assert.equal(est.progreso.actualizado, T0 + 9000);
    // archivo atómico: solo <uuid>.json, sin temporales
    assert.deepEqual(readdirSync(`${m.dir}/progreso`), [`${ACC_A}.json`]);
    // revocado: no se guarda más
    await m.hp("reembolso", { cobroId: m.lineas("compras.jsonl")[0].cobroId });
    assert.equal((await put(prog())).status, 403);
    assert.equal(((await (await m.pedir(`/api/app/${ACC_A}`)).json()) as any).progreso, undefined, "revocado: no devuelve el progreso");
  });
});

test("api-app: el progreso de un acceso nunca sale en la respuesta de otro", async () => {
  await conServicio({}, async (m) => {
    await m.pagar(pago());
    await m.pagar(pago({ email: "ana@correo.com", paramsExtra: { acceso: ACC_B, funnel: "peleador" } }));
    await m.pedir(`/api/app/${ACC_A}/progreso`, { metodo: "PUT", cuerpo: prog({ apodo: "SoloA" }) });
    assert.doesNotMatch(JSON.stringify(await (await m.pedir(`/api/app/${ACC_B}`)).json()), /SoloA/);
    assert.deepEqual(readdirSync(`${m.dir}/progreso`), [`${ACC_A}.json`]);
  });
});

test("api-app: progreso, unidades de validación y fusión", () => {
  assert.ok(validarProgreso(prog()));
  assert.equal(validarProgreso(prog({ apodo: "Ñandú_1.-" }))?.apodo, "Ñandú_1.-");
  assert.equal(validarProgreso(null), null);
  assert.equal(validarProgreso([]), null);
  const a = validarProgreso(prog())!;
  assert.deepEqual(fusionarProgreso(null, a), a);
  const b = validarProgreso(prog({ actualizado: T0 + 9000, apodo: "B", nivel: "t3" }))!;
  assert.equal(fusionarProgreso(a, b).nivel, "t3");
  assert.equal(fusionarProgreso(b, a).nivel, "t3", "el orden de llegada no cambia el resultado");
  // Un dispositivo nuevo (o la app instalada en iPhone) arranca con su propio inicio, más nuevo: no reinicia el plan.
  const celuNuevo = validarProgreso(prog({ inicio: T0 + 86_400_000, actualizado: T0 + 99_000 }))!;
  assert.equal(fusionarProgreso(a, celuNuevo).inicio, a.inicio, "gana el inicio más viejo");
  assert.equal(fusionarProgreso(celuNuevo, a).inicio, a.inicio, "en cualquier orden");
  const muchas = validarProgreso(prog({ sesiones: Object.fromEntries(Array.from({ length: 400 }, (_, i) => [`s-${i}`, { fin: T0 + i, min: 1, pts: 1 }])) }))!;
  const otra = validarProgreso(prog({ sesiones: { nueva: { fin: T0 + 10_000, min: 1, pts: 1 } }, actualizado: T0 + 5 }))!;
  const f = fusionarProgreso(muchas, otra);
  assert.equal(Object.keys(f.sesiones).length, 400, "la unión no pasa el tope");
  assert.ok(f.sesiones.nueva, "se queda con las más recientes");
});

test("api-app: recuperar responde siempre 204, manda mail solo si el comprador existe y tiene límites", async () => {
  await conServicio({}, async (m) => {
    await m.pagar(pago());
    assert.equal(m.resend().length, 1);
    const rec = (mail: unknown, ip = "198.51.100.1") => m.pedir("/api/app/recuperar", { metodo: "POST", cuerpo: { mail }, ip });
    for (const mail of ["nadie@correo.com", "no-es-mail", "", "a".repeat(300) + "@x.co"]) {
      const r = await rec(mail);
      assert.equal(r.status, 204, `mail inexistente o inválido: ${mail.slice(0, 20)}`);
      assert.equal(await r.text(), "");
    }
    await m.servicio.esperar();
    assert.equal(m.resend().length, 1, "no existe: no sale ningún mail");
    assert.equal((await m.pedir("/api/app/recuperar", { metodo: "POST", cuerpo: { otro: 1 } })).status, 400, "cuerpo mal armado");
    assert.equal((await m.pedir("/api/app/recuperar", { metodo: "GET" })).status, 405);
    // existe (aunque venga con mayúsculas y espacios): sale el mail de recuperar con el link del acceso
    assert.equal((await rec("  MARTIN@correo.com ", "198.51.100.2")).status, 204);
    await m.servicio.esperar();
    const envios = m.resend();
    assert.equal(envios.length, 2);
    const mail = envios[1].json;
    assert.equal(mail.subject, "Tu link de BeastCamp");
    assert.deepEqual(mail.to, ["martin@correo.com"]);
    assert.ok(mail.text.includes(`${BASE}/app/${ACC_A}/`));
    assert.ok(mail.html.includes(`${BASE}/app/${ACC_A}/`));
    // 3 por hora por mail: el cuarto pedido responde 204 igual pero no manda nada
    for (const ip of ["198.51.100.3", "198.51.100.4", "198.51.100.5"]) assert.equal((await rec("martin@correo.com", ip)).status, 204);
    await m.servicio.esperar();
    assert.equal(m.resend().length, 4, "1 de acceso + 3 de recuperar");
  });
  // 5 por minuto por IP
  await conServicio({}, async (m) => {
    await m.pagar(pago());
    await m.pagar(pago({ email: "ana@correo.com", paramsExtra: { acceso: ACC_B, funnel: "peleador" } }));
    const antes = m.resend().length;
    const rec = (mail: string) => m.pedir("/api/app/recuperar", { metodo: "POST", cuerpo: { mail }, ip: "198.51.100.9" });
    for (const mail of ["martin@correo.com", "martin@correo.com", "ana@correo.com", "ana@correo.com", "martin@correo.com"]) assert.equal((await rec(mail)).status, 204);
    assert.equal((await rec("ana@correo.com")).status, 204, "pasado el límite sigue siendo 204");
    await m.servicio.esperar();
    assert.equal(m.resend().length - antes, 5, "el sexto pedido de la IP no manda nada");
  });
});

test("api-app: la IP sale de cf-connecting-ip, de x-real-ip (solo desde el propio equipo) o del socket", async () => {
  const falso = (socket: string, cab: Record<string, string>) => ({ headers: cab, socket: { remoteAddress: socket } });
  assert.equal(ipDe(falso("10.0.0.5", { "x-real-ip": "1.2.3.4" })), "10.0.0.5", "x-real-ip de un cliente directo no vale");
  assert.equal(ipDe(falso("127.0.0.1", { "x-real-ip": "1.2.3.4" })), "1.2.3.4");
  assert.equal(ipDe(falso("::ffff:127.0.0.1", { "x-real-ip": "2001:db8::1" })), "2001:db8::1");
  assert.equal(ipDe(falso("::1", { "x-real-ip": "no-es-ip" })), "::1", "valor que no es una IP: se ignora");
  assert.equal(ipDe(falso("127.0.0.1", { "cf-connecting-ip": "5.6.7.8", "x-real-ip": "1.2.3.4" })), "5.6.7.8", "cf-connecting-ip primero");
  assert.equal(ipDe(falso("10.0.0.5", {})), "10.0.0.5");
  await conServicio({}, async (m) => {
    const lead = (ip: string, cab: Record<string, string> = {}) => m.pedir("/api/lead", { metodo: "POST", cuerpo: { nombre: "Ana", mail: "ana@correo.com", nivel: "" }, ip, cab });
    for (let i = 0; i < 5; i++) assert.equal((await lead("203.0.113.10")).status, 204);
    assert.equal((await lead("203.0.113.10")).status, 429, "la IP de x-real-ip agotó su límite");
    assert.equal((await lead("203.0.113.11")).status, 204, "otra IP real no se ve afectada");
    assert.equal((await lead("203.0.113.10", { "cf-connecting-ip": "203.0.113.12" })).status, 204, "cf-connecting-ip manda sobre x-real-ip");
  });
});

test("api-app: el mail de acceso va a Resend con el formato exacto", async () => {
  await conServicio({}, async (m) => {
    const c = pago();
    await m.pagar(c);
    assert.equal(m.resend().length, 1);
    const l = m.resend()[0];
    assert.equal(l.url, "https://api.resend.com/emails");
    assert.equal(l.init.method, "POST");
    assert.equal(l.init.headers.authorization, `Bearer ${RESEND}`);
    assert.equal(l.init.headers["content-type"], "application/json");
    assert.equal(l.init.headers["idempotency-key"], `bc-acceso-${c.cobroId}`);
    assert.deepEqual(Object.keys(l.json).sort(), ["from", "html", "subject", "text", "to"]);
    assert.equal(l.json.from, "BeastCamp <acceso@beast.example>");
    assert.deepEqual(l.json.to, ["martin@correo.com"]);
    assert.equal(l.json.subject, "Tu plan BeastCamp está listo");
    const link = `${BASE}/app/${ACC_A}/`;
    for (const cuerpo of [l.json.html, l.json.text]) {
      assert.ok(cuerpo.includes(link), "el link va en el cuerpo");
      assert.match(cuerpo, /Guardá este mail: este link es tu acceso\. No lo compartas\./);
      assert.match(cuerpo, /garantía de 30 días/);
      assert.match(cuerpo, /Martín Pérez/);
    }
    assert.match(l.json.html, /Entrar a mi plan/);
    assert.match(l.json.html, /#16A34A/i, "botón verde");
    assert.doesNotMatch(l.json.html + l.json.text, /\p{Extended_Pictographic}/u, "sin emojis");
    assert.deepEqual(m.lineas("mails.jsonl").map((r) => [r.tipo, r.cobroId]), [["acceso", c.cobroId]]);
    assert.doesNotMatch(readFileSync(`${m.dir}/mails.jsonl`, "utf8"), /correo\.com|Martín|html/, "mails.jsonl sin direcciones ni contenido");
  });
  // el nombre se escapa
  await conServicio({}, async (m) => {
    await m.pagar(pago({ nombre: `<img src=x onerror=alert(1)> "Ana"` }));
    assert.ok(!m.resend()[0].json.html.includes("<img"), "HTML escapado");
  });
});

test("api-app: Purchase a Meta con el payload exacto (mail y nombre en SHA-256)", async () => {
  await conServicio({ env: { META_TEST_EVENT_CODE: "TEST12345" } }, async (m) => {
    const c = pago();
    await m.pagar(c);
    assert.equal(m.meta().length, 1);
    const l = m.meta()[0];
    assert.equal(l.url, `https://graph.facebook.com/v21.0/${PIXEL}/events?access_token=${META_TOKEN}`);
    assert.equal(l.init.method, "POST");
    assert.deepEqual(l.json, {
      data: [
        {
          event_name: "Purchase",
          event_time: Math.floor(Date.parse(c.purchasedAt) / 1000),
          event_id: `hp_${c.cobroId}`,
          action_source: "website",
          event_source_url: `${BASE}/gracias/`,
          user_data: {
            em: [sha("martin@correo.com")],
            fn: [sha("martín")],
            external_id: [sha(ACC_A)],
            client_ip_address: "203.0.113.25",
            client_user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)",
            fbc: "fb.1.1760360000000.IwAR0abc",
            fbp: "fb.1.1760360000000.1234567890",
          },
          custom_data: { value: 9990, currency: "ARS", content_name: "BeastCamp Sombra", content_category: "peso" },
        },
      ],
      test_event_code: "TEST12345",
    });
    assert.doesNotMatch(JSON.stringify(l.json), /martin@correo|Martín|Pérez/i, "nada de mail ni nombre en claro");
  });
  await conServicio({ env: { META_API_VERSION: "v22.0" } }, async (m) => {
    await m.pagar(pago({ email: null, nombre: undefined, ip: undefined, userAgent: undefined, fbc: undefined, fbp: undefined, paramsExtra: { acceso: ACC_A } }));
    assert.match(m.meta()[0].url, /\/v22\.0\//);
    assert.deepEqual(m.meta()[0].json.data[0].user_data, { external_id: [sha(ACC_A)] }, "solo lo que hay");
    assert.equal(m.meta()[0].json.data[0].custom_data.content_category, "peleador", "sin funnel en el aviso: peleador");
    assert.equal(m.meta()[0].json.test_event_code, undefined);
    assert.equal(m.resend().length, 0, "sin mail no hay a quién escribir");
  });
});

test("api-app: sin claves de Resend o de Meta no se manda nada; en desarrollo el link va a la consola", async () => {
  await conServicio({ env: { RESEND_API_KEY: undefined, META_CAPI_TOKEN: undefined } }, async (m) => {
    assert.equal((await m.pagar(pago())).status, 200);
    assert.equal(m.llamadas.length, 0);
    assert.equal((await (await m.pedir(`/api/app/${ACC_A}`)).json()).estado, "activo");
  });
  await conServicio({ env: { RESEND_API_KEY: undefined, MAIL_A_CONSOLA: "1", META_PIXEL_ID: undefined } }, async (m) => {
    await m.pagar(pago());
    assert.equal(m.llamadas.length, 0);
    assert.ok(m.logs.some((l) => l.includes(`/app/${ACC_A}/`)), "el link sale por consola solo con MAIL_A_CONSOLA=1");
    assert.equal(m.lineas("mails.jsonl").length, 1);
  });
});

test("api-app: si Resend o Meta fallan se reintenta una vez y después el barrido lo completa", async () => {
  // un 500 y después 200: el reintento inmediato lo resuelve
  await conServicio({ estado: (_url, intento) => (intento === 1 ? 500 : 200) }, async (m) => {
    await m.pagar(pago());
    assert.equal(m.resend().length, 2);
    assert.equal(m.meta().length, 2);
    assert.equal(m.lineas("mails.jsonl").length, 1);
    assert.equal(m.lineas("compras.jsonl").filter((r) => r.tipo === "meta").length, 1);
  });
  // un 4xx no se reintenta
  await conServicio({ estado: () => 422 }, async (m) => {
    assert.equal((await m.pagar(pago())).status, 200, "Hilvapay recibe 200 aunque el mail falle");
    assert.equal(m.resend().length, 1);
    assert.equal(m.meta().length, 1);
    assert.equal(m.lineas("mails.jsonl").length, 0);
  });
  // caída larga: no se marca nada; cuando vuelve, barrer() manda lo pendiente una sola vez
  let caido = true;
  await conServicio({ estado: () => (caido ? 503 : 200) }, async (m) => {
    await m.pagar(pago());
    assert.equal(m.lineas("mails.jsonl").length, 0);
    assert.equal(m.lineas("compras.jsonl").filter((r) => r.tipo === "meta").length, 0);
    caido = false;
    await m.servicio.barrer();
    await m.servicio.barrer();
    assert.equal(m.lineas("mails.jsonl").length, 1);
    assert.equal(m.lineas("compras.jsonl").filter((r) => r.tipo === "meta").length, 1);
    assert.equal(m.resend().length, 3, "2 intentos caídos + 1 bueno; el segundo barrido no repite");
  });
});

test("api-app: al reiniciar se recupera lo guardado y no se repite ningún mail ni Purchase", async () => {
  const dir = mkdtempSync(`${tmpdir()}/bcapp-reinicio-`);
  const c = pago();
  const uno = await montar({ dir });
  await uno.pagar(c);
  await uno.hp("pagado", pago({ email: "ana@correo.com", paramsExtra: { acceso: ACC_B, funnel: "peleador" } }));
  await uno.cerrar();
  const dos = await montar({ dir });
  try {
    assert.equal((await (await dos.pedir(`/api/app/${ACC_A}`)).json()).estado, "activo");
    await dos.servicio.barrer();
    await dos.servicio.esperar();
    assert.equal(dos.llamadas.length, 0, "lo que ya salió no se repite");
    assert.equal((await dos.hp("pagado", c)).status, 200);
    assert.equal(dos.lineas("compras.jsonl").filter((r) => r.tipo === "pagado" && r.cobroId === c.cobroId).length, 1, "idempotente también después de reiniciar");
  } finally {
    await dos.cerrar();
  }
  // sin Resend ni Meta configurados al principio y configurados después: el barrido manda lo pendiente de las últimas 24 h
  const dir2 = mkdtempSync(`${tmpdir()}/bcapp-reinicio-`);
  const sin = await montar({ dir: dir2, env: { RESEND_API_KEY: undefined, META_CAPI_TOKEN: undefined } });
  await sin.pagar(pago());
  await sin.cerrar();
  const con = await montar({ dir: dir2 });
  try {
    await con.servicio.barrer();
    assert.equal(con.resend().length, 1);
    assert.equal(con.meta().length, 1);
  } finally {
    await con.cerrar();
  }
  // una línea cortada a mitad de escritura no impide arrancar
  const { appendFileSync } = await import("node:fs");
  appendFileSync(`${dir2}/compras.jsonl`, '{"tipo":"pagado","cobroId":"cortado');
  const tras = await montar({ dir: dir2 });
  try {
    assert.equal((await (await tras.pedir(`/api/app/${ACC_A}`)).json()).estado, "activo");
  } finally {
    await tras.cerrar();
  }
});

test("api-app: /api/click guarda los campos nuevos (sin fbc) y manda InitiateCheckout a Meta", async () => {
  await conServicio({}, async (m) => {
    const click = {
      precio: "$7.990",
      funnel: "peso",
      pagina: "back1",
      utm_source: "facebook",
      utm_medium: "paid",
      utm_campaign: "Camp Uno",
      utm_content: "Anuncio 3",
      utm_term: "Conjunto A",
      fbc: "fb.1.1760360000000.IwAR0xyz",
      t: Date.now(),
    };
    const r = await m.pedir("/api/click", { metodo: "POST", cuerpo: click, ip: "198.51.100.7", cab: { "user-agent": "Mozilla/5.0 (Android)" } });
    assert.equal(r.status, 204);
    await m.servicio.esperar();
    const guardado = m.lineas("clicks.jsonl")[0];
    assert.deepEqual(
      { ...guardado, ts: undefined },
      { precio: "$7.990", funnel: "peso", pagina: "back1", utm_source: "facebook", utm_medium: "paid", utm_campaign: "Camp Uno", utm_content: "Anuncio 3", utm_term: "Conjunto A", ts: undefined },
    );
    assert.ok(!readFileSync(`${m.dir}/clicks.jsonl`, "utf8").includes("fb.1."), "el fbc no se guarda");
    assert.equal(m.meta().length, 1);
    const ev = m.meta()[0].json.data[0];
    assert.match(ev.event_id, /^ic_[0-9a-f-]{36}$/);
    assert.equal(typeof ev.event_time, "number");
    assert.deepEqual(
      { ...ev, event_id: undefined, event_time: undefined },
      {
        event_name: "InitiateCheckout",
        action_source: "website",
        event_source_url: `${BASE}/back1-peso/`,
        user_data: { client_ip_address: "198.51.100.7", client_user_agent: "Mozilla/5.0 (Android)", fbc: "fb.1.1760360000000.IwAR0xyz" },
        custom_data: { value: 7990, currency: "ARS", content_name: "BeastCamp Sombra", content_category: "peso" },
        event_id: undefined,
        event_time: undefined,
      },
    );
    // el comportamiento de siempre: solo el precio
    assert.equal((await m.pedir("/api/click", { metodo: "POST", cuerpo: { precio: "$9.990", t: Date.now() } })).status, 204);
    // listas cerradas
    for (const malo of [
      { precio: "$9.990", funnel: "otro" },
      { precio: "$9.990", pagina: "upsell" },
      { precio: "$9.990", utm_source: 5 },
      { precio: "$9.990", gclid: "x" },
      { precio: "$1" },
      { funnel: "peso" },
    ])
      assert.equal((await m.pedir("/api/click", { metodo: "POST", cuerpo: malo })).status, 400, JSON.stringify(malo));
    assert.equal((await m.pedir("/api/click", { metodo: "POST", cuerpo: "x".repeat(5000) })).status, 413);
  });
  assert.deepEqual(validar("click", { precio: "$4.990", utm_campaign: "a\nb" }), { precio: "$4.990", utm_campaign: "a b" }, "caracteres de control fuera");
  assert.equal((validar("click", { precio: "$4.990", utm_campaign: "x".repeat(500) }) as any).utm_campaign.length, 200);
});

test("api-app: límites de tamaño por ruta", async () => {
  await conServicio({}, async (m) => {
    const grande = JSON.stringify({ ...pago(), relleno: "x".repeat(70_000) });
    assert.equal((await m.hp("pagado", grande)).status, 413, "webhook: máximo 64 KB");
    assert.equal(m.lineas("compras.jsonl").length, 0);
    assert.equal((await m.pedir("/api/app/recuperar", { metodo: "POST", cuerpo: JSON.stringify({ mail: "a".repeat(2000) }) })).status, 413);
    assert.equal((await m.pedir("/api/lead", { metodo: "POST", cuerpo: "x".repeat(5000) })).status, 413);
    assert.equal((await m.hp("pagado", pago())).status, 200, "el servicio sigue andando");
  });
});

test("api-app: ningún log contiene mails, nombres, IPs, accesos ni tokens", async () => {
  await conServicio({ env: { META_TEST_EVENT_CODE: "TEST12345" } }, async (m) => {
    const c = pago();
    await m.pagar(c);
    await m.pagar(pago({ email: "ana@correo.com", nombre: "Ana Gómez", ip: "203.0.113.99", paramsExtra: { funnel: "peleador" } }));
    await m.hp("pagado", c, "token-malo");
    await m.hp("reembolso", { cobroId: c.cobroId });
    await m.pedir(`/api/app/${ACC_A}/progreso`, { metodo: "PUT", cuerpo: prog({ apodo: "ApodoSecreto" }), ip: "198.51.100.77" });
    await m.pedir("/api/app/recuperar", { metodo: "POST", cuerpo: { mail: "martin@correo.com" }, ip: "198.51.100.78" });
    await m.pedir("/api/lead", { metodo: "POST", cuerpo: { nombre: "Luz", mail: "luz@correo.com", nivel: "" }, ip: "198.51.100.79" });
    await m.pedir("/api/click", { metodo: "POST", cuerpo: { precio: "$9.990", utm_campaign: "campania-secreta", fbc: "fb.1.1760360000000.IwAR0xyz" }, ip: "198.51.100.80" });
    await m.servicio.esperar();
    const todo = m.logs.join("\n");
    assert.ok(todo.length > 0, "sí hay logs");
    for (const secreto of [
      "martin@correo.com", "Martin@Correo.com", "ana@correo.com", "luz@correo.com", "correo.com", "Martín", "Pérez", "Ana Gómez", "Luz", "ApodoSecreto",
      "203.0.113.25", "203.0.113.99", "198.51.100.77", "198.51.100.78", "198.51.100.79", "198.51.100.80", "127.0.0.1",
      ACC_A, TOKEN, "token-malo", RESEND, META_TOKEN, "IwAR0", "campania-secreta", "Mozilla",
    ])
      assert.ok(!todo.includes(secreto), `el log no debe contener «${secreto}»`);
  });
});

test("api-app: permisos de archivos 0600 y carpetas 0700", async (t) => {
  if (process.platform === "win32") return t.skip("permisos POSIX");
  const dir = `${mkdtempSync(`${tmpdir()}/bcapp-perm-`)}/datos/anidada`;
  await conServicio({ dir }, async (m) => {
    await m.pagar(pago());
    await m.pedir("/api/lead", { metodo: "POST", cuerpo: { nombre: "Ana", mail: "ana@correo.com", nivel: "" } });
    await m.pedir("/api/click", { metodo: "POST", cuerpo: { precio: "$9.990" } });
    await m.pedir(`/api/app/${ACC_A}/progreso`, { metodo: "PUT", cuerpo: prog() });
    const modo = (r: string) => (statSync(r).mode & 0o777).toString(8);
    assert.equal(modo(dir), "700");
    assert.equal(modo(`${dir}/progreso`), "700");
    for (const f of ["compras.jsonl", "mails.jsonl", "leads.jsonl", "clicks.jsonl", `progreso/${ACC_A}.json`]) assert.equal(modo(`${dir}/${f}`), "600", f);
  });
});

test("api-app: el nombre del archivo de progreso sale solo de un UUID validado", async () => {
  await conServicio({}, async (m) => {
    await m.pagar(pago());
    for (const malo of ["../compras", "..%2fcompras", "%2e%2e/%2e%2e/x", "a/b", ACC_A + "/../x"]) {
      const r = await m.pedir(`/api/app/${malo}/progreso`, { metodo: "PUT", cuerpo: prog() });
      assert.ok([400, 404].includes(r.status), `${malo} → ${r.status}`);
    }
    assert.deepEqual(readdirSync(`${m.dir}/progreso`), []);
    assert.equal((await m.pedir(`/api/app/${ACC_A}/progreso`, { metodo: "PUT", cuerpo: prog() })).status, 204);
    assert.deepEqual(readdirSync(`${m.dir}/progreso`), [`${ACC_A}.json`]);
  });
});

test("api-app: comparación de tokens en tiempo constante (sin excepciones por largo distinto)", () => {
  assert.equal(igualesSeguro("abc", "abc"), true);
  assert.equal(igualesSeguro("abc", "abcd"), false);
  assert.equal(igualesSeguro("", "abc"), false);
  assert.equal(igualesSeguro("é".repeat(100), "e".repeat(100)), false);
});

test("api-app: el código del servicio no loguea datos personales ni usa dependencias", () => {
  for (const f of ["server", "almacen", "correo", "meta", "progreso", "util"]) {
    const src = readFileSync(`prueba-quiz/api/${f}.mjs`, "utf8");
    for (const l of src.split("\n")) {
      if (!/registrar\(|console\.(log|error|warn)\(/.test(l) || l.includes("[desarrollo]")) continue;
      assert.doesNotMatch(l, /\$\{[^}]*(mail|email|nombre|\bip\b|token|acceso|link|para\b)/i, `${f}: el log interpola un dato personal → ${l.trim()}`);
    }
    for (const imp of src.matchAll(/from "([^"]+)"/g)) assert.match(imp[1], /^(node:|\.\/)/, `${f}: solo node:* y módulos propios`);
  }
});
