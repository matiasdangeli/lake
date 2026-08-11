/**
 * Geometría de la marca LAKE: la silueta del Lago Municipal de Colón.
 *
 * Origen: el mapa del lago (-33.9192, -61.0988). No es un recorte del mapa:
 * la forma se reconstruye paramétricamente a partir de su anatomía real —
 * una columna (el eje NO→SE del lago) y un ancho variable a lo largo de ella.
 * Eso da curvas limpias, controlables y reproducibles.
 *
 * Anatomía:
 *   · cabeza redondeada al NO  (Lago Colón)
 *   · cuello angosto
 *   · cuerpo que baja al SE conteniendo la península
 *   · masa final redonda al SE (Lago Municipal)
 *   · península interior  ->  espacio negativo del isotipo
 */

/**
 * [x, y, semiancho, sesgo] a lo largo del eje del lago, en un espacio 0..1000.
 * El sesgo (-1..1) reparte el ancho de forma asimétrica: positivo empuja la
 * masa hacia el NE. Es lo que le da a la cabeza su forma real —el lago no es
 * un tubo simétrico— y mantiene recta la orilla SO.
 */
const LAKE_SPINE = [
  [114, 302,  10, 0.00],  // punta oeste
  [160, 284,  40, 0.16],
  [214, 260,  70, 0.20],
  [272, 240,  86, 0.22],
  [332, 232,  92, 0.20],  // cabeza
  [390, 242,  88, 0.15],
  [436, 268,  78, 0.08],
  [470, 312,  62, 0.02],
  [488, 358,  48, 0.00],  // cuello
  [518, 410,  76, 0.00],
  [558, 472, 100, 0.00],
  [612, 550, 114, 0.00],
  [670, 634, 118, -0.05],
  [732, 722, 132, -0.03],
  [798, 816, 152, 0.00],  // masa SE
  [858, 900, 108, 0.00],
];

/** Península interior, mismo formato. */
const ISLAND_SPINE = [
  [528, 438,  8, 0.00],
  [570, 502, 34, 0.00],
  [616, 572, 46, 0.00],
  [664, 644, 46, 0.00],
  [712, 716, 34, 0.00],
  [746, 770, 10, 0.00],
];

/* ------------------------------------------------------------------ */

const fmt = (v) => Number(v.toFixed(2)).toString();

/** Catmull-Rom uniforme: devuelve una polilínea densa con el ancho interpolado. */
function densify(spine, perSegment = 14) {
  const n = spine.length;
  const at = (i) => spine[Math.max(0, Math.min(n - 1, i))];
  const pts = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let s = 0; s < perSegment; s++) {
      const t = s / perSegment;
      const t2 = t * t, t3 = t2 * t;
      const h = (a, b, c, d) =>
        0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      pts.push([
        h(p0[0], p1[0], p2[0], p3[0]),
        h(p0[1], p1[1], p2[1], p3[1]),
        h(p0[2], p1[2], p2[2], p3[2]),
        h(p0[3], p1[3], p2[3], p3[3]),
      ]);
    }
  }
  pts.push([...spine[n - 1]]);
  return pts;
}

/** Convierte columna+ancho en un contorno cerrado con extremos redondeados. */
function ribbon(spine, { perSegment = 14, capSteps = 10 } = {}) {
  const pts = densify(spine, perSegment);
  const N = pts.length;
  const normals = pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    return [-dy / len, dx / len];
  });

  // El sesgo reparte el semiancho: SO recibe (1 - bias), NE recibe (1 + bias).
  const wSO = (p) => p[2] * (1 - p[3]);
  const wNE = (p) => p[2] * (1 + p[3]);

  const left = pts.map((p, i) => [p[0] + normals[i][0] * wSO(p), p[1] + normals[i][1] * wSO(p)]);
  const right = pts.map((p, i) => [p[0] - normals[i][0] * wNE(p), p[1] - normals[i][1] * wNE(p)]);

  const cap = (i, dir) => {
    const p = pts[i];
    const [nx, ny] = normals[i];
    const a0 = Math.atan2(ny, nx);
    const from = dir > 0 ? wNE(p) : wSO(p);
    const to = dir > 0 ? wSO(p) : wNE(p);
    const arc = [];
    for (let s = 1; s < capSteps; s++) {
      const f = s / capSteps;
      const r = from + (to - from) * f;
      const a = a0 + dir * Math.PI * f;
      arc.push([p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r]);
    }
    return arc;
  };

  return [...left, ...cap(N - 1, -1), ...right.slice().reverse(), ...cap(0, 1)];
}

/** Ramer–Douglas–Peucker: baja la cantidad de puntos sin perder la forma. */
function simplify(points, epsilon) {
  if (points.length < 3) return points;
  const dist = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    if (!l2) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  };
  const run = (from, to) => {
    let maxD = 0, idx = -1;
    for (let i = from + 1; i < to; i++) {
      const d = dist(points[i], points[from], points[to]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD <= epsilon) return [points[from]];
    return [...run(from, idx), ...run(idx, to)];
  };
  return [...run(0, points.length - 1), points[points.length - 1]];
}

/** Catmull-Rom cerrado -> cúbicas de Bézier. */
export function smoothClosedPath(points, tension = 1) {
  const n = points.length;
  const at = (i) => points[((i % n) + n) % n];
  let d = `M${fmt(points[0][0])},${fmt(points[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const k = tension / 6;
    d += `C${fmt(p1[0] + (p2[0] - p0[0]) * k)},${fmt(p1[1] + (p2[1] - p0[1]) * k)} ` +
      `${fmt(p2[0] - (p3[0] - p1[0]) * k)},${fmt(p2[1] - (p3[1] - p1[1]) * k)} ` +
      `${fmt(p2[0])},${fmt(p2[1])}`;
  }
  return d + 'Z';
}

export const LAKE_OUTLINE = simplify(ribbon(LAKE_SPINE), 1.6);
export const LAKE_ISLAND = simplify(ribbon(ISLAND_SPINE, { perSegment: 12, capSteps: 7 }), 1.0);

const bounds = (pts) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
};

export const LAKE_BOUNDS = bounds(LAKE_OUTLINE);

function fitter({ size, pad }) {
  const b = LAKE_BOUNDS;
  const inner = size - pad * 2;
  const scale = Math.min(inner / b.w, inner / b.h);
  const offX = pad + (inner - b.w * scale) / 2;
  const offY = pad + (inner - b.h * scale) / 2;
  return { scale, map: (pts) => pts.map(([x, y]) => [(x - b.minX) * scale + offX, (y - b.minY) * scale + offY]) };
}

/** Paths del lago normalizados dentro de un cuadrado `size`, con `pad` de margen. */
export function lakePaths({ size = 100, pad = 6, tension = 1 } = {}) {
  const { scale, map } = fitter({ size, pad });
  return {
    outline: smoothClosedPath(map(LAKE_OUTLINE), tension),
    island: smoothClosedPath(map(LAKE_ISLAND), tension),
    scale,
    width: LAKE_BOUNDS.w * scale,
    height: LAKE_BOUNDS.h * scale,
  };
}

/** El circuito que se pedalea: el contorno del lago expandido hacia afuera. */
export function lakeLoopPath({ size = 100, pad = 8, offset = 3.2, tension = 1 } = {}) {
  const { map } = fitter({ size, pad });
  const pts = map(LAKE_OUTLINE);
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return smoothClosedPath(
    pts.map(([x, y]) => {
      const dx = x - cx, dy = y - cy;
      const len = Math.hypot(dx, dy) || 1;
      return [x + (dx / len) * offset, y + (dy / len) * offset];
    }),
    tension
  );
}
