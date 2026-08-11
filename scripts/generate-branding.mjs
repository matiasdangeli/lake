/**
 * Sistema de identidad de LAKE, generado a partir de la silueta del lago.
 *   node scripts/generate-branding.mjs
 *
 * Salidas:
 *   public/branding/*.svg            isotipo (plano y liquid glass), logotipo,
 *                                    lockups horizontal/vertical, icono
 *   public/icons/*.png               PWA + apple-touch-icon
 *   public/favicon.{png,svg}
 *   src/data/lakePath.generated.ts   paths para usar dentro de la app
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { lakePaths, lakeLoopPath } from './lake-shape.mjs';
import {
  textSvg, textPaths, textWidth, CAP_HEIGHT, STROKE,
  WORDMARK_TEXT, TAGLINE_TEXT, WORDMARK_TRACKING, TAGLINE_TRACKING,
  WORDMARK_WIDTH, TAGLINE_WIDTH,
} from './wordmark.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = (...p) => resolve(root, ...p);

/** Paleta LAKE. */
export const BRAND = {
  ink: '#05070A',
  abyss: '#0A0F16',
  deep: '#16283C',
  slate: '#3B5573',
  steel: '#5B7A9C',
  bright: '#4FB4F0',
  sky: '#7FC8F5',
  glacier: '#CFE9FB',
  white: '#F2F8FD',
};

const svg = (attrs, body) => `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>\n${body}\n</svg>\n`;

/** Superelipse estilo iOS (squircle). */
function squircle(size, n = 5) {
  const a = size / 2;
  const pts = [];
  for (let i = 0; i < 256; i++) {
    const t = (i / 256) * Math.PI * 2;
    const ct = Math.cos(t), st = Math.sin(t);
    pts.push(`${(a * Math.sign(ct) * Math.abs(ct) ** (2 / n) + a).toFixed(2)},${(a * Math.sign(st) * Math.abs(st) ** (2 / n) + a).toFixed(2)}`);
  }
  return 'M' + pts.join('L') + 'Z';
}

/* ------------------------------------------------------------------ */
/* Isotipo plano — la versión que se usa en la UI                      */
/* ------------------------------------------------------------------ */

function isotipoSvg() {
  const { outline, island } = lakePaths({ size: 100, pad: 3 });
  return svg(
    'viewBox="0 0 100 100" width="100" height="100" fill="none" role="img" aria-label="LAKE"',
    `  <title>LAKE</title>\n  <path d="${outline}${island}" fill="currentColor" fill-rule="evenodd"/>`
  );
}

/* ------------------------------------------------------------------ */
/* Isotipo liquid glass                                                */
/* ------------------------------------------------------------------ */

/**
 * Capas: halo exterior · contorno fantasma desplazado (el "vidrio doble")
 * · cuerpo con degradado · sombra interna abajo-derecha · brillo especular
 * arriba-izquierda · filo de luz.
 */
