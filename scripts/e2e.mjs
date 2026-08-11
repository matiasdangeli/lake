/**
 * Recorrido completo de LAKE en un viewport de iPhone 16 Pro.
 *
 *   npm run build && node scripts/e2e.mjs [--shots <dir>]
 *
 * No es un test unitario: abre la app de verdad, la usa como la usaría una
 * persona y falla si algo se rompe, si aparece scroll horizontal o si la
 * consola tira errores.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shotsIdx = process.argv.indexOf('--shots');
const SHOTS = shotsIdx > -1 ? process.argv[shotsIdx + 1] : resolve(root, '.e2e');
/** Puerto libre elegido al vuelo: no chocamos con un preview olvidado. */
const PORT = await freePort();
// Respeta BASE_PATH: así probamos también la publicación en un subdirectorio.
const BASE_PATH = (process.env.BASE_PATH ?? '/').replace(/\/?$/, '/');
// Con barra final: vite preview no redirige /lake -> /lake/.
const BASE = `http://127.0.0.1:${PORT}${BASE_PATH}`;

function freePort() {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.on('error', rej);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => res(port));
    });
  });
}

// iPhone 16 Pro
const VIEWPORT = { width: 402, height: 874 };
const DPR = 3;

const results = [];
let shotN = 0;

const ok = (name) => { results.push({ name, ok: true }); console.log(`  ✓ ${name}`); };
const fail = (name, err) => { results.push({ name, ok: false, err: String(err) }); console.log(`  ✗ ${name} — ${err}`); };

async function step(name, fn) {
  try {
    await fn();
    ok(name);
  } catch (e) {
    fail(name, e.message ?? e);
  }
}

function serve() {
  // detached: así podemos matar todo el grupo. npx no propaga la señal a vite.
  const p = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'], detached: true,
  });
  return new Promise((res, rej) => {
    const timer = setTimeout(() => rej(new Error('el server no arrancó')), 25000);
    p.stdout.on('data', (d) => {
      if (d.toString().includes('Local')) {
        clearTimeout(timer);
        res(p);
      }
    });
    p.stderr.on('data', (d) => process.stderr.write(d));
  });
}

