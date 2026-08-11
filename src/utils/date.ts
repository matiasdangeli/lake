import type { ISODate } from '../models/types';

/** Fecha local -> YYYY-MM-DD. Nunca usamos toISOString(): eso es UTC. */
export function toISODate(d: Date = new Date()): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD -> Date a medianoche local. */
export function fromISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const todayISO = (): ISODate => toISODate();

export function addDays(iso: ISODate, days: number): ISODate {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Días completos entre dos fechas locales (b - a). */
export function daysBetween(a: ISODate, b: ISODate): number {
  const ms = fromISODate(b).getTime() - fromISODate(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** Milisegundos que faltan para la próxima medianoche local. */
export function msUntilMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0);
  return next.getTime() - now.getTime();
}

export const nowTime = (d: Date = new Date()): string =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Lunes = 0 … domingo = 6 (la semana argentina). */
export const weekdayIndex = (iso: ISODate): number => (fromISODate(iso).getDay() + 6) % 7;

export const monthLabel = (year: number, month: number): string => `${MONTHS[month]} ${year}`;

export function longDate(iso: ISODate): string {
  const d = fromISODate(iso);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

export function shortDate(iso: ISODate): string {
  const d = fromISODate(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

/** Lunes de la semana ISO que contiene la fecha. */
export function startOfWeek(iso: ISODate): ISODate {
  return addDays(iso, -weekdayIndex(iso));
}

export function startOfMonth(iso: ISODate): ISODate {
  const d = fromISODate(iso);
  return toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Relativo corto y sin dramatismo: "hoy", "ayer", "hace 4 días". */
export function relativeDay(iso: ISODate, from: ISODate = todayISO()): string {
  const diff = daysBetween(iso, from);
  if (diff === 0) return 'hoy';
  if (diff === 1) return 'ayer';
  if (diff < 0) return shortDate(iso);
  if (diff < 7) return `hace ${diff} días`;
  if (diff < 14) return 'hace una semana';
  if (diff < 60) return `hace ${Math.round(diff / 7)} semanas`;
  return shortDate(iso);
}
