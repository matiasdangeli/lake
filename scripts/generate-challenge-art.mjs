/**
 * ChallengeArtworkGenerator (build time).
 *
 *   node scripts/generate-challenge-art.mjs [--svg]
 *
 * Compone 36 portadas 4:5 originales por código (SVG determinístico + grano
 * real aplicado con sharp) y las escribe como WebP en public/challenges/.
 * También emite src/data/challengeArtwork.generated.ts con el índice, el
 * color dominante de cada pieza y un LQIP para el fade-in.
 *
 * Nada de texto horneado en la imagen: el nombre lo pone la UI encima.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { CHALLENGE_CATALOG, PALETTES, artworkId } from './challenge-catalog.mjs';
import { lakePaths, lakeLoopPath } from './lake-shape.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = (...p) => resolve(root, ...p);
const WRITE_SVG = process.argv.includes('--svg');

const W = 1080;
const H = 1350;

/* ------------------------------------------------------------------ */
/* utilidades                                                          */
/* ------------------------------------------------------------------ */

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const n = (v) => Number(v.toFixed(2));
const R = (rng, a, b) => a + rng() * (b - a);
const RI = (rng, a, b) => Math.floor(R(rng, a, b + 1));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

/** Builder mínimo de SVG: acumula defs y capas. */
function scene() {
  const defs = [];
  const body = [];
  let seq = 0;
  return {
    defs, body,
    id: (p) => `${p}${++seq}`,
    def(s) { defs.push(s); return this; },
    add(s) { body.push(s); return this; },
    render() {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>${defs.join('')}</defs>
${body.join('\n')}
</svg>`;
    },
  };
}

/* ------------------------------------------------------------------ */
/* capas reutilizables                                                 */
/* ------------------------------------------------------------------ */

function linear(s, stops, { x1 = 0, y1 = 0, x2 = 0, y2 = 1 } = {}) {
  const id = s.id('lg');
  s.def(`<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops
    .map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`)
    .join('')}</linearGradient>`);
  return id;
}

function radial(s, stops, { cx = 0.5, cy = 0.5, r = 0.5 } = {}) {
  const id = s.id('rg');
  s.def(`<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops
    .map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`)
    .join('')}</radialGradient>`);
  return id;
}

function blur(s, std) {
  const id = s.id('bl');
  s.def(`<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${std}"/></filter>`);
  return id;
}

/** Cielo: degradado vertical con el horizonte más claro. */
function sky(s, p, hy, { warmth = 0 } = {}) {
  const g = linear(s, [
    [0, p.a],
    [0.45, p.b],
    [1, warmth ? p.glow : p.c],
  ], { y2: hy / H });
  s.add(`<rect width="${W}" height="${n(hy)}" fill="url(#${g})"/>`);
}

/** Agua: se oscurece hacia el borde inferior. */
function water(s, p, hy, { mirror = 0.55 } = {}) {
  const g = linear(s, [
    [0, p.c],
    [mirror, p.b],
    [1, p.ink],
  ], { y1: hy / H, y2: 1 });
  s.add(`<rect y="${n(hy)}" width="${W}" height="${n(H - hy)}" fill="url(#${g})"/>`);
}

/** Neblina/atmósfera: elipses grandes y muy difuminadas. */
function atmosphere(s, p, rng, { count = 5, color = null, opacity = 0.18, band = [0.15, 0.75] } = {}) {
  const f = blur(s, 90);
  const c = color ?? p.light;
  let g = `<g filter="url(#${f})" opacity="${opacity}">`;
  for (let i = 0; i < count; i++) {
    g += `<ellipse cx="${n(R(rng, -100, W + 100))}" cy="${n(R(rng, H * band[0], H * band[1]))}" rx="${n(R(rng, 220, 520))}" ry="${n(R(rng, 40, 130))}" fill="${c}"/>`;
  }
  s.add(g + '</g>');
}

/** Disco luminoso (sol / luna / faro) con halo. */
function disc(s, { cx, cy, r, color, glow = 3.2, core = 1 }) {
  const halo = radial(s, [[0, color, 0.55], [0.35, color, 0.2], [1, color, 0]]);
  s.add(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * glow)}" fill="url(#${halo})"/>`);
  if (core > 0) {
    const body = radial(s, [[0, '#ffffff', 0.95 * core], [0.55, color, 0.9 * core], [1, color, 0]]);
    s.add(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="url(#${body})"/>`);
  }
}

/** Columna de reflejo sobre el agua. */
function reflectionColumn(s, rng, { cx, hy, color, width = 150, opacity = 0.5 }) {
  const f = blur(s, 3);
  let g = `<g filter="url(#${f})" opacity="${opacity}">`;
  let y = hy + 6;
  while (y < H) {
    const t = (y - hy) / (H - hy);
    const w = width * (0.35 + t * 1.5) * R(rng, 0.6, 1.15);
    const h = R(rng, 2, 5 + t * 9);
    const o = (1 - t * 0.85) * R(rng, 0.35, 1);
    g += `<rect x="${n(cx - w / 2 + R(rng, -w * 0.2, w * 0.2))}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(h / 2)}" fill="${color}" opacity="${n(o)}"/>`;
    y += h + R(rng, 6, 20 + t * 40);
  }
  s.add(g + '</g>');
}

/** Estrías horizontales de agua. */
function waterStreaks(s, rng, { hy, color, count = 60, opacity = 0.22 }) {
  let g = `<g opacity="${opacity}">`;
  for (let i = 0; i < count; i++) {
    const t = rng() ** 1.6;
    const y = hy + t * (H - hy);
    const w = R(rng, 60, 420) * (0.5 + t);
    const x = R(rng, -60, W - 40);
    const h = 1 + t * 3;
    g += `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(h / 2)}" fill="${color}" opacity="${n(R(rng, 0.15, 0.8) * (1 - t * 0.6))}"/>`;
  }
  s.add(g + '</g>');
}

/** Línea de árboles lejana. */
function treeline(s, rng, { hy, color, height = 46, opacity = 1 }) {
  let d = `M0,${n(hy + 2)}`;
  let x = 0;
  while (x < W) {
    const w = R(rng, 26, 80);
    const h = R(rng, height * 0.35, height);
    d += `Q${n(x + w / 2)},${n(hy - h)} ${n(x + w)},${n(hy - R(rng, 0, h * 0.35))}`;
    x += w;
  }
  d += `L${W},${n(hy + 2)}Z`;
  s.add(`<path d="${d}" fill="${color}" opacity="${opacity}"/>`);
}

