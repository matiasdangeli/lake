/** Chequeo del sitio publicado: onboarding + assets + instalabilidad + offline. */
import { chromium } from 'playwright';

const URL_BASE = 'https://matiasdangeli.github.io/lake/';
const out = [];
const ok = (m) => { out.push(true); console.log(`  ✓ ${m}`); };
const bad = (m) => { out.push(false); console.log(`  ✗ ${m}`); };

// La salida a internet de este entorno pasa por el proxy del agente.
const proxy = process.env.HTTPS_PROXY ?? process.env.https_proxy;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  ...(proxy ? { proxy: { server: proxy } } : {}),
  args: ['--ignore-certificate-errors'],
});
const ctx = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 402, height: 874 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: 'es-AR',
  timezoneId: 'America/Argentina/Buenos_Aires',
});
const page = await ctx.newPage();
const errors = [];
const notFound = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('response', (r) => r.status() >= 400 && notFound.push(`${r.status()} ${r.url()}`));

console.log(`\n${URL_BASE}\n`);

await page.goto(URL_BASE, { waitUntil: 'networkidle' });
try {
  await page.getByRole('button', { name: 'Empezar' }).waitFor({ timeout: 20000 });
  ok('la app carga en el sitio publicado');
} catch {
  bad('la app no carga');
}

await page.getByRole('button', { name: 'Empezar' }).click();
await page.getByRole('button', { name: 'Seguir' }).click();
await page.getByRole('button', { name: /2 vueltas/ }).click();
await page.getByRole('button', { name: 'Listo' }).click();
await page.locator('.challenge__name').waitFor({ timeout: 20000 });
const name = await page.locator('.challenge__name').innerText();
ok(`desafío del día: ${name}`);

const img = await page.locator('.challenge__img').evaluate((el) => ({ w: el.naturalWidth, src: el.src }));
img.w > 500 ? ok(`portada cargada (${img.w}px)`) : bad(`portada rota: ${JSON.stringify(img)}`);

const man = await page.evaluate(async () => {
  const href = document.querySelector('link[rel=manifest]').href;
  const j = await (await fetch(href)).json();
  return { start: new URL(j.start_url, href).href, display: j.display, icons: j.icons.length,
    icon: new URL(j.icons.at(-1).src, href).href };
});
const iconOk = (await page.evaluate((u) => fetch(u).then((r) => r.ok), man.icon));
man.start === URL_BASE && man.display === 'standalone' && iconOk
  ? ok(`instalable: start_url ${man.start}, ${man.icons} iconos`)
  : bad(`manifest mal: ${JSON.stringify(man)} iconOk=${iconOk}`);

const touch = await page.evaluate(() => document.querySelector('link[rel=apple-touch-icon]')?.href);
(await page.evaluate((u) => fetch(u).then((r) => r.ok), touch))
  ? ok('apple-touch-icon disponible')
  : bad('falta el apple-touch-icon');

await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForTimeout(4000);
const cached = await page.evaluate(async () => {
  const keys = await caches.keys();
  const c = await caches.open(keys[0]);
  return (await c.keys()).length;
});
cached > 50 ? ok(`service worker con ${cached} archivos cacheados`) : bad(`sólo ${cached} archivos cacheados`);

await ctx.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' });
try {
  await page.locator('.challenge__name').waitFor({ timeout: 15000 });
  const offImg = await page.locator('.challenge__img').evaluate((el) => el.naturalWidth);
  offImg > 500 ? ok('funciona sin conexión, con la portada incluida') : bad('sin conexión falta la portada');
} catch {
  bad('no abre sin conexión');
}
await ctx.setOffline(false);

await page.screenshot({ path: process.env.SHOT ?? '.e2e/live.png' });

const real = errors.filter((e) => !e.includes('favicon') && !e.includes('DISCONNECTED'));
real.length ? bad(`errores: ${real.slice(0, 2).join(' | ')}`) : ok('sin errores en consola');
const miss = notFound.filter((n) => !n.includes('favicon'));
miss.length ? bad(`404: ${miss.slice(0, 3).join(' | ')}`) : ok('ningún 404');

await browser.close();
const failed = out.filter((x) => !x).length;
console.log(`\n${out.length - failed}/${out.length} OK\n`);
process.exit(failed ? 1 : 0);
