import { describe, expect, it } from 'vitest';
import { avgSpeed, duration, km, parseDuration, parseNumber, speed } from './format';
import { addDays, daysBetween, msUntilMidnight, startOfWeek, toISODate, weekdayIndex } from './date';

describe('formato', () => {
  it('usa coma decimal', () => {
    expect(km(8.15)).toBe('8,2 km');
    expect(speed(16.75)).toBe('16,8 km/h');
  });

  it('sin dato muestra guion, nunca NaN', () => {
    expect(km(null)).toBe('—');
    expect(speed(undefined)).toBe('—');
    expect(duration(0)).toBe('—');
  });

  it('duración en M:SS y H:MM:SS', () => {
    expect(duration(1794)).toBe('29:54');
    expect(duration(3725)).toBe('1:02:05');
  });

  it('parsea duraciones escritas de varias formas', () => {
    expect(parseDuration('30')).toBe(1800);
    expect(parseDuration('29:54')).toBe(1794);
    expect(parseDuration('1:02:05')).toBe(3725);
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('abc')).toBeNull();
  });

  it('parsea números con coma', () => {
    expect(parseNumber('8,2')).toBe(8.2);
    expect(parseNumber('8.2')).toBe(8.2);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('x')).toBeNull();
  });

  it('calcula velocidad media', () => {
    expect(avgSpeed(8, 1800)).toBe(16);
    expect(avgSpeed(8, 0)).toBeNull();
    expect(avgSpeed(null, 1800)).toBeNull();
  });
});

describe('fechas locales', () => {
  it('toISODate usa la fecha local, no UTC', () => {
    // 23:30 local del 11 sigue siendo el 11 aunque en UTC ya sea 12.
    expect(toISODate(new Date(2026, 7, 11, 23, 30))).toBe('2026-08-11');
    expect(toISODate(new Date(2026, 7, 12, 0, 30))).toBe('2026-08-12');
  });

  it('suma y resta días cruzando meses', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('daysBetween cuenta días completos', () => {
    expect(daysBetween('2026-08-01', '2026-08-12')).toBe(11);
    expect(daysBetween('2026-08-12', '2026-08-01')).toBe(-11);
  });

  it('la semana arranca el lunes', () => {
    expect(weekdayIndex('2026-08-10')).toBe(0);
    expect(weekdayIndex('2026-08-16')).toBe(6);
    expect(startOfWeek('2026-08-14')).toBe('2026-08-10');
  });

  it('msUntilMidnight siempre es positivo y menor a un día', () => {
    const ms = msUntilMidnight(new Date(2026, 7, 11, 23, 59, 30));
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(86_400_000);
  });
});
