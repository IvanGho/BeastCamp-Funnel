// Conversions API de Meta, solo desde el servidor (nada de Meta en las páginas). Mismo criterio que hilvalma:
// POST a graph.facebook.com/<versión>/<pixel>/events con el token en la URL, em hasheado en SHA-256, event_id para deduplicar.
import { isIP } from "node:net";
import { randomUUID } from "node:crypto";
import { sha256 } from "./util.mjs";
import { reintentable } from "./correo.mjs";

export const NOMBRE_PRODUCTO = "BeastCamp Sombra";
const FBC = /^fb\.\d\.\d{10,14}\.[\w-]{1,300}$/;
const FBP = /^fb\.\d\.\d{10,14}\.\d{1,20}$/;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Configuración desde las variables. Activo solo con el píxel y el token. */
export function configMeta(e) {
  const pixel = e("META_PIXEL_ID");
  const token = e("META_CAPI_TOKEN");
  const version = /^v\d{1,2}\.\d$/.test(e("META_API_VERSION")) ? e("META_API_VERSION") : "v21.0";
  const prueba = /^[\w-]{1,40}$/.test(e("META_TEST_EVENT_CODE")) ? e("META_TEST_EVENT_CODE") : "";
  return { activo: /^\d{8,20}$/.test(pixel) && Boolean(token), pixel, token, version, prueba };
}

const normalizar = (s) => String(s).trim().toLowerCase();

/** Datos del comprador para Meta: mail y primer nombre en SHA-256, el acceso como external_id, IP, navegador, fbc y fbp. */
export function datosUsuario({ email, nombre, acceso, ip, ua, fbc, fbp }) {
  const u = {};
  if (email) u.em = [sha256(normalizar(email))];
  const primero = normalizar(nombre ?? "").split(/\s+/)[0];
  if (primero) u.fn = [sha256(primero)];
  if (acceso) u.external_id = [sha256(acceso)];
  if (ip && isIP(ip)) u.client_ip_address = ip;
  if (ua) u.client_user_agent = String(ua).slice(0, 500);
  if (fbc && FBC.test(fbc)) u.fbc = fbc;
  if (fbp && FBP.test(fbp)) u.fbp = fbp;
  return u;
}

/** Hora del evento en segundos: la del pago si es razonable (hasta 7 días atrás), si no ahora. */
function horaEvento(iso, ahoraMs) {
  const t = Date.parse(iso ?? "");
  return Math.floor((Number.isFinite(t) && t <= ahoraMs + 60_000 && t >= ahoraMs - 6.5 * 86_400_000 ? t : ahoraMs) / 1000);
}

export function eventoPurchase({ cobro, baseUrl, ahoraMs = Date.now() }) {
  const value = Number(cobro.monto);
  if (!Number.isFinite(value) || value < 0 || !/^[A-Z]{3}$/.test(cobro.moneda ?? "")) return null;
  return {
    event_name: "Purchase",
    event_time: horaEvento(cobro.purchasedAt, ahoraMs),
    event_id: `hp_${cobro.cobroId}`,
    action_source: "website",
    ...(baseUrl ? { event_source_url: `${baseUrl}/gracias/` } : {}),
    user_data: datosUsuario({ email: cobro.email, nombre: cobro.nombre, acceso: cobro.acceso, ip: cobro.ip, ua: cobro.ua, fbc: cobro.fbc, fbp: cobro.fbp }),
    custom_data: { value, currency: cobro.moneda, content_name: NOMBRE_PRODUCTO, content_category: cobro.funnel },
  };
}

/** Ruta de cada página de venta, para event_source_url. */
export function rutaPagina(funnel, pagina) {
  const sufijo = funnel === "peso" ? "-peso" : "";
  return `/${["oferta", "back1", "back2"].includes(pagina) ? pagina : "oferta"}${sufijo}/`;
}

export function eventoCheckout({ precio, funnel, pagina, fbc, ip, ua, baseUrl, ahoraMs = Date.now() }) {
  const value = Number(String(precio).replace(/\D/g, ""));
  return {
    event_name: "InitiateCheckout",
    event_time: Math.floor(ahoraMs / 1000),
    event_id: `ic_${randomUUID()}`,
    action_source: "website",
    ...(baseUrl ? { event_source_url: `${baseUrl}${rutaPagina(funnel, pagina)}` } : {}),
    user_data: datosUsuario({ ip, ua, fbc }),
    custom_data: { value, currency: "ARS", content_name: NOMBRE_PRODUCTO, ...(funnel ? { content_category: funnel } : {}) },
  };
}

/** Manda un evento. Timeout de 5 s y un reintento (red, timeout, 429, 5xx). Nunca lanza ni muestra datos. */
export async function enviarMeta({ fetch, config, evento, esperaMs = 1000 }) {
  const url = `https://graph.facebook.com/${config.version}/${config.pixel}/events?access_token=${encodeURIComponent(config.token)}`;
  const cuerpo = JSON.stringify({ data: [evento], ...(config.prueba ? { test_event_code: config.prueba } : {}) });
  for (let intento = 0; intento < 2; intento++) {
    let estado = 0;
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: cuerpo, signal: AbortSignal.timeout(5000) });
      estado = res.status;
      await res.text?.().catch?.(() => {});
      if (res.ok) return { ok: true, estado };
    } catch {
      estado = 0;
    }
    if (intento === 0 && reintentable(estado)) await dormir(esperaMs);
    else return { ok: false, estado };
  }
  return { ok: false, estado: 0 };
}