/** Juncos en primer plano. */
function reeds(s, rng, { baseY = H + 20, color, count = 26, height = 420, opacity = 1, xRange = [-40, W + 40] }) {
  let g = `<g opacity="${opacity}" fill="none" stroke="${color}" stroke-linecap="round">`;
  for (let i = 0; i < count; i++) {
    const x = R(rng, xRange[0], xRange[1]);
    const h = R(rng, height * 0.45, height);
    const bend = R(rng, -70, 70);
    const w = R(rng, 2.5, 7);
    g += `<path d="M${n(x)},${n(baseY)} C${n(x + bend * 0.2)},${n(baseY - h * 0.5)} ${n(x + bend * 0.7)},${n(baseY - h * 0.8)} ${n(x + bend)},${n(baseY - h)}" stroke-width="${n(w)}"/>`;
    if (rng() > 0.55) {
      g += `<path d="M${n(x + bend)},${n(baseY - h)} l${n(bend > 0 ? 26 : -26)},${n(-R(rng, 18, 42))}" stroke-width="${n(w * 0.8)}"/>`;
    }
  }
  s.add(g + '</g>');
}

/** Bicicleta de perfil, dibujo propio, en un cuadro 100x62. */
function bike(s, { x, y, size, color, opacity = 1, stroke = 2.6 }) {
  const k = size / 100;
  const sw = n(stroke / k);
  const g = `<g transform="translate(${n(x)} ${n(y)}) scale(${n(k)})" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}">
  <circle cx="18" cy="42" r="16"/>
  <circle cx="82" cy="42" r="16"/>
  <path d="M18 42 L50 44 L42 20 L18 42"/>
  <path d="M42 20 L66 20 L50 44"/>
  <path d="M66 20 L82 42"/>
  <path d="M62 17 L74 15"/>
  <path d="M36 18 L48 18"/>
  <path d="M50 44 L54 52"/>
</g>`;
  s.add(g);
}

/** Curva de asfalto en perspectiva. */
function road(s, p, rng, { hy, bend = 0, topWidth = 40, bottomWidth = 1500 }) {
  const vx = W / 2 + bend;
  const g = linear(s, [[0, p.b], [0.45, p.a], [1, p.ink]], { y1: hy / H, y2: 1 });
  const d = `M${n(vx - topWidth / 2)},${n(hy)} C${n(vx - topWidth)},${n(hy + 280)} ${n(vx - bottomWidth * 0.22 - bend)},${n(H - 320)} ${n(vx - bottomWidth / 2 - bend * 2)},${H}
    L${n(vx + bottomWidth / 2 - bend * 2)},${H} C${n(vx + bottomWidth * 0.22 - bend)},${n(H - 320)} ${n(vx + topWidth)},${n(hy + 280)} ${n(vx + topWidth / 2)},${n(hy)} Z`;
  s.add(`<path d="${d}" fill="url(#${g})"/>`);
  return { vx, d };
}

/** Silueta del lago como motivo gráfico. */
function lakeGlyph(s, { cx, cy, size, fill, opacity = 1, strokeOnly = false, strokeWidth = 6, dash = null }) {
  const { outline, island } = lakePaths({ size, pad: 0 });
  const t = `translate(${n(cx - size / 2)} ${n(cy - size / 2)})`;
  if (strokeOnly) {
    s.add(`<g transform="${t}" opacity="${opacity}"><path d="${outline}${island}" fill="none" fill-rule="evenodd" stroke="${fill}" stroke-width="${strokeWidth}"${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-linejoin="round"/></g>`);
  } else {
    s.add(`<g transform="${t}" opacity="${opacity}"><path d="${outline}${island}" fill="${fill}" fill-rule="evenodd"/></g>`);
  }
}

function lakeLoop(s, { cx, cy, size, color, opacity = 1, strokeWidth = 5, dash = null }) {
  const d = lakeLoopPath({ size, pad: 0, offset: size * 0.02 });
  s.add(`<g transform="translate(${n(cx - size / 2)} ${n(cy - size / 2)})" opacity="${opacity}"><path d="${d}" fill="none" stroke="${color}" stroke-width="${strokeWidth}"${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-linejoin="round"/></g>`);
}

function vignette(s, { strength = 0.55, ink = '#000' } = {}) {
  const g = radial(s, [[0.45, ink, 0], [0.8, ink, strength * 0.5], [1, ink, strength]], { cx: 0.5, cy: 0.46, r: 0.78 });
  s.add(`<rect width="${W}" height="${H}" fill="url(#${g})"/>`);
}

/** Oscurecido inferior para que el texto de la UI se lea siempre. */
function readabilityScrim(s, p) {
  const g = linear(s, [[0, p.ink, 0], [0.55, p.ink, 0.12], [1, p.ink, 0.62]], { y1: 0.35, y2: 1 });
  s.add(`<rect width="${W}" height="${H}" fill="url(#${g})"/>`);
}

/* ------------------------------------------------------------------ */
/* motivos                                                             */
/* ------------------------------------------------------------------ */

