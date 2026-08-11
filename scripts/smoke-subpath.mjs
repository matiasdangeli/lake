/**
 * Comprobación rápida de que el build publicado en un subdirectorio funciona.
 *
 *   BASE_PATH=/lake/ npm run build && BASE_PATH=/lake/ node scripts/smoke-subpath.mjs
 *
 * Verifica lo único que cambia al publicar fuera de la raíz: que todas las
 * URLs (bundle, manifest, iconos, portadas, service worker) resuelvan bien.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_PATH = (process.env.BASE_PATH ?? '/').replace(/\/?$/, '/');

const freePort = () =>
  new Promise((res, rej) => {
    const s = createServer();
    s.on('error', rej);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => res(port));
    });
  });

const port = await freePort();
const BASE = `http://127.0.0.1:${port}${BASE_PATH}`;

const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
  cwd: root, stdio: ['ignore', 'pipe', 'pipe'], detached: true,
});
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('el server no arrancó')), 25000);
  server.stdout.on('data', (d) => d.toString().includes('Local') && (clearTimeout(t), res()));
});

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 402, height: 874 } });

const failures = [];
const bad = [];
page.on('response', (r) => {
  if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`);
});
page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && failures.push(m.text()));

console.log(`\nsmoke en ${BASE}\n`);

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Empezar' }).waitFor({ timeout: 15000 });
console.log('  ✓ la app arranca bajo el subdirectorio');

// Recorremos el onboarding hasta ver una portada: es lo que valida las rutas de assets.
await page.getByRole('button', { name: 'Empezar' }).click();
await page.getByRole('button', { name: 'Seguir' }).click();
await page.getByRole('button', { name: /2 vueltas/ }).click();
await page.getByRole('button', { name: 'Listo' }).click();
await page.locator('.challenge__name').waitFor({ timeout: 15000 });

const img = await page.locator('.challenge__img').evaluate((el) => ({
  src: el.getAttribute('src'),
  w: el.naturalWidth,
}));
if (!img.src?.startsWith(BASE_PATH)) failures.push(`portada sin base: ${img.src}`);
if (img.w < 500) failures.push(`portada rota: ${JSON.stringify(img)}`);
else console.log(`  ✓ portadas cargan desde ${BASE_PATH}challenges/`);

const manifest = await page.evaluate(async (base) => {
  const href = document.querySelector('link[rel=manifest]')?.getAttribute('href');
  const res = await fetch(href);
  const json = await res.json();
  return { href, ok: res.ok, start: new URL(json.start_url, new URL(href, location.href)).pathname,
    icon: new URL(json.icons[0].src, new URL(href, location.href)).pathname, base };
}, BASE_PATH);
if (!manifest.ok) failures.push(`manifest ${manifest.href} no carga`);
if (manifest.start !== BASE_PATH) failures.push(`start_url resuelve a ${manifest.start}`);
if (!manifest.icon.startsWith(BASE_PATH)) failures.push(`iconos fuera de base: ${manifest.icon}`);
else console.log(`  ✓ manifest instalable (start_url ${manifest.start})`);

const sw = await page.evaluate(async (base) => {
  const res = await fetch(`${base}sw.js`);
  return { ok: res.ok, text: (await res.text()).slice(0, 4000) };
}, BASE_PATH);
if (!sw.ok) failures.push('sw.js no se sirve');
else if (!sw.text.includes(`'${BASE_PATH}index.html'`)) failures.push('el sw no apunta a la base correcta');
else console.log('  ✓ service worker con rutas de la base');

const notFound = bad.filter((b) => !b.includes('favicon'));
if (notFound.length) failures.push(`respuestas 4xx: ${notFound.slice(0, 5).join(' | ')}`);
else console.log('  ✓ ningún 404');

await browser.close();
try { process.kill(-server.pid, 'SIGKILL'); } catch { /* ya murió */ }

if (failures.length) {
  console.log('\n' + failures.map((f) => `  ✗ ${f}`).join('\n') + '\n');
  process.exit(1);
}
console.log('\nEl build de subdirectorio está sano.\n');
