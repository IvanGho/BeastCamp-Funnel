// Mails de acceso por Resend (HTTP directo, sin SDK, como hilvalma). Dos textos: «Tu plan BeastCamp está listo» y «Tu link de BeastCamp».
// Nunca se loguea la dirección, el nombre ni el link.

const VERDE = "#16A34A";

const escapar = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const TEXTOS = {
  acceso: {
    asunto: "Tu plan BeastCamp está listo",
    titulo: "Tu plan está listo",
    cuerpo: "Recibimos tu pago. Tu plan de shadowboxing ya está armado y te espera en tu app. Entrá con tu link personal.",
  },
  recuperar: {
    asunto: "Tu link de BeastCamp",
    titulo: "Tu link de acceso",
    cuerpo: "Pediste volver a entrar a tu plan. Este es tu link personal.",
  },
};

/** Arma asunto, HTML y texto plano. `link` ya viene completo; `nombre` puede venir vacío. */
export function armarCorreo({ tipo, nombre = "", link, garantiaDias = 30 }) {
  const t = TEXTOS[tipo];
  if (!t) throw new Error("tipo de mail desconocido");
  const saludoTxt = nombre ? `Hola, ${nombre}.` : "Hola.";
  const aviso = "Guardá este mail: este link es tu acceso. No lo compartas.";
  const garantia = `Tu compra tiene garantía de ${garantiaDias} días.`;
  const texto = [saludoTxt, "", t.cuerpo, "", `Entrar a mi plan: ${link}`, "", aviso, garantia, "", "BeastCamp"].join("\n");
  const L = escapar(link);
  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapar(t.asunto)}</title></head>
<body style="margin:0;padding:0;background:#0B0F0C;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0B0F0C;"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:#FFFFFF;border-radius:10px;">
<tr><td style="padding:30px 30px 6px 30px;font-family:Arial,Helvetica,sans-serif;">
<p style="margin:0 0 8px 0;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:${VERDE};font-weight:bold;">BeastCamp</p>
<h1 style="margin:0;font-size:26px;line-height:1.25;color:#111827;">${escapar(t.titulo)}</h1>
</td></tr>
<tr><td style="padding:16px 30px 6px 30px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#374151;">
<p style="margin:0 0 12px 0;">${escapar(saludoTxt)}</p><p style="margin:0 0 22px 0;">${escapar(t.cuerpo)}</p>
</td></tr>
<tr><td align="center" style="padding:4px 30px 26px 30px;">
<a href="${L}" style="display:inline-block;background:${VERDE};color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:bold;text-decoration:none;padding:16px 34px;border-radius:999px;">Entrar a mi plan</a>
</td></tr>
<tr><td style="padding:0 30px 30px 30px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#6B7280;">
<p style="margin:0 0 6px 0;">Si el botón no anda, copiá este link en tu navegador:</p>
<p style="margin:0;word-break:break-all;"><a href="${L}" style="color:${VERDE};">${L}</a></p>
<p style="margin:14px 0 0 0;"><strong>${escapar(aviso)}</strong></p>
<p style="margin:8px 0 0 0;">${escapar(garantia)}</p>
</td></tr>
</table></td></tr></table></body></html>`;
  return { asunto: t.asunto, html, texto };
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** ¿Vale la pena reintentar? Errores de red, timeouts, 429 y 5xx. */
export const reintentable = (estado) => estado === 0 || estado === 429 || estado >= 500;

/**
 * POST a Resend. Un reintento si falla por red, timeout, 429 o 5xx (`Idempotency-Key` evita el doble envío).
 * Nunca lanza: devuelve { ok, estado }.
 */
export async function enviarResend({ fetch, apiKey, desde, para, asunto, html, texto, claveIdem, esperaMs = 1000 }) {
  const cuerpo = JSON.stringify({ from: desde, to: [para], subject: asunto, html, text: texto });
  for (let intento = 0; intento < 2; intento++) {
    let estado = 0;
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", ...(claveIdem ? { "idempotency-key": claveIdem } : {}) },
        body: cuerpo,
        signal: AbortSignal.timeout(8000),
      });
      estado = res.status;
      await res.text?.().catch?.(() => {}); // se consume el cuerpo sin guardarlo ni mostrarlo
      if (res.ok) return { ok: true, estado };
    } catch {
      estado = 0;
    }
    if (intento === 0 && reintentable(estado)) await dormir(esperaMs);
    else return { ok: false, estado };
  }
  return { ok: false, estado: 0 };
}
