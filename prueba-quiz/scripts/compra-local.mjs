#!/usr/bin/env node
// Simula el aviso «pagado» de Hilvapay contra la vista previa local (token «local») y muestra el link de la app.
// Uso: node prueba-quiz/scripts/compra-local.mjs --funnel peso --nivel t2 --nombre Martín [--puerto 4173]
//      Opcionales: --mail <mail> · --acceso <uuid> (usa ese acceso) · --token <token> · --evento reembolso|disputa --cobro <id>
// Solo habla con 127.0.0.1. El link se imprime en consola; no se guarda en ningún archivo.
import { randomUUID } from "node:crypto";

const args = process.argv.slice(2);
const valor = (n, porDefecto) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : porDefecto;
};
if (args.includes("--ayuda") || args.includes("-h")) {
  console.log("Uso: node prueba-quiz/scripts/compra-local.mjs --funnel peleador|peso --nivel t1|t2|t3|t4 --nombre <nombre> [--puerto 4173] [--mail <mail>] [--acceso <uuid>]\n     Reembolso o disputa de una compra anterior: --evento reembolso|disputa --cobro <id>");
  process.exit(0);
}

const funnel = valor("--funnel", "peleador");
const nivel = valor("--nivel", "t2");
const nombre = valor("--nombre", "Martín");
const puerto = Number(valor("--puerto", process.env.PORT || 4173));
const token = valor("--token", "local");
const evento = valor("--evento", "pagado");
const mail = valor("--mail", "comprador@local.test");
const acceso = valor("--acceso", randomUUID());
const cobroId = valor("--cobro", `local-${randomUUID().slice(0, 8)}`);

const salir = (m) => {
  console.error(m);
  process.exit(1);
};
if (!["peleador", "peso"].includes(funnel)) salir("--funnel tiene que ser peleador o peso.");
if (!["t1", "t2", "t3", "t4"].includes(nivel)) salir("--nivel tiene que ser t1, t2, t3 o t4.");
if (!["pagado", "reembolso", "disputa"].includes(evento)) salir("--evento tiene que ser pagado, reembolso o disputa.");
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(acceso)) salir("--acceso tiene que ser un UUID v4 en minúsculas.");
if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) salir("--puerto no es válido.");
if (evento !== "pagado" && !args.includes("--cobro")) salir("Para un reembolso o una disputa hace falta --cobro <id> (el que imprimió la compra).");

// Mismo cuerpo que manda Hilvapay (webhooks-salientes.md): sin campo «evento»; el evento viaja en la query.
const cuerpo = {
  cobroId,
  whopPlanId: "beastcamp-local",
  email: mail,
  monto: "9990.00",
  moneda: "ARS",
  purchasedAt: new Date().toISOString(),
  utms: { utm_source: "local", utm_medium: "local", utm_campaign: "(directo)", utm_content: "(directo)", utm_term: "(directo)" },
  nombre,
  paramsExtra: { acceso, funnel, nivel, pagina: "oferta" },
  pasoFunnel: null,
};

let res;
try {
  res = await fetch(`http://127.0.0.1:${puerto}/api/hilvapay?evento=${evento}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(8000),
  });
} catch {
  salir(`No pude conectar con 127.0.0.1:${puerto}. ¿Está corriendo la vista previa (npm run vista-previa)?`);
}
if (!res.ok) salir(`El servicio respondió ${res.status}${res.status === 401 ? " (token incorrecto)" : res.status === 503 ? " (falta HILVAPAY_WEBHOOK_TOKEN o no se pudo guardar)" : ""}.`);

if (evento === "pagado") {
  console.log(`Compra simulada (funnel ${funnel}, nivel ${nivel}).`);
  console.log(`Link de la app: http://localhost:${puerto}/app/${acceso}/`);
  console.log(`Cobro: ${cobroId}   (para probar un reembolso: --evento reembolso --cobro ${cobroId} --acceso ${acceso})`);
} else {
  console.log(`Aviso de ${evento} enviado para el cobro ${cobroId}. El acceso queda revocado si no tiene otro cobro activo.`);
}
