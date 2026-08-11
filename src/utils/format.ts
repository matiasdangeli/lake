/** Formateo con coma decimal, como se escribe en Argentina. */

export function km(v: number | null | undefined, decimals = 1): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v.toFixed(decimals).replace('.', ',')} km`;
}

export function kmNumber(v: number | null | undefined, decimals = 1): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toFixed(decimals).replace('.', ',');
}

export function speed(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v.toFixed(1).replace('.', ',')} km/h`;
}

/** Segundos -> M:SS o H:MM:SS. */
export function duration(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return '—';
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return `${m}:${String(ss).padStart(2, '0')}`;
}

/** "45", "45:30", "1:02:30" -> segundos. Vacío -> null. */
export function parseDuration(input: string): number | null {
  const raw = input.trim();
  if (!raw) return null;
  const parts = raw.split(':').map((p) => p.trim());
  if (parts.some((p) => p !== '' && !/^\d+$/.test(p))) return null;
  const nums = parts.map((p) => (p === '' ? 0 : Number(p)));
  if (nums.length === 1) return nums[0] * 60;
  if (nums.length === 2) return nums[0] * 60 + nums[1];
  if (nums.length === 3) return nums[0] * 3600 + nums[1] * 60 + nums[2];
  return null;
}

/** Acepta coma o punto como separador decimal. */
export function parseNumber(input: string): number | null {
  const raw = input.trim().replace(',', '.');
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function laps(n: number): string {
  return n === 1 ? '1 vuelta' : `${n} vueltas`;
}

export const FEELING_LABEL = {
  muy_mal: 'Muy mal',
  pesado: 'Pesado',
  normal: 'Normal',
  bien: 'Bien',
  excelente: 'Excelente',
} as const;

export const CHALLENGE_TYPE_LABEL = {
  CALIBRACION: 'Calibración',
  VUELTAS: 'Vueltas',
  DISTANCIA: 'Distancia',
  RITMO: 'Ritmo',
  NEGATIVE_SPLIT: 'Negative split',
  DURACION: 'Duración',
  CONSTANCIA: 'Constancia',
  CONTROL: 'Control',
  EXPLORACION: 'Exploración',
  RECUPERACION: 'Recuperación',
} as const;

/** Velocidad media a partir de distancia y tiempo. */
export function avgSpeed(distanceKm: number | null, durationSec: number | null): number | null {
  if (!distanceKm || !durationSec || durationSec <= 0) return null;
  return (distanceKm / durationSec) * 3600;
}
