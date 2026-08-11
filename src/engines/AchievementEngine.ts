/**
 * AchievementEngine
 *
 * Recalcula el set completo desde el historial: así, si se edita o borra una
 * salida, los logros quedan consistentes en vez de acumular fantasmas.
 */
import type { Achievement, AchievementId, CyclingSession, DailyChallenge } from '../models/types';
import { startOfWeek } from '../utils/date';

const byDateAsc = (a: CyclingSession, b: CyclingSession) =>
  a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);

interface Ctx {
  sessions: CyclingSession[];
  challenges: DailyChallenge[];
}

export function computeAchievements({ sessions, challenges }: Ctx): Achievement[] {
  const sorted = [...sessions].sort(byDateAsc);
  const found = new Map<AchievementId, Achievement>();

  const unlock = (id: AchievementId, s: CyclingSession) => {
    if (found.has(id)) return;
    found.set(id, { id, unlockedAt: s.createdAt, date: s.date, sessionId: s.id });
  };

  let bestSpeed = 0;
  const weekCount = new Map<string, CyclingSession[]>();

  for (const s of sorted) {
    if (s.laps >= 1) unlock('primera_vuelta', s);
    if (s.laps >= 2) unlock('doble', s);
    if (s.laps >= 3) unlock('triple', s);
    if (s.laps >= 4) unlock('cuatro', s);
    if (s.distanceKm >= 10) unlock('10k', s);
    if (s.distanceKm >= 20) unlock('20k', s);
    if (s.durationSec >= 30 * 60) unlock('media_hora', s);
    if (s.durationSec >= 60 * 60) unlock('una_hora', s);

    // Récord de velocidad: sólo con datos reales y una vuelta completa.
    if (s.avgSpeedKmh && s.laps >= 1 && s.durationSec > 0) {
      if (bestSpeed > 0 && s.avgSpeedKmh > bestSpeed + 0.2) unlock('vuelta_rapida', s);
      bestSpeed = Math.max(bestSpeed, s.avgSpeedKmh);
    }

    const week = startOfWeek(s.date);
    const list = weekCount.get(week) ?? [];
    list.push(s);
    weekCount.set(week, list);
    if (list.length >= 3) unlock('constancia', list[2]);
  }

  // RACHA: 3 desafíos completados en días consecutivos de calendario.
  const completed = challenges
    .filter((c) => c.status === 'completed')
    .sort((a, b) => a.date.localeCompare(b.date));
  let run = 0;
  for (let i = 0; i < completed.length; i++) {
    const prev = completed[i - 1];
    const cur = completed[i];
    const consecutive = prev && dayDiff(prev.date, cur.date) === 1;
    run = consecutive ? run + 1 : 1;
    if (run >= 3 && !found.has('racha')) {
      const s = sorted.find((x) => x.id === cur.sessionId) ?? sorted[sorted.length - 1];
      if (s) unlock('racha', s);
    }
  }

  return [...found.values()].sort((a, b) => a.unlockedAt.localeCompare(b.unlockedAt));
}

function dayDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime()) / 86_400_000);
}

/** Ids nuevos entre dos cálculos. Sirve para disparar la animación. */
export function newlyUnlocked(before: Achievement[], after: Achievement[]): AchievementId[] {
  const had = new Set(before.map((a) => a.id));
  return after.filter((a) => !had.has(a.id)).map((a) => a.id);
}