const MOTIFS = {
  fog(s, p, rng) {
    const hy = H * 0.56;
    sky(s, p, hy);
    water(s, p, hy);
    disc(s, { cx: W * 0.68, cy: hy - 120, r: 70, color: p.light, glow: 3.4, core: 0.55 });
    treeline(s, rng, { hy, color: p.ink, height: 42, opacity: 0.66 });
    atmosphere(s, p, rng, { count: 6, opacity: 0.2, band: [0.42, 0.7] });
    waterStreaks(s, rng, { hy, color: p.light, count: 44, opacity: 0.18 });
    bike(s, { x: 110, y: H * 0.66, size: 300, color: '#000', opacity: 0.8, stroke: 3.4 });
    atmosphere(s, p, rng, { count: 3, opacity: 0.16, band: [0.62, 0.9] });
    vignette(s, { strength: 0.5 });
  },

  beacon(s, p, rng) {
    const hy = H * 0.52;
    sky(s, p, hy);
    water(s, p, hy);
    const cx = W * 0.68;
    treeline(s, rng, { hy, color: '#000', height: 28, opacity: 0.75 });
    disc(s, { cx, cy: hy - 26, r: 12, color: p.glow, glow: 7 });
    const cone = linear(s, [[0, p.glow, 0.32], [1, p.glow, 0]], { y1: 0, y2: 1 });
    s.add(`<path d="M${n(cx)},${n(hy - 26)} L${n(cx - 420)},${H} L${n(cx + 330)},${H} Z" fill="url(#${cone})" opacity="0.5"/>`);
    reflectionColumn(s, rng, { cx, hy, color: p.light, width: 90, opacity: 0.55 });
    vignette(s, { strength: 0.7 });
  },

  shore(s, p, rng) {
    const hy = H * 0.44;
    sky(s, p, hy, { warmth: 1 });
    water(s, p, hy);
    disc(s, { cx: W * 0.3, cy: hy - 60, r: 46, color: p.glow, glow: 5 });
    treeline(s, rng, { hy, color: p.ink, height: 40, opacity: 0.8 });
    reflectionColumn(s, rng, { cx: W * 0.3, hy, color: p.light, width: 130, opacity: 0.4 });
    const shoreG = linear(s, [[0, p.ink, 0.9], [1, p.ink, 1]], { y2: 1 });
    s.add(`<path d="M0,${n(H * 0.78)} C${n(W * 0.3)},${n(H * 0.68)} ${n(W * 0.62)},${n(H * 0.86)} ${W},${n(H * 0.74)} L${W},${H} L0,${H} Z" fill="url(#${shoreG})"/>`);
    reeds(s, rng, { baseY: H * 0.84, color: p.ink, count: 18, height: 260, xRange: [W * 0.55, W + 40] });
  },

  pulse(s, p, rng) {
    s.add(`<rect width="${W}" height="${H}" fill="${p.a}"/>`);
    const bands = 14;
    for (let i = 0; i < bands; i++) {
      const y = (i / bands) * H;
      const h = H / bands;
      const o = 0.05 + Math.abs(Math.sin(i * 1.1)) * 0.22;
      s.add(`<rect y="${n(y)}" width="${W}" height="${n(h + 1)}" fill="${p.c}" opacity="${n(o)}"/>`);
    }
    const mid = H * 0.52;
    let d = `M0,${n(mid)}`;
    let x = 0;
    while (x < W) {
      const step = R(rng, 40, 130);
      const jag = rng() > 0.7 ? R(rng, -140, 140) : R(rng, -14, 14);
      d += `L${n(x + step)},${n(mid + jag)}`;
      x += step;
    }
    const f = blur(s, 12);
    s.add(`<path d="${d}" fill="none" stroke="${p.glow}" stroke-width="10" opacity="0.35" filter="url(#${f})"/>`);
    s.add(`<path d="${d}" fill="none" stroke="${p.light}" stroke-width="3.2" opacity="0.9" stroke-linejoin="round"/>`);
    vignette(s, { strength: 0.6 });
  },

  drift(s, p, rng) {
    const hy = H * 0.34;
    sky(s, p, hy);
    water(s, p, hy);
    const cx = W * 0.42, cy = H * 0.68;
    for (let i = 1; i <= 11; i++) {
      const rx = i * 62 * R(rng, 0.92, 1.08);
      s.add(`<ellipse cx="${n(cx + i * R(rng, -6, 10))}" cy="${n(cy + i * 9)}" rx="${n(rx)}" ry="${n(rx * 0.19)}" fill="none" stroke="${p.light}" stroke-width="${n(2.6 - i * 0.14)}" opacity="${n(0.5 - i * 0.035)}"/>`);
    }
    waterStreaks(s, rng, { hy, color: p.glow, count: 26, opacity: 0.12 });
    vignette(s, { strength: 0.5 });
  },

  north(s, p, rng) {
    const hy = H * 0.7;
    sky(s, p, hy);
    water(s, p, hy);
    atmosphere(s, p, rng, { count: 3, opacity: 0.14, band: [0.5, 0.68] });
    s.add(`<rect x="${n(W * 0.5 - 1)}" y="${n(H * 0.16)}" width="2" height="${n(H * 0.5)}" fill="${p.light}" opacity="0.28"/>`);
    s.add(`<circle cx="${n(W * 0.5)}" cy="${n(H * 0.16)}" r="5" fill="${p.light}" opacity="0.7"/>`);
    treeline(s, rng, { hy, color: p.ink, height: 16, opacity: 0.6 });
    waterStreaks(s, rng, { hy, color: p.light, count: 24, opacity: 0.16 });
    vignette(s, { strength: 0.45 });
  },

  line(s, p, rng) {
    const hy = H * 0.3;
    sky(s, p, hy);
    s.add(`<rect y="${n(hy)}" width="${W}" height="${n(H - hy)}" fill="${p.a}"/>`);
    road(s, p, rng, { hy, bend: 0, topWidth: 34, bottomWidth: 1700 });
    let y = hy + 14;
    let i = 0;
    while (y < H) {
      const t = (y - hy) / (H - hy);
      const w = 4 + t * 44;
      const h = 10 + t * 140;
      s.add(`<rect x="${n(W / 2 - w / 2)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${p.light}" opacity="${n(0.25 + t * 0.5)}"/>`);
      y += h * 1.9;
      i++;
    }
    atmosphere(s, p, rng, { count: 3, opacity: 0.16, band: [0.2, 0.34] });
    vignette(s, { strength: 0.62 });
  },

  dew(s, p, rng) {
    const hy = H * 0.3;
    sky(s, p, hy);
    s.add(`<rect y="${n(hy - 2)}" width="${W}" height="${n(H - hy + 2)}" fill="${p.a}"/>`);
    reeds(s, rng, { baseY: H + 30, color: p.b, count: 34, height: 900, opacity: 0.9 });
    const f = blur(s, 9);
    let g = `<g filter="url(#${f})">`;
    for (let i = 0; i < 60; i++) {
      const r = R(rng, 4, 22);
      g += `<circle cx="${n(R(rng, 0, W))}" cy="${n(R(rng, H * 0.25, H))}" r="${n(r)}" fill="${p.light}" opacity="${n(R(rng, 0.12, 0.5))}"/>`;
    }
    s.add(g + '</g>');
    for (let i = 0; i < 40; i++) {
      s.add(`<circle cx="${n(R(rng, 0, W))}" cy="${n(R(rng, H * 0.3, H))}" r="${n(R(rng, 1.5, 4))}" fill="${p.light}" opacity="${n(R(rng, 0.4, 0.9))}"/>`);
    }
    vignette(s, { strength: 0.55 });
  },

  tide(s, p, rng) {
    s.add(`<rect width="${W}" height="${H}" fill="${p.a}"/>`);
    let y = H * 0.12;
    while (y < H) {
      const h = R(rng, 18, 90);
      const o = R(rng, 0.06, 0.3);
      const col = rng() > 0.7 ? p.glow : p.c;
      s.add(`<rect y="${n(y)}" width="${W}" height="${n(h)}" fill="${col}" opacity="${n(o)}"/>`);
      y += h + R(rng, 4, 26);
    }
    const f = blur(s, 40);
    s.add(`<rect width="${W}" height="${H}" fill="url(#${linear(s, [[0, p.light, 0.22], [0.5, p.light, 0], [1, p.ink, 0.35]], { y2: 1 })})" filter="url(#${f})"/>`);
    vignette(s, { strength: 0.5 });
  },

  echo(s, p, rng) {
    const hy = H * 0.26;
    sky(s, p, hy);
    water(s, p, hy);
    const cx = W * 0.5, cy = H * 0.64;
    for (let i = 1; i <= 14; i++) {
      const rx = i * 52;
      s.add(`<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(rx * 0.3)}" fill="none" stroke="${p.glow}" stroke-width="${n(Math.max(0.6, 3 - i * 0.16))}" opacity="${n(Math.max(0.04, 0.55 - i * 0.037))}"/>`);
    }
    s.add(`<circle cx="${n(cx)}" cy="${n(cy)}" r="4" fill="${p.light}" opacity="0.8"/>`);
    vignette(s, { strength: 0.62 });
  },

  mist(s, p, rng) {
    const hy = H * 0.6;
    sky(s, p, hy);
    water(s, p, hy);
    // Tres planos de árboles cada vez más tenues: la niebla necesita profundidad
    // para leerse como niebla y no como un gris plano.
    treeline(s, rng, { hy: hy - 70, color: p.ink, height: 88, opacity: 0.2 });
    atmosphere(s, p, rng, { count: 4, opacity: 0.26, band: [0.4, 0.56] });
    treeline(s, rng, { hy: hy - 22, color: p.ink, height: 66, opacity: 0.38 });
    atmosphere(s, p, rng, { count: 4, opacity: 0.24, band: [0.5, 0.68] });
    treeline(s, rng, { hy, color: p.ink, height: 46, opacity: 0.7 });
    waterStreaks(s, rng, { hy, color: p.light, count: 34, opacity: 0.16 });
    reeds(s, rng, { baseY: H + 20, color: '#000', count: 12, height: 340, opacity: 0.75, xRange: [W * 0.6, W + 40] });
    atmosphere(s, p, rng, { count: 4, opacity: 0.2, band: [0.72, 1] });
    vignette(s, { strength: 0.52 });
  },

  vertex(s, p, rng) {
    const hy = H * 0.36;
    sky(s, p, hy);
    s.add(`<rect y="${n(hy)}" width="${W}" height="${n(H - hy)}" fill="${p.a}"/>`);
    road(s, p, rng, { hy, bend: -180, topWidth: 30, bottomWidth: 1900 });
    s.add(`<path d="M${n(W * 0.5 - 180)},${n(hy)} C${n(W * 0.2)},${n(H * 0.6)} ${n(W * 0.1)},${n(H * 0.8)} ${n(-40)},${n(H * 0.95)}" fill="none" stroke="${p.light}" stroke-width="6" opacity="0.35"/>`);
    treeline(s, rng, { hy: hy + 4, color: p.ink, height: 30, opacity: 0.85 });
    atmosphere(s, p, rng, { count: 3, opacity: 0.14, band: [0.26, 0.4] });
    vignette(s, { strength: 0.6 });
  },

  lowsun(s, p, rng) {
    const hy = H * 0.6;
    sky(s, p, hy, { warmth: 1 });
    water(s, p, hy);
    disc(s, { cx: W * 0.52, cy: hy - 8, r: 96, color: p.glow, glow: 4.4 });
    treeline(s, rng, { hy, color: p.ink, height: 26, opacity: 0.9 });
    reflectionColumn(s, rng, { cx: W * 0.52, hy, color: p.light, width: 200, opacity: 0.6 });
    atmosphere(s, p, rng, { count: 4, color: p.glow, opacity: 0.14, band: [0.32, 0.55] });
    vignette(s, { strength: 0.5 });
  },

  static(s, p, rng) {
    s.add(`<rect width="${W}" height="${H}" fill="${p.a}"/>`);
    for (let i = 0; i < 240; i++) {
      const y = R(rng, 0, H);
      s.add(`<rect x="${n(R(rng, -100, W))}" y="${n(y)}" width="${n(R(rng, 40, 700))}" height="${n(R(rng, 1, 5))}" fill="${rng() > 0.6 ? p.glow : p.c}" opacity="${n(R(rng, 0.05, 0.35))}"/>`);
    }
    const hy = H * 0.55;
    s.add(`<rect y="${n(hy)}" width="${W}" height="2" fill="${p.light}" opacity="0.35"/>`);
    const f = blur(s, 26);
    s.add(`<rect width="${W}" height="${H}" fill="url(#${radial(s, [[0, p.light, 0.16], [1, p.ink, 0.5]])})" filter="url(#${f})"/>`);
  },

  calm(s, p, rng) {
    const hy = H * 0.5;
    sky(s, p, hy);
    const g = linear(s, [[0, p.c], [0.55, p.b], [1, p.a]], { y1: hy / H, y2: 1 });
    s.add(`<rect y="${n(hy)}" width="${W}" height="${n(H - hy)}" fill="url(#${g})"/>`);
    atmosphere(s, p, rng, { count: 3, opacity: 0.15, band: [0.3, 0.46] });
    s.add(`<rect y="${n(hy - 1)}" width="${W}" height="2" fill="${p.light}" opacity="0.5"/>`);
    waterStreaks(s, rng, { hy, color: p.light, count: 14, opacity: 0.1 });
    vignette(s, { strength: 0.42 });
  },

  wind(s, p, rng) {
    const hy = H * 0.46;
    sky(s, p, hy);
    water(s, p, hy);
    let g = `<g stroke-linecap="round" fill="none">`;
    for (let i = 0; i < 70; i++) {
      const x = R(rng, -300, W);
      const y = R(rng, 0, H);
      const len = R(rng, 160, 620);
      g += `<path d="M${n(x)},${n(y)} q${n(len * 0.5)},${n(R(rng, -30, 10))} ${n(len)},${n(R(rng, -60, -6))}" stroke="${rng() > 0.5 ? p.light : p.glow}" stroke-width="${n(R(rng, 0.8, 2.6))}" opacity="${n(R(rng, 0.06, 0.35))}"/>`;
    }
    s.add(g + '</g>');
    reeds(s, rng, { baseY: H + 20, color: p.ink, count: 16, height: 420, opacity: 0.85, xRange: [-40, W * 0.5] });
    vignette(s, { strength: 0.55 });
  },

  longshadow(s, p, rng) {
    const hy = H * 0.3;
    sky(s, p, hy, { warmth: 1 });
    const g = linear(s, [[0, p.b], [0.5, p.a], [1, p.ink]], { y1: hy / H, y2: 1 });
    s.add(`<rect y="${n(hy)}" width="${W}" height="${n(H - hy)}" fill="url(#${g})"/>`);
    disc(s, { cx: W * 0.78, cy: hy - 40, r: 60, color: p.glow, glow: 4 });
    const f = blur(s, 18);
    s.add(`<g filter="url(#${f})" opacity="0.5"><path d="M${n(W * 0.62)},${n(H * 0.58)} L${n(-120)},${n(H * 0.96)} L${n(-40)},${H} L${n(W * 0.7)},${n(H * 0.62)} Z" fill="${p.ink}"/></g>`);
    bike(s, { x: W * 0.42, y: H * 0.46, size: 300, color: p.ink, opacity: 0.92, stroke: 3.4 });
    atmosphere(s, p, rng, { count: 3, color: p.glow, opacity: 0.12, band: [0.22, 0.34] });
    vignette(s, { strength: 0.58 });
  },

  spokes(s, p, rng) {
    s.add(`<rect width="${W}" height="${H}" fill="url(#${linear(s, [[0, p.b], [1, p.ink]], { y2: 1 })})"/>`);
    const cx = W * 0.52, cy = H * 0.52, r = W * 0.62;
    let g = `<g stroke="${p.light}" stroke-linecap="round" fill="none">`;
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2 + 0.12;
      g += `<path d="M${n(cx + Math.cos(a) * 22)},${n(cy + Math.sin(a) * 22)} L${n(cx + Math.cos(a) * r)},${n(cy + Math.sin(a) * r)}" stroke-width="${n(R(rng, 1.4, 3.2))}" opacity="${n(R(rng, 0.14, 0.5))}"/>`;
    }
    s.add(g + '</g>');
    s.add(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="none" stroke="${p.light}" stroke-width="10" opacity="0.55"/>`);
    s.add(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r - 22)}" fill="none" stroke="${p.glow}" stroke-width="3" opacity="0.3"/>`);
    s.add(`<circle cx="${n(cx)}" cy="${n(cy)}" r="26" fill="${p.light}" opacity="0.7"/>`);
    vignette(s, { strength: 0.7 });
  },

  zero(s, p, rng) {
    const hy = H * 0.66;
    sky(s, p, hy);
    water(s, p, hy);
    atmosphere(s, p, rng, { count: 3, opacity: 0.12, band: [0.5, 0.64] });
    bike(s, { x: W * 0.62, y: hy - 44, size: 84, color: p.ink, opacity: 0.65, stroke: 2 });
    s.add(`<rect y="${n(hy - 1)}" width="${W}" height="1.5" fill="${p.light}" opacity="0.3"/>`);
    waterStreaks(s, rng, { hy, color: p.light, count: 12, opacity: 0.1 });
    vignette(s, { strength: 0.4 });
  },

  stroke(s, p, rng) {
    s.add(`<rect width="${W}" height="${H}" fill="url(#${linear(s, [[0, p.b], [1, p.ink]], { y2: 1 })})"/>`);
    atmosphere(s, p, rng, { count: 4, opacity: 0.12, band: [0.2, 0.8] });
    const f = blur(s, 22);
    lakeGlyph(s, { cx: W * 0.5, cy: H * 0.5, size: W * 1.05, fill: p.glow, opacity: 0.18 });
    s.add(`<g filter="url(#${f})" opacity="0.5"></g>`);
    lakeGlyph(s, { cx: W * 0.5, cy: H * 0.5, size: W * 1.05, fill: p.light, opacity: 0.85, strokeOnly: true, strokeWidth: 3 });
    vignette(s, { strength: 0.65 });
  },

  loop(s, p, rng) {
    s.add(`<rect width="${W}" height="${H}" fill="url(#${linear(s, [[0, p.a], [0.6, p.b], [1, p.ink]], { y2: 1 })})"/>`);
    atmosphere(s, p, rng, { count: 4, opacity: 0.16, band: [0.25, 0.8] });
    const f = blur(s, 34);
    s.add(`<g filter="url(#${f})" opacity="0.55">`);
    lakeGlyph(s, { cx: W * 0.5, cy: H * 0.48, size: W * 0.92, fill: p.glow, opacity: 0.6 });
    s.add(`</g>`);
    lakeGlyph(s, { cx: W * 0.5, cy: H * 0.48, size: W * 0.92, fill: `url(#${linear(s, [[0, p.light], [1, p.glow]], { x2: 1, y2: 1 })})`, opacity: 0.96 });
    vignette(s, { strength: 0.6 });
  },

  edge(s, p, rng) {
    s.add(`<rect width="${W}" height="${H}" fill="url(#${linear(s, [[0, p.a], [1, p.ink]], { y2: 1 })})"/>`);
    atmosphere(s, p, rng, { count: 3, opacity: 0.12, band: [0.3, 0.7] });
    lakeLoop(s, { cx: W * 0.5, cy: H * 0.47, size: W * 0.96, color: p.glow, opacity: 0.5, strokeWidth: 14 });
    lakeGlyph(s, { cx: W * 0.5, cy: H * 0.47, size: W * 0.9, fill: p.light, opacity: 0.75, strokeOnly: true, strokeWidth: 2.5 });
    vignette(s, { strength: 0.62 });
  },

  rain(s, p, rng) {
    const hy = H * 0.42;
    sky(s, p, hy);
    water(s, p, hy);
    treeline(s, rng, { hy, color: p.ink, height: 30, opacity: 0.6 });
    let g = `<g stroke-linecap="round">`;
    for (let i = 0; i < 260; i++) {
      const x = R(rng, -120, W + 40);
      const y = R(rng, -80, H);
      const len = R(rng, 30, 130);
      g += `<line x1="${n(x)}" y1="${n(y)}" x2="${n(x + len * 0.22)}" y2="${n(y + len)}" stroke="${p.light}" stroke-width="${n(R(rng, 0.7, 2))}" opacity="${n(R(rng, 0.08, 0.4))}"/>`;
    }
    s.add(g + '</g>');
    for (let i = 0; i < 34; i++) {
      const t = rng() ** 1.4;
      const y = hy + t * (H - hy);
      const r = 8 + t * 46;
      s.add(`<ellipse cx="${n(R(rng, 0, W))}" cy="${n(y)}" rx="${n(r)}" ry="${n(r * 0.3)}" fill="none" stroke="${p.light}" stroke-width="1.4" opacity="${n(R(rng, 0.1, 0.35))}"/>`);
    }
    vignette(s, { strength: 0.55 });
  },

  dawn(s, p, rng) {
    const hy = H * 0.62;
    sky(s, p, hy, { warmth: 1 });
    water(s, p, hy);
    disc(s, { cx: W * 0.4, cy: hy - 130, r: 54, color: p.glow, glow: 6, core: 0.9 });
    for (let i = 0; i < 9; i++) {
      const y = R(rng, H * 0.12, hy - 40);
      s.add(`<rect x="${n(R(rng, -100, W * 0.4))}" y="${n(y)}" width="${n(R(rng, 260, 780))}" height="${n(R(rng, 4, 16))}" rx="8" fill="${p.light}" opacity="${n(R(rng, 0.08, 0.26))}"/>`);
    }
    treeline(s, rng, { hy, color: p.ink, height: 22, opacity: 0.85 });
    reflectionColumn(s, rng, { cx: W * 0.4, hy, color: p.glow, width: 150, opacity: 0.45 });
    vignette(s, { strength: 0.45 });
  },

  dusk(s, p, rng) {
    const hy = H * 0.58;
    sky(s, p, hy, { warmth: 1 });
    water(s, p, hy);
    const band = linear(s, [[0, p.glow, 0], [0.7, p.glow, 0.45], [1, p.glow, 0.75]], { y1: 0.3, y2: 1 });
    s.add(`<rect y="${n(H * 0.3)}" width="${W}" height="${n(hy - H * 0.3)}" fill="url(#${band})" opacity="0.5"/>`);
    treeline(s, rng, { hy, color: '#000', height: 52, opacity: 0.92 });
    waterStreaks(s, rng, { hy, color: p.glow, count: 44, opacity: 0.3 });
    atmosphere(s, p, rng, { count: 3, color: p.glow, opacity: 0.12, band: [0.35, 0.55] });
    vignette(s, { strength: 0.6 });
  },

  reeds(s, p, rng) {
    const hy = H * 0.34;
    sky(s, p, hy);
    water(s, p, hy, { mirror: 0.4 });
    waterStreaks(s, rng, { hy, color: p.light, count: 30, opacity: 0.16 });
    reeds(s, rng, { baseY: H + 30, color: p.ink, count: 46, height: 980, opacity: 0.95 });
    vignette(s, { strength: 0.5 });
  },

  wake(s, p, rng) {
    const hy = H * 0.3;
    sky(s, p, hy);
    water(s, p, hy);
    const apex = [W * 0.58, H * 0.42];
    for (let i = 0; i < 26; i++) {
      const t = i / 26;
      const spread = 40 + t * 900;
      const y = apex[1] + t * (H - apex[1]);
      s.add(`<path d="M${n(apex[0] - spread)},${n(y)} Q${n(apex[0])},${n(y - 22)} ${n(apex[0] + spread * 0.8)},${n(y)}" fill="none" stroke="${p.light}" stroke-width="${n(R(rng, 1, 3))}" opacity="${n((1 - t) * R(rng, 0.15, 0.45))}"/>`);
    }
    s.add(`<circle cx="${n(apex[0])}" cy="${n(apex[1])}" r="6" fill="${p.light}" opacity="0.6"/>`);
    vignette(s, { strength: 0.55 });
  },

  still(s, p, rng) {
    const hy = H * 0.48;
    sky(s, p, hy);
    water(s, p, hy, { mirror: 0.3 });
    for (let i = 0; i < 40; i++) {
      s.add(`<circle cx="${n(R(rng, 0, W))}" cy="${n(R(rng, 0, hy - 30))}" r="${n(R(rng, 0.8, 2.2))}" fill="${p.light}" opacity="${n(R(rng, 0.15, 0.7))}"/>`);
    }
    disc(s, { cx: W * 0.72, cy: H * 0.2, r: 5, color: p.light, glow: 9, core: 1 });
    treeline(s, rng, { hy, color: '#000', height: 22, opacity: 0.9 });
    reflectionColumn(s, rng, { cx: W * 0.72, hy, color: p.light, width: 40, opacity: 0.3 });
    vignette(s, { strength: 0.68 });
  },

  gravel(s, p, rng) {
    const hy = H * 0.24;
    sky(s, p, hy);
    s.add(`<rect y="${n(hy)}" width="${W}" height="${n(H - hy)}" fill="url(#${linear(s, [[0, p.b], [1, p.ink]], { y1: hy / H, y2: 1 })})"/>`);
    for (let i = 0; i < 900; i++) {
      const t = rng() ** 2;
      const y = hy + t * (H - hy);
      const r = 1 + t * 9;
      s.add(`<ellipse cx="${n(R(rng, -20, W + 20))}" cy="${n(y)}" rx="${n(r * R(rng, 0.7, 1.4))}" ry="${n(r * 0.7)}" fill="${rng() > 0.5 ? p.light : p.c}" opacity="${n(R(rng, 0.05, 0.4))}"/>`);
    }
    s.add(`<path d="M${n(W * 0.1)},${n(hy)} C${n(W * 0.3)},${n(H * 0.5)} ${n(W * 0.1)},${n(H * 0.8)} ${n(W * 0.28)},${H}" fill="none" stroke="${p.light}" stroke-width="4" opacity="0.18"/>`);
    vignette(s, { strength: 0.6 });
  },

  frost(s, p, rng) {
    s.add(`<rect width="${W}" height="${H}" fill="url(#${linear(s, [[0, p.c], [0.5, p.b], [1, p.a]], { y2: 1 })})"/>`);
    const cx = W * 0.5, cy = H * 0.44;
    let g = `<g stroke="${p.light}" fill="none" stroke-linecap="round">`;
    for (let i = 0; i < 60; i++) {
      const a = R(rng, 0, Math.PI * 2);
      const len = R(rng, 120, 640);
      const x2 = cx + Math.cos(a) * len, y2 = cy + Math.sin(a) * len;
      g += `<path d="M${n(cx)},${n(cy)} L${n(x2)},${n(y2)}" stroke-width="${n(R(rng, 0.5, 1.8))}" opacity="${n(R(rng, 0.06, 0.28))}"/>`;
      const bx = cx + Math.cos(a) * len * 0.6, by = cy + Math.sin(a) * len * 0.6;
      g += `<path d="M${n(bx)},${n(by)} L${n(bx + Math.cos(a + 0.7) * 60)},${n(by + Math.sin(a + 0.7) * 60)}" stroke-width="1" opacity="0.18"/>`;
    }
    s.add(g + '</g>');
    const f = blur(s, 60);
    s.add(`<circle cx="${n(cx)}" cy="${n(cy)}" r="200" fill="${p.glow}" opacity="0.28" filter="url(#${f})"/>`);
    vignette(s, { strength: 0.6 });
  },

  moon(s, p, rng) {
    const hy = H * 0.56;
    sky(s, p, hy);
    water(s, p, hy);
    for (let i = 0; i < 50; i++) {
      s.add(`<circle cx="${n(R(rng, 0, W))}" cy="${n(R(rng, 0, hy - 60))}" r="${n(R(rng, 0.7, 2))}" fill="${p.light}" opacity="${n(R(rng, 0.1, 0.6))}"/>`);
    }
    disc(s, { cx: W * 0.36, cy: H * 0.22, r: 62, color: p.glow, glow: 3.6, core: 1 });
    treeline(s, rng, { hy, color: '#000', height: 40, opacity: 0.95 });
    reflectionColumn(s, rng, { cx: W * 0.36, hy, color: p.light, width: 110, opacity: 0.5 });
    vignette(s, { strength: 0.65 });
  },

  channel(s, p, rng) {
    const hy = H * 0.4;
    sky(s, p, hy);
    water(s, p, hy);
    atmosphere(s, p, rng, { count: 4, opacity: 0.2, band: [0.34, 0.5] });
    const left = `M0,${n(hy)} C${n(W * 0.28)},${n(hy + 60)} ${n(W * 0.34)},${n(H * 0.72)} ${n(W * 0.2)},${H} L0,${H} Z`;
    const right = `M${W},${n(hy)} C${n(W * 0.74)},${n(hy + 80)} ${n(W * 0.68)},${n(H * 0.7)} ${n(W * 0.82)},${H} L${W},${H} Z`;
    s.add(`<path d="${left}" fill="${p.ink}" opacity="0.9"/>`);
    s.add(`<path d="${right}" fill="${p.ink}" opacity="0.85"/>`);
    waterStreaks(s, rng, { hy, color: p.light, count: 26, opacity: 0.18 });
    vignette(s, { strength: 0.55 });
  },

  reflection(s, p, rng) {
    const hy = H * 0.5;
    sky(s, p, hy, { warmth: 1 });
    disc(s, { cx: W * 0.62, cy: hy - 180, r: 70, color: p.glow, glow: 4 });
    treeline(s, rng, { hy, color: '#000', height: 46, opacity: 0.95 });
    s.add(`<g transform="translate(0 ${n(H)}) scale(1 -1)" opacity="0.5">`);
    s.add(`<rect y="${n(H - hy)}" width="${W}" height="${n(hy)}" fill="none"/>`);
    s.add(`</g>`);
    const mirror = linear(s, [[0, p.glow, 0.5], [0.4, p.b, 0.9], [1, p.ink, 1]], { y1: hy / H, y2: 1 });
    s.add(`<rect y="${n(hy)}" width="${W}" height="${n(H - hy)}" fill="url(#${mirror})"/>`);
    for (let i = 0; i < 90; i++) {
      const t = rng() ** 1.3;
      const y = hy + t * (H - hy);
      s.add(`<rect x="${n(R(rng, -40, W))}" y="${n(y)}" width="${n(R(rng, 80, 520))}" height="${n(1 + t * 5)}" fill="${p.ink}" opacity="${n(R(rng, 0.1, 0.45))}"/>`);
    }
    reflectionColumn(s, rng, { cx: W * 0.62, hy, color: p.light, width: 130, opacity: 0.4 });
    vignette(s, { strength: 0.55 });
  },

  threshold(s, p, rng) {
    s.add(`<rect width="${W}" height="${H}" fill="${p.ink}"/>`);
    const gap = linear(s, [[0, p.glow, 0], [0.45, p.light, 0.9], [0.55, p.light, 0.9], [1, p.glow, 0]], { x1: 0, y1: 0, x2: 1, y2: 0 });
    s.add(`<rect x="${n(W * 0.34)}" width="${n(W * 0.32)}" height="${H}" fill="url(#${gap})" opacity="0.55"/>`);
    const f = blur(s, 70);
    s.add(`<rect x="${n(W * 0.3)}" width="${n(W * 0.4)}" height="${H}" fill="${p.glow}" opacity="0.3" filter="url(#${f})"/>`);
    s.add(`<path d="M0,0 L${n(W * 0.36)},0 C${n(W * 0.3)},${n(H * 0.4)} ${n(W * 0.38)},${n(H * 0.7)} ${n(W * 0.3)},${H} L0,${H} Z" fill="${p.a}"/>`);
    s.add(`<path d="M${W},0 L${n(W * 0.66)},0 C${n(W * 0.72)},${n(H * 0.4)} ${n(W * 0.64)},${n(H * 0.7)} ${n(W * 0.72)},${H} L${W},${H} Z" fill="${p.a}"/>`);
    vignette(s, { strength: 0.6 });
  },

  circuit(s, p, rng) {
    s.add(`<rect width="${W}" height="${H}" fill="url(#${linear(s, [[0, p.a], [1, p.ink]], { y2: 1 })})"/>`);
    let g = `<g stroke="${p.light}" stroke-width="1" opacity="0.07">`;
    for (let x = 0; x <= W; x += 60) g += `<line x1="${x}" y1="0" x2="${x}" y2="${H}"/>`;
    for (let y = 0; y <= H; y += 60) g += `<line x1="0" y1="${y}" x2="${W}" y2="${y}"/>`;
    s.add(g + '</g>');
    lakeLoop(s, { cx: W * 0.5, cy: H * 0.48, size: W * 0.86, color: p.glow, opacity: 0.9, strokeWidth: 3, dash: '18 12' });
    lakeGlyph(s, { cx: W * 0.5, cy: H * 0.48, size: W * 0.8, fill: p.c, opacity: 0.35 });
    const pts = [[0.32, 0.28], [0.66, 0.62], [0.5, 0.44], [0.74, 0.78]];
    for (const [fx, fy] of pts) {
      s.add(`<circle cx="${n(W * fx)}" cy="${n(H * fy)}" r="9" fill="${p.light}" opacity="0.85"/>`);
      s.add(`<circle cx="${n(W * fx)}" cy="${n(H * fy)}" r="22" fill="none" stroke="${p.light}" stroke-width="1.5" opacity="0.35"/>`);
    }
    vignette(s, { strength: 0.55 });
  },

  wheel(s, p, rng) {
    const hy = H * 0.68;
    sky(s, p, hy, { warmth: 1 });
    water(s, p, hy);
    const cx = W * 0.5, cy = hy - 150, r = 210;
    disc(s, { cx, cy, r: 150, color: p.glow, glow: 3, core: 0.35 });
    let g = `<g stroke="${p.ink}" fill="none" stroke-linecap="round" opacity="0.9">`;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      g += `<line x1="${n(cx + Math.cos(a) * 16)}" y1="${n(cy + Math.sin(a) * 16)}" x2="${n(cx + Math.cos(a) * (r - 12))}" y2="${n(cy + Math.sin(a) * (r - 12))}" stroke-width="3"/>`;
    }
    s.add(g + '</g>');
    s.add(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${r}" fill="none" stroke="${p.ink}" stroke-width="14" opacity="0.92"/>`);
    s.add(`<circle cx="${n(cx)}" cy="${n(cy)}" r="18" fill="${p.ink}" opacity="0.92"/>`);
    treeline(s, rng, { hy, color: p.ink, height: 18, opacity: 0.8 });
    reflectionColumn(s, rng, { cx, hy, color: p.glow, width: 160, opacity: 0.4 });
    vignette(s, { strength: 0.5 });
  },
};

