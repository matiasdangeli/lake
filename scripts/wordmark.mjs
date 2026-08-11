/**
 * Logotipo LAKE + bajada RIDE THE LOOP.
 *
 * Grotesca geométrica ligera dibujada a mano con trazos (no dependemos de
 * ninguna fuente instalada). Caja de mayúscula = 100, asta = 6.5, tracking
 * muy amplio: el peso y el aire son lo que le dan el aire editorial.
 */

export const CAP_HEIGHT = 100;
export const STROKE = 6.5;
const S2 = STROKE / 2;

/**
 * d      -> trazos (fill:none, stroke-width:STROKE, linecap:butt, linejoin:miter)
 * square -> trazos que necesitan linecap:square (sólo el punto)
 */
const GLYPHS = {
  L: { advance: 52, d: `M${S2},0V${100 - S2}H52` },
  A: { advance: 80, d: `M${S2},100L40,9L${80 - S2},100M15,72H65` },
  K: { advance: 70, d: `M${S2},0V100M66,0L${S2},53M20,42L70,100` },
  E: { advance: 58, d: `M58,${S2}H${S2}V${100 - S2}H58M${S2},50H50` },
  R: { advance: 62, d: `M${S2},100V${S2}H30A22,22 0 0 1 30,${47.25}H${S2}M28,47.25L60,100` },
  I: { advance: 6.5, d: `M${S2},${S2}V${100 - S2}` },
  D: { advance: 62, d: `M${S2},${100 - S2}V${S2}H26A${32.75},${46.75} 0 0 1 26,${100 - S2}H${S2}` },
  T: { advance: 64, d: `M32,${S2}V100M${S2},${S2}H${64 - S2}` },
  H: { advance: 62, d: `M${S2},0V100M${62 - S2},0V100M${S2},50H${62 - S2}` },
  O: { advance: 64, d: `M${S2},50A${32 - S2},${50 - S2} 0 1 0 ${64 - S2},50A${32 - S2},${50 - S2} 0 1 0 ${S2},50` },
  P: { advance: 58, d: `M${S2},100V${S2}H28A${23},${23.4} 0 0 1 28,50H${S2}` },
  ' ': { advance: 30, d: '' },
  '.': { advance: 6.5, d: '', square: `M${S2},${100 - S2}h0.01` },
};

/** Traslada/escala un path cuyos comandos son M L H V A (absolutos). */
function place(d, scale, dx, dy) {
  const tokens = d.match(/[MLHVAhv][^MLHVAhv]*/g) ?? [];
  return tokens
    .map((tk) => {
      const cmd = tk[0];
      const nums = tk.slice(1).trim().split(/[\s,]+/).filter(Boolean).map(Number);
      if (cmd === 'H') return 'H' + nums.map((v) => f(v * scale + dx)).join(' ');
      if (cmd === 'V') return 'V' + nums.map((v) => f(v * scale + dy)).join(' ');
      if (cmd === 'h') return 'h' + nums.map((v) => f(v * scale)).join(' ');
      if (cmd === 'v') return 'v' + nums.map((v) => f(v * scale)).join(' ');
      if (cmd === 'A') {
        const out = [];
        for (let i = 0; i < nums.length; i += 7) {
          out.push([f(nums[i] * scale), f(nums[i + 1] * scale), nums[i + 2], nums[i + 3], nums[i + 4],
            f(nums[i + 5] * scale + dx), f(nums[i + 6] * scale + dy)].join(' '));
        }
        return 'A' + out.join(' ');
      }
      const pairs = [];
      for (let i = 0; i < nums.length; i += 2) pairs.push(`${f(nums[i] * scale + dx)},${f(nums[i + 1] * scale + dy)}`);
      return cmd + pairs.join(' ');
    })
    .join('');
}

const f = (v) => Number(v.toFixed(2)).toString();

export function textWidth(str, { tracking, scale = 1 } = {}) {
  const tr = tracking ?? 0;
  let w = 0;
  for (let i = 0; i < str.length; i++) {
    const g = GLYPHS[str[i]];
    if (!g) throw new Error(`glifo no dibujado: "${str[i]}"`);
    w += g.advance + (i < str.length - 1 ? tr : 0);
  }
  return w * scale;
}

/** Devuelve { d, squareD } listos para <path stroke-width=STROKE*scale>. */
export function textPaths(str, { scale = 1, x = 0, y = 0, tracking = 0 } = {}) {
  let dx = 0;
  const d = [];
  const squareD = [];
  for (const ch of str) {
    const g = GLYPHS[ch];
    if (!g) throw new Error(`glifo no dibujado: "${ch}"`);
    if (g.d) d.push(place(g.d, scale, x + dx * scale, y));
    if (g.square) squareD.push(place(g.square, scale, x + dx * scale, y));
    dx += g.advance + tracking;
  }
  return { d: d.join(''), squareD: squareD.join('') };
}

/** Fragmento SVG completo de un texto. */
export function textSvg(str, { scale = 1, x = 0, y = 0, tracking = 0, fill = 'currentColor' } = {}) {
  const { d, squareD } = textPaths(str, { scale, x, y, tracking });
  const sw = f(STROKE * scale);
  let s = `<path d="${d}" fill="none" stroke="${fill}" stroke-width="${sw}" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="6"/>`;
  if (squareD) s += `<path d="${squareD}" fill="none" stroke="${fill}" stroke-width="${sw}" stroke-linecap="square"/>`;
  return s;
}

export const WORDMARK_TEXT = 'LAKE';
export const TAGLINE_TEXT = 'RIDE THE LOOP.';
export const WORDMARK_TRACKING = 42;
export const TAGLINE_TRACKING = 46;
export const WORDMARK_WIDTH = textWidth(WORDMARK_TEXT, { tracking: WORDMARK_TRACKING });
export const TAGLINE_WIDTH = textWidth(TAGLINE_TEXT, { tracking: TAGLINE_TRACKING });