function glassLakeLayers(size, { idp = 'g' } = {}) {
  const { outline, island } = lakePaths({ size, pad: 0 });
  const d = `${outline}${island}`;
  const k = size / 1000;
  const defs = `
    <linearGradient id="${idp}body" x1="0.12" y1="0.05" x2="0.82" y2="0.95">
      <stop offset="0" stop-color="${BRAND.glacier}"/>
      <stop offset="0.22" stop-color="${BRAND.sky}"/>
      <stop offset="0.55" stop-color="${BRAND.bright}"/>
      <stop offset="0.82" stop-color="#2478B8"/>
      <stop offset="1" stop-color="#1B5E96"/>
    </linearGradient>
    <linearGradient id="${idp}rim" x1="0.1" y1="0" x2="0.75" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.95"/>
      <stop offset="0.35" stop-color="#ffffff" stop-opacity="0.28"/>
      <stop offset="0.72" stop-color="${BRAND.sky}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0.15"/>
    </linearGradient>
    <clipPath id="${idp}clip"><path d="${d}" clip-rule="evenodd"/></clipPath>
    <filter id="${idp}halo" x="-45%" y="-45%" width="190%" height="190%">
      <feGaussianBlur stdDeviation="${(28 * k).toFixed(2)}"/>
    </filter>
    <filter id="${idp}spec" x="-45%" y="-45%" width="190%" height="190%">
      <feGaussianBlur stdDeviation="${(16 * k).toFixed(2)}"/>
    </filter>
    <filter id="${idp}shade" x="-45%" y="-45%" width="190%" height="190%">
      <feGaussianBlur stdDeviation="${(26 * k).toFixed(2)}"/>
    </filter>`;

  const body = `
    <g>
      <path d="${d}" fill-rule="evenodd" fill="${BRAND.bright}" opacity="0.5" filter="url(#${idp}halo)"/>
      <g transform="translate(${(-14 * k).toFixed(2)} ${(16 * k).toFixed(2)})">
        <path d="${d}" fill-rule="evenodd" fill="none" stroke="${BRAND.sky}" stroke-width="${(5 * k).toFixed(2)}" opacity="0.45"/>
      </g>
      <path d="${d}" fill-rule="evenodd" fill="url(#${idp}body)"/>
      <g clip-path="url(#${idp}clip)">
        <g transform="translate(${(26 * k).toFixed(2)} ${(30 * k).toFixed(2)})">
          <path d="${d}" fill-rule="evenodd" fill="none" stroke="#0A2F4E" stroke-width="${(44 * k).toFixed(2)}" opacity="0.5" filter="url(#${idp}shade)"/>
        </g>
        <g transform="translate(${(-18 * k).toFixed(2)} ${(-22 * k).toFixed(2)})">
          <path d="${d}" fill-rule="evenodd" fill="none" stroke="#ffffff" stroke-width="${(30 * k).toFixed(2)}" opacity="0.6" filter="url(#${idp}spec)"/>
        </g>
      </g>
      <path d="${d}" fill-rule="evenodd" fill="none" stroke="url(#${idp}rim)" stroke-width="${(4.5 * k).toFixed(2)}"/>
    </g>`;
  return { defs, body };
}

function isotipoGlassSvg(size = 1000) {
  const { defs, body } = glassLakeLayers(size * 0.9);
  const off = size * 0.05;
  return svg(
    `viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" fill="none" role="img" aria-label="LAKE"`,
    `  <title>LAKE</title>\n  <defs>${defs}</defs>\n  <g transform="translate(${off} ${off})">${body}</g>`
  );
}

/* ------------------------------------------------------------------ */
/* Logotipo y lockups                                                  */
/* ------------------------------------------------------------------ */

function wordmarkSvg() {
  const pad = STROKE / 2;
  const w = WORDMARK_WIDTH + pad * 2;
  const tagScale = 0.3;
  const tagW = TAGLINE_WIDTH * tagScale;
  const gap = 46;
  const h = CAP_HEIGHT + gap + CAP_HEIGHT * tagScale + pad * 2;
  return svg(
    `viewBox="0 0 ${fx(w)} ${fx(h)}" width="${fx(w)}" height="${fx(h)}" fill="none" role="img" aria-label="LAKE — Ride the loop."`,
    `  <title>LAKE — Ride the loop.</title>
  ${textSvg(WORDMARK_TEXT, { x: pad, y: pad, tracking: WORDMARK_TRACKING })}
  ${textSvg(TAGLINE_TEXT, { scale: tagScale, x: pad + (WORDMARK_WIDTH - tagW) / 2, y: pad + CAP_HEIGHT + gap, tracking: TAGLINE_TRACKING })}`
  );
}

const fx = (v) => Number(v.toFixed(1));