/* ------------------------------------------------------------------ */
/* grano + salida                                                      */
/* ------------------------------------------------------------------ */

/** Grano de película determinístico, compuesto en overlay. */
function grainBuffer(rng, w, h, strength) {
  const px = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = 128 + Math.round((rng() - 0.5) * 255);
    const c = v < 0 ? 0 : v > 255 ? 255 : v;
    px[i * 4] = c;
    px[i * 4 + 1] = c;
    px[i * 4 + 2] = c;
    px[i * 4 + 3] = strength;
  }
  return sharp(px, { raw: { width: w, height: h, channels: 4 } });
}

async function main() {
  await mkdir(out('public/challenges'), { recursive: true });
  if (WRITE_SVG) await mkdir(out('assets/challenge-svg'), { recursive: true });
  await mkdir(out('src/data'), { recursive: true });

  const index = [];

  for (let i = 0; i < CHALLENGE_CATALOG.length; i++) {
    const spec = CHALLENGE_CATALOG[i];
    const id = artworkId(i);
    const p = PALETTES[spec.palette];
    const rng = mulberry32(hashSeed(`lake:${spec.slug}:${spec.motif}`));
    const motif = MOTIFS[spec.motif];
    if (!motif) throw new Error(`motivo desconocido: ${spec.motif}`);

    const s = scene();
    motif(s, p, rng);
    readabilityScrim(s, p);
    const svgStr = s.render();
    if (WRITE_SVG) await writeFile(out(`assets/challenge-svg/${id}.svg`), svgStr);

    const base = await sharp(Buffer.from(svgStr), { density: 144 })
      .resize(W, H)
      .png()
      .toBuffer();

    const grainRng = mulberry32(hashSeed(`grain:${spec.slug}`));
    const grain = await grainBuffer(grainRng, Math.round(W / 2), Math.round(H / 2), 26)
      .resize(W, H, { kernel: 'nearest' })
      .png()
      .toBuffer();

    // sharp aplica resize antes que composite, así que materializamos acá.
    const composed = await sharp(base)
      .composite([{ input: grain, blend: 'overlay' }])
      .modulate({ saturation: 1.24, brightness: 1.03 })
      .linear(1.1, -10)
      .png()
      .toBuffer();

    const webp = await sharp(composed).webp({ quality: 80, effort: 5 }).toBuffer();
    await writeFile(out(`public/challenges/${id}.webp`), webp);

    const lqipBuf = await sharp(composed).resize(18, 22).blur(2).webp({ quality: 40 }).toBuffer();
    const stats = await sharp(composed).stats();
    const dom = stats.dominant;
    const hex = `#${[dom.r, dom.g, dom.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

    index.push({
      id,
      slug: spec.slug,
      name: spec.name,
      palette: spec.palette,
      motif: spec.motif,
      tint: hex,
      glow: p.glow,
      ink: p.ink,
      lqip: `data:image/webp;base64,${lqipBuf.toString('base64')}`,
      bytes: webp.length,
    });

    process.stdout.write(`  · ${id} ${spec.name.padEnd(10)} ${spec.motif.padEnd(11)} ${(webp.length / 1024).toFixed(0)} kB\n`);
  }

  const total = index.reduce((a, b) => a + b.bytes, 0);

  const ts =
    `/* Generado por scripts/generate-challenge-art.mjs — no editar a mano. */\n` +
    `import type { ChallengeArtwork } from '../models/types';\n\n` +
    `export const CHALLENGE_ARTWORKS: ChallengeArtwork[] = ${JSON.stringify(
      index.map(({ bytes, ...rest }) => ({ ...rest, src: `challenges/${rest.id}.webp` })),
      null,
      2
    )};\n\n` +
    `export const ARTWORK_COUNT = CHALLENGE_ARTWORKS.length;\n`;
  await writeFile(out('src/data/challengeArtwork.generated.ts'), ts);

  console.log(`\n${index.length} portadas · ${(total / 1024 / 1024).toFixed(2)} MB · public/challenges/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
