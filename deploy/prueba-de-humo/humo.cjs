/* Prueba de humo tipo producción: el nginx real (prueba-quiz/nginx.conf, con HTTPS y un certificado de prueba) y el
   servicio Node, en Docker, recorridos con Chrome como lo haría un comprador. Ver README.md de esta carpeta.
   Antes: sh deploy/prueba-de-humo/levantar.sh. Uso: node deploy/prueba-de-humo/humo.cjs [carpeta para capturas]
   Necesita `npm install` hecho (usa playwright-core del repo) y Chrome o Edge (CHROME_PATH para otra ruta).
   Sale con código 0 si todo dio bien y 1 si algo falló. */
const { chromium } = require('playwright-core');
const { execSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { existsSync, mkdirSync, mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const http = require('node:http');
const https = require('node:https');
const zlib = require('node:zlib');

const BASE = 'https://localhost:8443';
const TOKEN = 'token-de-humo'; // el mismo que pone levantar.sh; no es una clave real
const CAPTURAS = process.argv[2] || '';
const CHROMES = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const CHROME = CHROMES.find((ruta) => existsSync(ruta));

const resultados = [];
const ok = (nombre, cond, extra = '') => resultados.push([Boolean(cond), nombre, extra]);
const sh = (c) => execSync(c, { encoding: 'utf8' }).trim();
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function pedir(metodo, ruta, { cuerpo, cabeceras = {}, puerto = 8443, sinTls = false } = {}) {
  return new Promise((resolve, reject) => {
    const mod = sinTls ? http : https;
    const r = mod.request({ host: 'localhost', port: puerto, path: ruta, method: metodo, rejectUnauthorized: false, headers: { 'accept-encoding': 'gzip', ...cabeceras } }, (res) => {
      const partes = [];
      res.on('data', (c) => partes.push(c));
      res.on('end', () => {
        let datos = Buffer.concat(partes);
        if (res.headers['content-encoding'] === 'gzip' && datos.length) datos = zlib.gunzipSync(datos);
        resolve({ estado: res.statusCode, h: res.headers, cuerpo: datos.toString() });
      });
    });
    r.on('error', reject);
    if (cuerpo) r.write(cuerpo);
    r.end();
  });
}

async function esperarSalud(segundos) {
  for (let i = 0; i < segundos; i++) {
    const r = await pedir('GET', '/salud').catch(() => null);
    if (r && r.estado === 200) return true;
    await esperar(1000);
  }
  return false;
}

// 1. Cabeceras, caché, rutas de la app y reglas de nginx, sin navegador.
async function cabeceras() {
  const quiz = await pedir('GET', '/quiz/');
  const csp = quiz.h['content-security-policy'] || '';
  ok('quiz 200', quiz.estado === 200, quiz.estado);
  ok('HSTS', /max-age=\d+/.test(quiz.h['strict-transport-security'] || ''));
  ok('CSP con worker-src y manifest-src', /worker-src 'self'/.test(csp) && /manifest-src 'self'/.test(csp));
  ok('CSP sin terceros', csp !== '' && !/https?:/.test(csp));
  ok('X-Robots-Tag noindex', /noindex/.test(quiz.h['x-robots-tag'] || ''));
  ok('HTML no-cache', /no-cache/.test(quiz.h['cache-control'] || ''), quiz.h['cache-control']);
  ok('HTML comprimido', quiz.h['content-encoding'] === 'gzip', quiz.h['content-encoding']);
  const img = await pedir('GET', '/img/muneco-e_guardia.webp');
  ok('imágenes con caché de 30 días', /max-age=2592000/.test(img.h['cache-control'] || ''), img.h['cache-control']);
  const sw = await pedir('GET', '/app/sw.js');
  ok('sw.js no-cache', sw.estado === 200 && /no-cache/.test(sw.h['cache-control'] || ''), `${sw.estado} ${sw.h['cache-control']}`);
  const uuid = randomUUID();
  const sinBarra = await pedir('GET', `/app/${uuid}`);
  ok('/app/<acceso> sin barra: 301 a la ruta con barra', sinBarra.estado === 301 && (sinBarra.h.location || '').endsWith(`/app/${uuid}/`), `${sinBarra.estado} ${(sinBarra.h.location || '').replace(uuid, '<acceso>')}`);
  const app = await pedir('GET', `/app/${uuid}/`);
  ok('/app/<acceso>/ sirve la app', app.estado === 200 && /text\/html/.test(app.h['content-type'] || ''), app.estado);
  const man = await pedir('GET', `/app/${uuid}/manifest.webmanifest`);
  ok('manifest de cada acceso', man.estado === 200 && /application\/manifest\+json/.test(man.h['content-type'] || ''), `${man.estado} ${man.h['content-type']}`);
  const post = await pedir('POST', '/quiz/', { cuerpo: 'x' });
  ok('POST a lo estático: 405', post.estado === 405, post.estado);
  const robots = await pedir('GET', '/robots.txt');
  ok('robots.txt bloquea y deja pasar a los bots de vista previa', /User-agent: facebookexternalhit/.test(robots.cuerpo) && /Disallow: \//.test(robots.cuerpo));
  const salud = await pedir('GET', '/salud');
  ok('/salud llega al servicio', salud.estado === 200, salud.estado);
  const malo = await pedir('GET', '/api/app/no-es-uuid');
  ok('/api/app/<acceso inválido>: 400', malo.estado === 400, malo.estado);
  const sinHttps = await pedir('GET', '/quiz/?utm_source=x', { puerto: 8080, sinTls: true });
  ok('http: 301 a https', sinHttps.estado === 301 && /^https:\/\/localhost/.test(sinHttps.h.location || ''), `${sinHttps.estado} ${sinHttps.h.location}`);
  const oculto = await pedir('GET', '/.git/config');
  ok('archivos ocultos: 404', oculto.estado === 404, oculto.estado);
}

async function webhook(evento, datos, conToken = true) {
  const cab = { 'content-type': 'application/json' };
  if (conToken) cab.authorization = `Bearer ${TOKEN}`;
  return (await pedir('POST', `/api/hilvapay?evento=${evento}`, { cuerpo: JSON.stringify(datos), cabeceras: cab })).estado;
}

(async () => {
  if (!CHROME) { console.error('No encontré Chrome ni Edge. Poné la ruta en CHROME_PATH.'); process.exit(2); }
  if (!(await esperarSalud(5))) { console.error(`No responde ${BASE}/salud. Corré antes: sh deploy/prueba-de-humo/levantar.sh`); process.exit(2); }
  if (CAPTURAS) mkdirSync(CAPTURAS, { recursive: true });

  await cabeceras();

  // Perfil de Chrome propio y no de incógnito: desde una ventana de incógnito Chrome no deja instalar apps.
  const perfil = mkdtempSync(join(tmpdir(), 'humo-chrome-'));
  const c = await chromium.launchPersistentContext(perfil, { executablePath: CHROME, args: ['--ignore-certificate-errors'], ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  // Nada sale de localhost: si ya está cargado el link de Hilvapay, se anota adónde iba en vez de abrirlo.
  let salida = null;
  await c.route((url) => !['localhost', '127.0.0.1'].includes(url.hostname), (route) => { salida = route.request().url(); return route.abort(); });
  const p = c.pages()[0] || (await c.newPage());
  const foto = async (nombre) => { if (CAPTURAS) await p.screenshot({ path: join(CAPTURAS, `humo-${nombre}.png`) }); };
  const errores = [];
  // El aviso de red de la salida a Hilvapay que esta prueba frena a propósito no cuenta como error.
  p.on('console', (m) => { if (m.type() === 'error' && !(salida && /ERR_FAILED/.test(m.text()))) errores.push(m.text()); });
  p.on('pageerror', (e) => errores.push(String(e)));

  try {
    // 2. Los dos funnels: entran con campaña, van a la oferta y tocan «Ir al pago».
    for (const [quiz, oferta, funnel] of [['/quiz/', '/oferta/', 'peleador'], ['/quiz-peso/', '/oferta-peso/', 'peso']]) {
      await p.goto(`${BASE}${quiz}?utm_source=facebook&utm_medium=paid&utm_campaign=humo-${funnel}&utm_content=anuncio-1&fbclid=IwAR0humo${funnel}`);
      await p.waitForTimeout(900);
      const utm = await p.evaluate(() => localStorage.getItem('bc_utm'));
      ok(`${funnel}: guarda la campaña`, /humo-/.test(utm || ''), (utm || '').slice(0, 80));
      await p.goto(`${BASE}${oferta}`);
      await p.waitForTimeout(1200);
      await foto(`${funnel}-oferta`);
      salida = null;
      await p.locator('.oferta-main .cta').first().click();
      await p.waitForTimeout(500);
      const ir = p.locator('#pgb');
      if (await ir.count()) { await ir.click(); await p.waitForTimeout(800); }
      if (salida) {
        ok(`${funnel}: «Ir al pago» lleva al link de Hilvapay con el acceso y la campaña`, /[?&]acceso=/.test(salida) && /utm_campaign=humo-/.test(salida), salida.replace(/acceso=[^&]+/, 'acceso=<acceso>').slice(0, 140));
      } else {
        const msg = await p.locator('#pg').innerText().catch(() => '');
        ok(`${funnel}: sin link de pago no cobra y avisa`, /Todavía no abrimos el pago/.test(msg), msg.slice(0, 60));
      }
    }
    await p.waitForTimeout(800);
    const clics = sh('docker exec bc-api sh -c "cat /datos/clicks.jsonl 2>/dev/null || true"');
    ok('clics guardados con funnel, página y campaña', /"funnel":"peleador"/.test(clics) && /"funnel":"peso"/.test(clics) && /"utm_campaign":"humo-peso"/.test(clics) && /"pagina":"oferta"/.test(clics), `${clics ? clics.split('\n').length : 0} clics`);
    ok('los clics no guardan fbc', !/"fbc"/.test(clics));

    // 3. Compra simulada: el aviso de pago de Hilvapay, con el acceso del comprador en los parámetros extra.
    const acceso = randomUUID();
    const pago = { cobroId: `humo-${Date.now()}`, email: 'comprador.humo@example.com', nombre: 'Martín Humo', monto: '9990', moneda: 'ARS', purchasedAt: new Date().toISOString(), utms: { utm_source: 'facebook', utm_medium: 'paid', utm_campaign: 'humo-peso', utm_content: 'anuncio-1', utm_term: '(directo)' }, paramsExtra: { acceso, funnel: 'peso', nivel: 't2', pagina: 'oferta' } };
    ok('aviso sin token: 401', (await webhook('pagado', pago, false)) === 401);
    ok('aviso de pago: 200', (await webhook('pagado', pago)) === 200);
    ok('aviso repetido: 200', (await webhook('pagado', pago)) === 200);
    await p.waitForTimeout(500);
    const pagos = sh(`docker exec bc-api sh -c "grep -F '\\"cobroId\\":\\"${pago.cobroId}\\"' /datos/compras.jsonl | grep -c '\\"tipo\\":\\"pagado\\"' || true"`);
    ok('el aviso repetido no duplica la compra', pagos === '1', `${pagos} registro(s)`);
    const logs = sh('docker logs bc-api 2>&1 | tail -n 20');
    ok('mail de acceso armado con el link personal', logs.includes(`/app/${acceso}/`));
    ok('los logs no tienen el mail del comprador', !logs.includes(pago.email));

    // 4. /gracias/ como la abre Hilvapay, el botón y la app.
    await p.goto(`${BASE}/gracias/?acceso=${acceso}&nombre=Mart%C3%ADn&email=comprador.humo%40example.com&utm_source=facebook`);
    await p.waitForTimeout(1200);
    ok('gracias saca el nombre y el mail de la barra', !/email=|nombre=/.test(p.url()), p.url().replace(acceso, '<acceso>'));
    const href = await p.getAttribute('#entrar', 'href').catch(() => null);
    ok('gracias lleva a la app personal', href === `/app/${acceso}/`, (href || '').replace(acceso, '<acceso>'));
    await foto('gracias');
    await p.click('#entrar');
    await p.waitForTimeout(2500);
    await foto('app-entrada');
    const txt = await p.innerText('body');
    ok('la app abre la bienvenida del comprador', /Hola, Martín/.test(txt), txt.slice(0, 80).replace(/\s+/g, ' '));
    const registro = await p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return r ? (r.active ? 'activo' : 'instalando') : 'no'; });
    ok('service worker registrado', registro !== 'no', registro);
    const cdp = await c.newCDPSession(p);
    const inst = await cdp.send('Page.getInstallabilityErrors').catch((e) => ({ error: String(e) }));
    ok('instalable (Chrome no marca errores)', Array.isArray(inst.installabilityErrors) && inst.installabilityErrors.length === 0, JSON.stringify(inst.installabilityErrors || inst));
    const empezar = p.getByRole('button', { name: /Empezar/ }).last();
    if (await empezar.count()) { await empezar.click(); await p.waitForTimeout(1500); }
    await p.reload();
    await p.waitForTimeout(2500);
    ok('el service worker controla la app al recargar', await p.evaluate(() => Boolean(navigator.serviceWorker.controller)));
    await foto('app-hoy');
    ok('Hoy muestra la sesión del día', /Tu (primera )?sesión/i.test(await p.innerText('body')));

    // 5. Sin servidor: se apagan el servicio y nginx; la app tiene que seguir andando con lo que guardó.
    sh('docker stop -t 1 bc-api bc-web >/dev/null');
    await p.reload().catch(() => {});
    await p.waitForTimeout(5000);
    const sinRed = await p.innerText('body').catch(() => '');
    await foto('app-sin-servidor');
    ok('sin servidor la app sigue con el plan guardado', /sesión/i.test(sinRed) && !/No pudimos cargar/.test(sinRed), sinRed.slice(0, 90).replace(/\s+/g, ' '));
    sh('docker start bc-api bc-web >/dev/null');
    ok('el servidor vuelve a responder', await esperarSalud(30));

    // 6. Reembolso: el acceso se da de baja.
    ok('aviso de reembolso: 200', (await webhook('reembolso', { ...pago })) === 200);
    const estado = JSON.parse((await pedir('GET', `/api/app/${acceso}`)).cuerpo || '{}');
    ok('tras el reembolso el acceso queda revocado', estado.estado === 'revocado', estado.estado);

    ok('sin errores en la consola del navegador', errores.length === 0, errores.slice(0, 3).join(' | '));
  } finally {
    await c.close();
    rmSync(perfil, { recursive: true, force: true });
  }

  for (const [bien, nombre, extra] of resultados) {
    const detalle = extra !== '' && extra != null ? ` (${String(extra).replace(/\s+/g, ' ').trim()})` : '';
    console.log(`${bien ? 'ok ' : 'MAL'} ${nombre}${detalle}`);
  }
  const buenos = resultados.filter((r) => r[0]).length;
  console.log(`\n${buenos} de ${resultados.length} bien`);
  process.exit(buenos === resultados.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
