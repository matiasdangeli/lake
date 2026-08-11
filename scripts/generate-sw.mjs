/**
 * Genera dist/sw.js con la lista real de archivos del build.
 *
 * Estrategia:
 *   · el shell (HTML, JS, CSS, iconos, portadas) se precachea en install
 *   · navegaciones: red primero, cache si no hay red -> la app abre offline
 *   · assets: cache primero -> instantáneo y sin datos
 */
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

const BASE = (process.env.BASE_PATH ?? '/').replace(/\/?$/, '/');

// Rutas relativas al dist (para leer del disco) y URLs públicas (para el cache).
const rels = (await walk(dist))
  .map((f) => relative(dist, f).split('\\').join('/'))
  .filter((f) => f !== 'sw.js' && !f.endsWith('.map'))
  .sort();
const files = rels.map((f) => BASE + f);

// Versión = huella del contenido: cualquier cambio invalida el cache viejo.
const hash = createHash('sha1');
for (const f of rels) {
  hash.update(f);
  hash.update(String((await stat(join(dist, f))).size));
}
const version = hash.digest('hex').slice(0, 10);

const sw = `/* LAKE service worker — generado en build. No editar. */
const VERSION = '${version}';
const CACHE = 'lake-' + VERSION;
const INDEX = '${BASE}index.html';
const PRECACHE = ${JSON.stringify(files, null, 2)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // addAll es todo-o-nada; así un asset caído no rompe la instalación.
      await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {})));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE);
          cache.put(INDEX, fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(CACHE);
          return (await cache.match(INDEX)) ?? Response.error();
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(request);
      if (hit) return hit;
      try {
        const fresh = await fetch(request);
        if (fresh.ok && fresh.type === 'basic') cache.put(request, fresh.clone());
        return fresh;
      } catch {
        return hit ?? Response.error();
      }
    })()
  );
});
`;

await writeFile(join(dist, 'sw.js'), sw);
const bytes = (await Promise.all(rels.map(async (f) => (await stat(join(dist, f))).size)))
  .reduce((a, b) => a + b, 0);
console.log(`sw.js generado · ${files.length} archivos precacheados · ${(bytes / 1024 / 1024).toFixed(2)} MB · v${version}`);