function lockupSvg({ vertical = false, tagline = true, glass = false } = {}) {
  const markSize = vertical ? 170 : 150;
  const capH = vertical ? 52 : 64;
  const wmScale = capH / CAP_HEIGHT;
  const wmW = WORDMARK_WIDTH * wmScale;
  const tagScale = wmScale * 0.3;
  const tagW = TAGLINE_WIDTH * tagScale;
  const tagGap = capH * 0.52;
  const textH = capH + (tagline ? tagGap + CAP_HEIGHT * tagScale : 0);
  const gap = vertical ? 40 : 54;

  const w = vertical ? Math.max(markSize, wmW, tagW) : markSize + gap + Math.max(wmW, tagW);
  const h = vertical ? markSize + gap + textH : Math.max(markSize, textH);

  const markX = vertical ? (w - markSize) / 2 : 0;
  const markY = vertical ? 0 : (h - markSize) / 2;
  const textTop = vertical ? markSize + gap : (h - textH) / 2;
  const textLeft = vertical ? (w - wmW) / 2 : markSize + gap;

  const { outline, island } = lakePaths({ size: markSize, pad: 0 });
  const glassPart = glass ? glassLakeLayers(markSize, { idp: 'lk' }) : null;

  return svg(
    `viewBox="0 0 ${fx(w)} ${fx(h)}" width="${fx(w)}" height="${fx(h)}" fill="none" role="img" aria-label="LAKE — Ride the loop."`,
    `  <title>LAKE — Ride the loop.</title>
  ${glassPart ? `<defs>${glassPart.defs}</defs>` : ''}
  <g transform="translate(${fx(markX)} ${fx(markY)})">${
      glassPart ? glassPart.body : `<path d="${outline}${island}" fill="currentColor" fill-rule="evenodd"/>`
    }</g>
  ${textSvg(WORDMARK_TEXT, { scale: wmScale, x: textLeft, y: textTop, tracking: WORDMARK_TRACKING })}
  ${tagline
      ? textSvg(TAGLINE_TEXT, {
          scale: tagScale,
          x: vertical ? (w - tagW) / 2 : textLeft + (wmW - tagW) / 2,
          y: textTop + capH + tagGap,
          tracking: TAGLINE_TRACKING,
        })
      : ''}`
  );
}

/* ------------------------------------------------------------------ */
/* App icon                                                            */
/* ------------------------------------------------------------------ */

function iconSvg({ size = 1024, maskable = false } = {}) {
  const lakeBox = size * (maskable ? 0.54 : 0.72);
  const off = (size - lakeBox) / 2;
  const { defs, body } = glassLakeLayers(lakeBox, { idp: 'ic' });
  const shape = maskable ? `M0,0H${size}V${size}H0Z` : squircle(size);
  return svg(
    `viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" fill="none" role="img" aria-label="LAKE"`,
    `  <title>LAKE</title>
  <defs>
    ${defs}
    <linearGradient id="bg" x1="0.1" y1="0" x2="0.75" y2="1">
      <stop offset="0" stop-color="#101B27"/>
      <stop offset="0.45" stop-color="${BRAND.abyss}"/>
      <stop offset="1" stop-color="${BRAND.ink}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.36" cy="0.34" r="0.62">
      <stop offset="0" stop-color="${BRAND.bright}" stop-opacity="0.30"/>
      <stop offset="0.6" stop-color="${BRAND.deep}" stop-opacity="0.14"/>
      <stop offset="1" stop-color="${BRAND.ink}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="edge" x1="0.15" y1="0" x2="0.85" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/>
      <stop offset="0.5" stop-color="${BRAND.bright}" stop-opacity="0.10"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0.05"/>
    </linearGradient>
    <clipPath id="shape"><path d="${shape}"/></clipPath>
  </defs>
  <path d="${shape}" fill="url(#bg)"/>
  <g clip-path="url(#shape)">
    <rect width="${size}" height="${size}" fill="url(#glow)"/>
    <g transform="translate(${off.toFixed(1)} ${off.toFixed(1)})">${body}</g>
  </g>
  ${maskable ? '' : `<path d="${shape}" fill="none" stroke="url(#edge)" stroke-width="${(size * 0.006).toFixed(2)}"/>`}`
  );
}

/* ------------------------------------------------------------------ */

