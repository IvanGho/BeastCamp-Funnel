/* Service worker de la app BeastCamp (alcance /app/). La versión sale de un hash del contenido (la pone construir-app.mjs).
   - Precarga el shell, offline.html, los íconos y los muñecos de la app.
   - HTML de /app/*: red primero (3 s) y, si falla, la única copia guardada: sirve para todas las rutas /app/<acceso>/.
   - El plan y el estado (/api/app/<acceso> y /plan): red primero con tiempo y, si falla, la copia guardada (se marca con x-bc-cache).
   - /img/: caché primero. /media/ y todo lo demás de /api/: sin caché (nunca 206). PUT y POST no se tocan.
   - Versión nueva: queda esperando hasta que la app avise («Hay una versión nueva») con el mensaje `actualizar`. */
const VERSION = '__VERSION__';
const PRECARGA = __PRECARGA__;
const SHELL = '/app/';
const C_SHELL = `bc-app-${VERSION}-shell`;
const C_IMG = 'bc-app-img';
const C_DATOS = 'bc-app-datos';
const PLAZO = 3000;
const RE_DATOS = /^\/api\/app\/[0-9a-f-]{36}(\/plan)?$/;

self.addEventListener('install', (ev) => {
  ev.waitUntil((async () => {
    const shell = await caches.open(C_SHELL), img = await caches.open(C_IMG);
    await Promise.all(PRECARGA.map(async (u) => {
      try {
        const r = await fetch(new Request(u, { cache: 'reload' }));
        if (r.ok) await (u.startsWith('/img/') ? img : shell).put(u, r);
        else if (u === SHELL || u === '/app/offline.html') throw new Error('falta ' + u);
      } catch (e) { if (u === SHELL || u === '/app/offline.html') throw e; }
    }));
  })());
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil((async () => {
    const vigentes = new Set([C_SHELL, C_IMG, C_DATOS]);
    for (const k of await caches.keys()) if (k.startsWith('bc-app-') && !vigentes.has(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (ev) => {
  const d = ev.data || {};
  if (d.type === 'actualizar') self.skipWaiting();
  if (d.type === 'precache' && Array.isArray(d.urls)) {
    ev.waitUntil((async () => {
      const img = await caches.open(C_IMG);
      for (const u of d.urls) {
        if (typeof u !== 'string' || !u.startsWith('/img/') || await img.match(u)) continue;
        try { const r = await fetch(u); if (r.ok) await img.put(u, r); } catch (e) {}
      }
    })());
  }
});

const marcar = (r) => { const h = new Headers(r.headers); h.set('x-bc-cache', '1'); return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h }); };
const fallo = (r) => r.status >= 500;

/* Red primero con tiempo: si la red no contesta en PLAZO (o falla) y hay copia, se usa la copia. Si no hay copia, se espera a la red. */
async function redPrimero(ev, req, cacheNombre, clave, guardable) {
  const cache = await caches.open(cacheNombre);
  const red = fetch(req).then(async (r) => { if (guardable(r)) await cache.put(clave, r.clone()); return r; });
  ev.waitUntil(red.catch(() => {}));
  let r = null;
  try { r = await Promise.race([red, new Promise((ok) => setTimeout(() => ok(null), PLAZO))]); } catch (e) { r = null; }
  if (r && !fallo(r)) return r;
  const copia = await cache.match(clave);
  if (copia) return marcar(copia);
  if (r) return r;
  return red;
}

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const p = url.pathname;

  if (p === '/app/sw.js') return;

  // HTML de la app: una sola copia para todas las rutas /app/<acceso>/
  if (req.mode === 'navigate' && p.startsWith('/app/')) {
    ev.respondWith(redPrimero(ev, req, C_SHELL, SHELL, (r) => r.ok && /text\/html/.test(r.headers.get('content-type') || '')).catch(async () => (await caches.match('/app/offline.html')) || Response.error()));
    return;
  }
  if (p.endsWith('/manifest.webmanifest') && p.startsWith('/app/')) {
    ev.respondWith(redPrimero(ev, req, C_SHELL, '/app/manifest.webmanifest', (r) => r.ok).catch(() => Response.error()));
    return;
  }
  if (RE_DATOS.test(p)) {
    ev.respondWith(redPrimero(ev, req, C_DATOS, p, (r) => r.status === 200).catch(() => new Response('{"error":"sin conexion"}', { status: 503, headers: { 'content-type': 'application/json' } })));
    return;
  }
  if (p.startsWith('/img/')) {
    ev.respondWith((async () => {
      const cache = await caches.open(C_IMG);
      const hit = await cache.match(p);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.status === 200) cache.put(p, r.clone());
      return r;
    })());
    return;
  }
  // /media/, el resto de /api/ y cualquier otra cosa: directo a la red, sin guardar
});
