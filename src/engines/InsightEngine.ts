/**
 * InsightEngine
 *
 * Una o dos frases, siempre apoyadas en datos que existen.
 * Si no hay con qué comparar, no dice nada. No inventa conclusiones.
 */
import type { CyclingSession, Insight } from '../models/types';
import { km, duration, speed } from '../utils/format';
import { startOfWeek, todayISO } from '../utils/date';

const byDateDesc = (a: CyclingSession, b: CyclingSession) =>
  b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);

export function insightsFor(sessions: CyclingSession[], limit = 2): Insight[] {
  if (sessions.length === 0) return [];
  const sorted = [...sessions].sort(byDateDesc);
  const last = sorted[0];
  const prev = sorted[1];
  const out: Insight[] = [];

  const add = (id: string, text: string, tone: Insight['tone'] = 'neutral') => {
    if (out.length < limit) out.push({ id, text, tone });
  };

  if (prev) {
    if (last.laps > prev.laps) {
      const diff = last.laps - prev.laps;
      add('laps-up', diff === 1 ? 'Hiciste una vuelta más que la anterior.' : `Hiciste ${diff} vueltas más que la anterior.`, 'up');
    } else if (last.distanceKm - prev.distanceKm >= 0.5) {
      add('dist-up', `Pedaleaste ${km(last.distanceKm - prev.distanceKm)} más que la última vez.`, 'up');
    }

    if (last.avgSpeedKmh && prev.avgSpeedKmh) {
      const d = last.avgSpeedKmh - prev.avgSpeedKmh;
      if (d >= 0.6) add('speed-up', `Tu ritmo subió a ${speed(last.avgSpeedKmh)}.`, 'up');
      else if (Math.abs(d) < 0.3) add('speed-steady', 'Tu ritmo fue prácticamente el mismo. Eso es control.', 'neutral');
    }
  }

  const longest = sessions.reduce((a, b) => (b.distanceKm > a.distanceKm ? b : a));
  if (longest.id === last.id && sessions.length > 1) {
    add('longest', 'Esta fue tu salida más larga hasta ahora.', 'up');
  }

  const longestTime = sessions.reduce((a, b) => (b.durationSec > a.durationSec ? b : a));
  if (longestTime.id === last.id && sessions.length > 1 && last.durationSec > 0) {
    add('longest-time', `${duration(last.durationSec)} arriba de la bici. Récord tuyo.`, 'up');
  }

  const monthPrefix = todayISO().slice(0, 7);
  const thisMonth = sessions.filter((s) => s.date.startsWith(monthPrefix)).length;
  if (thisMonth >= 3) add('month', `Ya completaste ${thisMonth} salidas este mes.`, 'neutral');

  if (last.effort >= 8) add('effort', 'Tu esfuerzo subió bastante. El próximo desafío se mantiene.', 'hold');
  if (last.discomfort) add('discomfort', 'Anotaste molestias. La carga no sube hasta que estés bien.', 'hold');

  if (out.length === 0) {
    if (sessions.length === 1) add('first', 'Primera salida registrada. A partir de acá se puede comparar.', 'neutral');
    else add('logged', `${sessions.length} salidas registradas.`, 'neutral');
  }

  return out;
}

/** Salidas de la semana en curso. */
export function sessionsThisWeek(sessions: CyclingSession[], today = todayISO()): CyclingSession[] {
  const monday = startOfWeek(today);
  return sessions.filter((s) => s.date >= monday && s.date <= today);
}