async function main() {
  await mkdir(SHOTS, { recursive: true });
  const server = await serve();
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DPR,
    isMobile: true,
    hasTouch: true,
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
    colorScheme: 'dark',
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

  const shot = async (label) => {
    shotN++;
    const file = `${SHOTS}/${String(shotN).padStart(2, '0')}-${label}.png`;
    await page.screenshot({ path: file });
    return file;
  };

  const noOverflow = async (where) => {
    const over = await page.evaluate(() => {
      const de = document.documentElement;
      return { scrollW: de.scrollWidth, clientW: de.clientWidth };
    });
    if (over.scrollW > over.clientW + 1) {
      throw new Error(`overflow horizontal en ${where}: ${over.scrollW} > ${over.clientW}`);
    }
  };

  console.log('\nLAKE · recorrido en iPhone 16 Pro\n');

  /* ---------------- onboarding ---------------- */

  await step('carga inicial y onboarding', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Empezar' }).waitFor({ timeout: 10000 });
    await noOverflow('onboarding 1');
    await shot('onboarding-1');
  });

  await step('paso 2: distancia de la vuelta editable', async () => {
    await page.getByRole('button', { name: 'Empezar' }).click();
    await page.getByText('Lago Municipal').first().waitFor();
    await shot('onboarding-2');
    await page.getByRole('button', { name: 'Sumar' }).click();
    const v = await page.locator('.stepper__value').first().innerText();
    if (!v.startsWith('4,1')) throw new Error(`stepper no cambió: ${v}`);
    await page.getByRole('button', { name: 'Restar' }).click();
    await noOverflow('onboarding 2');
  });

  await step('paso 3: nivel inicial', async () => {
    await page.getByRole('button', { name: 'Seguir' }).click();
    await page.getByText('¿Cuánto te resulta cómodo pedalear hoy?').waitFor();
    await shot('onboarding-3');
    await page.getByRole('button', { name: /2 vueltas/ }).click();
    await noOverflow('onboarding 3');
    await page.getByRole('button', { name: 'Listo' }).click();
  });

  /* ---------------- home ---------------- */

  let challengeName = '';
  await step('home muestra el desafío del día', async () => {
    await page.locator('.challenge__name').waitFor({ timeout: 8000 });
    challengeName = await page.locator('.challenge__name').innerText();
    const target = await page.locator('.challenge__laps').innerText();
    if (target !== '2 vueltas') throw new Error(`objetivo inesperado: ${target}`);
    const num = await page.locator('.challenge__num').first().innerText();
    if (!/^#\d\d$/.test(num)) throw new Error(`número mal formado: ${num}`);
    await page.waitForTimeout(600);
    await noOverflow('home');
    await shot('home');
  });

  await step('la portada carga de verdad (no es un placeholder)', async () => {
    const info = await page.locator('.challenge__img').evaluate((img) => ({
      w: img.naturalWidth, h: img.naturalHeight, src: img.getAttribute('src'),
    }));
    if (info.w < 500 || info.h < 600) throw new Error(`imagen chica o rota: ${JSON.stringify(info)}`);
    if (!info.src?.startsWith(`${BASE_PATH}challenges/`)) throw new Error(`src inesperado: ${info.src}`);
  });

  await step('comenzar marca el desafío en curso', async () => {
    await page.getByRole('button', { name: 'Comenzar' }).click();
    await page.getByText('En curso').waitFor();
    await shot('home-en-curso');
  });

  /* ---------------- registrar ---------------- */

  await step('registrar salida: calcula velocidad media sola', async () => {
    await page.getByRole('button', { name: 'Registrar salida' }).first().click();
    await page.getByRole('dialog').waitFor();
    await page.getByPlaceholder('29:14').fill('29:14');
    await page.waitForTimeout(150);
    const banner = await page.locator('.banner--info').first().innerText();
    if (!banner.includes('16,4')) throw new Error(`velocidad media mal calculada: ${banner}`);
    await noOverflow('sheet registrar');
    await shot('sheet-registrar');
  });

  await step('esfuerzo y sensación', async () => {
    await page.locator('.slider').fill('6');
    await page.getByRole('radio', { name: 'Bien' }).click();
    await page.getByRole('button', { name: 'Guardar' }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 8000 });
  });

  await step('la tarjeta queda completada y en blanco y negro', async () => {
    await page.locator('.challenge.is-done').waitFor({ timeout: 5000 });
    const filter = await page.locator('.challenge__img').evaluate((el) => getComputedStyle(el).filter);
    if (!filter.includes('grayscale')) throw new Error(`la tarjeta no se desaturó: ${filter}`);
    await page.getByText('Completado').waitFor();
    await page.waitForTimeout(400);
    await shot('home-completado');
  });

  await step('no aparece el desafío siguiente', async () => {
    const cards = await page.locator('.challenge').count();
    if (cards !== 1) throw new Error(`hay ${cards} desafíos visibles, debería haber 1`);
    const name = await page.locator('.challenge__name').innerText();
    if (name !== challengeName) throw new Error(`cambió el desafío al completarlo: ${name}`);
  });

  await step('se desbloquearon logros', async () => {
    const toast = await page.locator('.toast').count();
    if (toast === 0) throw new Error('no apareció ningún logro');
    await shot('logro');
  });

  /* ---------------- persistencia ---------------- */

  await step('los datos sobreviven al reload', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.challenge.is-done').waitFor({ timeout: 8000 });
    const name = await page.locator('.challenge__name').innerText();
    if (name !== challengeName) throw new Error(`tras recargar cambió el desafío: ${name}`);
  });

  /* ---------------- calendario ---------------- */

  await step('el calendario muestra el día completado con su portada', async () => {
    await page.getByRole('button', { name: 'Calendario' }).click();
    await page.locator('.cal__grid').waitFor();
    const withArt = await page.locator('.cal__cell.has-art').count();
    if (withArt !== 1) throw new Error(`celdas con arte: ${withArt}, esperaba 1`);
    await page.waitForTimeout(500);
    await noOverflow('calendario');
    await shot('calendario');
  });

  await step('los días sin actividad quedan vacíos', async () => {
    const empty = await page.locator('.cal__cell.is-empty').count();
    if (empty < 20) throw new Error(`solo ${empty} celdas vacías`);
    const imgs = await page.locator('.cal__cell.is-empty img').count();
    if (imgs > 0) throw new Error('un día sin actividad está mostrando imagen');
  });

  await step('tocar un día completado abre el detalle', async () => {
    await page.locator('.cal__cell.has-art').first().click();
    await page.getByRole('dialog').waitFor();
    await page.getByText('29:14').first().waitFor();
    await noOverflow('detalle');
    await shot('detalle-sesion');
  });

  await step('editar el historial funciona', async () => {
    await page.getByRole('button', { name: 'Editar' }).click();
    const edit = page.getByRole('dialog', { name: 'Editar salida' });
    await edit.waitFor();
    const others = await page.getByRole('dialog').count();
    if (others !== 1) throw new Error(`quedaron ${others} sheets abiertos a la vez`);
    await edit.getByPlaceholder('8,0').fill('9,4');
    await edit.getByRole('button', { name: 'Guardar' }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 8000 });
    await page.getByRole('button', { name: 'Progreso' }).click();
    await page.locator('.metric__value').first().waitFor();
    const total = await page.locator('.metric__value').first().innerText();
    if (!total.startsWith('9,4')) throw new Error(`el total no se recalculó: ${total}`);
  });

  /* ---------------- progreso ---------------- */

  await step('progreso muestra métricas y logros', async () => {
    await page.waitForTimeout(400);
    await noOverflow('progreso');
    await shot('progreso');
    const badges = await page.locator('.badge.is-on').count();
    if (badges < 2) throw new Error(`solo ${badges} logros desbloqueados`);
  });

  /* ---------------- perfil ---------------- */

  await step('perfil y exportación', async () => {
    await page.getByRole('button', { name: 'Perfil' }).click();
    await page.locator('.title').waitFor();
    await noOverflow('perfil');
    await shot('perfil');
    const dl = page.waitForEvent('download', { timeout: 10000 });
    await page.getByRole('button', { name: 'Exportar' }).click();
    const download = await dl;
    const path = await download.path();
    const { readFile } = await import('node:fs/promises');
    const backup = JSON.parse(await readFile(path, 'utf8'));
    if (backup.app !== 'LAKE') throw new Error('el backup no dice LAKE');
    if (backup.sessions.length !== 1) throw new Error(`el backup trae ${backup.sessions.length} salidas`);
    if (Math.abs(backup.sessions[0].distanceKm - 9.4) > 0.01) throw new Error('el backup no tiene la edición');
    await writeFile(`${SHOTS}/backup.json`, JSON.stringify(backup, null, 2));
  });

  await step('cambiar la distancia de la vuelta recalcula objetivos', async () => {
    const openLap = async () => {
      await page.getByRole('button', { name: /Una vuelta/ }).click();
      const d = page.getByRole('dialog', { name: 'Distancia de una vuelta' });
      await d.waitFor();
      return d;
    };
    let d = await openLap();
    for (let i = 0; i < 5; i++) await d.getByRole('button', { name: 'Sumar' }).click();
    await d.getByRole('button', { name: 'Guardar' }).click();
    await d.waitFor({ state: 'detached' });
    const shown = await page.getByRole('button', { name: /Una vuelta/ }).innerText();
    if (!shown.includes('4,5')) throw new Error(`la distancia no se guardó: ${shown}`);
    // Volver a 4,0 para dejar el estado prolijo.
    d = await openLap();
    for (let i = 0; i < 5; i++) await d.getByRole('button', { name: 'Restar' }).click();
    await d.getByRole('button', { name: 'Guardar' }).click();
    await d.waitFor({ state: 'detached' });
  });

  /* ---------------- deshacer ---------------- */

  await step('deshacer devuelve el desafío a pendiente', async () => {
    await page.getByRole('button', { name: 'Inicio' }).click();
    await page.locator('.challenge.is-done').waitFor();
    await page.getByRole('button', { name: 'Deshacer' }).click();
    const confirm = page.getByRole('dialog', { name: 'Deshacer el completado' });
    await confirm.waitFor();
    await confirm.getByRole('button', { name: 'Deshacer' }).click();
    // Deshacer revierte el completado, no el "comenzar": el desafío queda en curso.
    await page.getByText('En curso').waitFor({ timeout: 8000 });
    const done = await page.locator('.challenge.is-done').count();
    if (done !== 0) throw new Error('sigue marcada como completada');
    // La salida asociada se borra con el deshacer: progreso vuelve a vacío.
    await page.getByRole('button', { name: 'Progreso' }).click();
    await page.locator('.empty__text').waitFor({ timeout: 6000 });
    const activos = await page.locator('.badge.is-on').count();
    if (activos !== 0) throw new Error(`quedaron ${activos} logros colgados`);
    await page.getByRole('button', { name: 'Inicio' }).click();
    await page.locator('.challenge__name').waitFor();
  });

  await step('omitir no castiga y se puede retomar', async () => {
    await page.getByRole('button', { name: 'Omitir hoy' }).click();
    await page.getByText('Omitido').waitFor();
    await shot('home-omitido');
    await page.getByRole('button', { name: 'Retomar' }).click();
    await page.getByRole('button', { name: 'Registrar salida' }).first().waitFor();
  });

  /* ---------------- cambio de día ---------------- */

  await step('a las 00:00 cambia la identidad, no la carga', async () => {
    const before = await page.locator('.challenge__name').innerText();
    const beforeLaps = await page.locator('.challenge__laps').innerText();
    // Adelantamos el reloj del navegador un día y disparamos el chequeo.
    await page.evaluate(() => {
      const real = Date;
      const shift = 24 * 60 * 60 * 1000;
      class Shifted extends real {
        constructor(...args) {
          if (args.length === 0) super(real.now() + shift);
          else super(...args);
        }
        static now() { return real.now() + shift; }
      }
      globalThis.Date = Shifted;
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
    });
    await page.waitForFunction(
      (prev) => document.querySelector('.challenge__name')?.textContent !== prev,
      before,
      { timeout: 8000 }
    );
    const after = await page.locator('.challenge__name').innerText();
    const afterLaps = await page.locator('.challenge__laps').innerText();
    if (after === before) throw new Error('la identidad no cambió');
    if (afterLaps !== beforeLaps) throw new Error(`la carga cambió sola: ${beforeLaps} -> ${afterLaps}`);
    await shot('home-dia-siguiente');
  });

  /* ---------------- primer arranque ---------------- */

  await step('estado vacío: primer arranque limpio', async () => {
    const fresh = await context.newPage();
    await fresh.goto(`${BASE}?fresh=1`);
    await fresh.evaluate(async () => {
      localStorage.clear();
      for (const db of await indexedDB.databases()) if (db.name) indexedDB.deleteDatabase(db.name);
    });
    await fresh.reload({ waitUntil: 'networkidle' });
    await fresh.getByRole('button', { name: 'Empezar' }).waitFor({ timeout: 8000 });
    // Sin datos demo: nada de salidas fantasma.
    const count = await fresh.evaluate(() => localStorage.length);
    if (count > 1) throw new Error(`el arranque limpio dejó ${count} claves`);
    await fresh.close();
  });

  /* ---------------- offline ---------------- */

  await step('funciona sin conexión', async () => {
    const off = await context.newPage();
    await off.goto(BASE, { waitUntil: 'networkidle' });
    await off.evaluate(() => navigator.serviceWorker.ready);
    await off.waitForTimeout(1200);
    await context.setOffline(true);
    await off.reload({ waitUntil: 'domcontentloaded' });
    await off.locator('.challenge__name, .onb__mark').first().waitFor({ timeout: 10000 });
    const imgOk = await off.locator('.challenge__img').count()
      ? await off.locator('.challenge__img').evaluate((i) => i.naturalWidth > 0).catch(() => false)
      : true;
    if (!imgOk) throw new Error('la portada no está cacheada');
    await off.screenshot({ path: `${SHOTS}/${String(++shotN).padStart(2, '0')}-offline.png` });
    await context.setOffline(false);
    await off.close();
  });

  /* ---------------- consola ---------------- */

  await step('sin errores en consola', async () => {
    const real = consoleErrors.filter((e) => !e.includes('favicon') && !e.includes('ERR_INTERNET_DISCONNECTED'));
    if (real.length) throw new Error(real.slice(0, 3).join(' | '));
  });

  await browser.close();
  try { process.kill(-server.pid, 'SIGKILL'); } catch { /* ya murió */ }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} pasos OK · capturas en ${SHOTS}\n`);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