const files = [];
const png = async (svgStr, path, size) => {
  const buf = await sharp(Buffer.from(svgStr), { density: 500 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(out(path), buf);
  files.push(`${path} (${(buf.length / 1024).toFixed(1)} kB)`);
};
const text = async (content, path) => {
  await writeFile(out(path), content);
  files.push(path);
};

async function main() {
  await mkdir(out('public/branding'), { recursive: true });
  await mkdir(out('public/icons'), { recursive: true });
  await mkdir(out('src/data'), { recursive: true });

  await text(isotipoSvg(), 'public/branding/logo-lake.svg');
  await text(isotipoGlassSvg(), 'public/branding/logo-lake-glass.svg');
  await text(wordmarkSvg(), 'public/branding/logo-lake-wordmark.svg');
  await text(lockupSvg({}), 'public/branding/logo-lake-lockup.svg');
  await text(lockupSvg({ vertical: true }), 'public/branding/logo-lake-lockup-vertical.svg');
  await text(lockupSvg({ glass: true }), 'public/branding/logo-lake-lockup-glass.svg');

  const icon = iconSvg({ size: 1024 });
  const iconMaskable = iconSvg({ size: 1024, maskable: true });
  await text(icon, 'public/branding/icon-lake.svg');
  await text(iconMaskable, 'public/branding/icon-lake-maskable.svg');

  for (const size of [64, 120, 152, 167, 180, 192, 256, 384, 512, 1024]) {
    await png(icon, `public/icons/icon-${size}.png`, size);
  }
  await png(iconMaskable, 'public/icons/icon-maskable-512.png', 512);
  await png(icon, 'public/apple-touch-icon.png', 180);
  await png(icon, 'public/favicon.png', 64);
  await text(icon, 'public/favicon.svg');

  // Paths + tipografía de marca reutilizables dentro de la app.
  const marca = lakePaths({ size: 100, pad: 3 });
  const loop = lakeLoopPath({ size: 100, pad: 5, offset: 2.4 });
  const art = lakePaths({ size: 1000, pad: 0 });
  const wm = textPaths(WORDMARK_TEXT, { tracking: WORDMARK_TRACKING, x: STROKE / 2, y: STROKE / 2 });
  const tag = textPaths(TAGLINE_TEXT, { tracking: TAGLINE_TRACKING, x: STROKE / 2, y: STROKE / 2 });

  await text(
    `/* Generado por scripts/generate-branding.mjs — no editar a mano. */\n` +
      `/* Silueta simplificada del Lago Municipal de Colón + logotipo LAKE. */\n\n` +
      `export const LAKE_VIEWBOX = '0 0 100 100';\n` +
      `export const LAKE_OUTLINE_D = ${JSON.stringify(marca.outline)};\n` +
      `export const LAKE_ISLAND_D = ${JSON.stringify(marca.island)};\n` +
      `export const LAKE_MARK_D = LAKE_OUTLINE_D + LAKE_ISLAND_D;\n` +
      `export const LAKE_LOOP_D = ${JSON.stringify(loop)};\n` +
      `export const LAKE_ART_VIEWBOX = '0 0 1000 1000';\n` +
      `export const LAKE_ART_MARK_D = ${JSON.stringify(art.outline + art.island)};\n\n` +
      `export const BRAND_STROKE = ${STROKE};\n` +
      `export const WORDMARK_VIEWBOX = '0 0 ${fx(WORDMARK_WIDTH + STROKE)} ${fx(CAP_HEIGHT + STROKE)}';\n` +
      `export const WORDMARK_D = ${JSON.stringify(wm.d)};\n` +
      `export const TAGLINE_VIEWBOX = '0 0 ${fx(TAGLINE_WIDTH + STROKE)} ${fx(CAP_HEIGHT + STROKE)}';\n` +
      `export const TAGLINE_D = ${JSON.stringify(tag.d)};\n` +
      `export const TAGLINE_DOT_D = ${JSON.stringify(tag.squareD)};\n\n` +
      `export const BRAND_COLORS = ${JSON.stringify(BRAND, null, 2)} as const;\n`,
    'src/data/lakePath.generated.ts'
  );

  console.log('LAKE branding generado:');
  for (const f of files) console.log('  ·', f);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
