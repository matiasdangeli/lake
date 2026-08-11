import { describe, expect, it } from 'vitest';
import { computeAchievements, newlyUnlocked } from './AchievementEngine';
import type { CyclingSession, DailyChallenge } from '../models/types';

let seq = 0;
const s = (over: Partial<CyclingSession> = {}): CyclingSession => {
  seq++;
  return {
    id: `s${seq}`,
    date: '2026-08-10',
    time: '18:00',
    challengeId: null,
    laps: 1,
    distanceKm: 4,
    durationSec: 900,
    avgSpeedKmh: 16,
    maxSpeedKmh: null, avgHr: null, maxHr: null, calories: null, cadence: null,
    effort: 5,
    feeling: 'bien',
    discomfort: null, notes: null, lapDetails: [],
    createdAt: `2026-08-10T18:0${seq % 10}:00.000Z`,
    updatedAt: '2026-08-10T18:00:00.000Z',
    ...over,
  };
};

const ids = (list: { id: string }[]) => list.map((a) => a.id).sort();

describe('logros', () => {
  it('sin salidas no hay logros', () => {
    expect(computeAchievements({ sessions: [], challenges: [] })).toEqual([]);
  });

  it('primera vuelta con una salida', () => {
    expect(ids(computeAchievements({ sessions: [s()], challenges: [] }))).toContain('primera_vuelta');
  });

  it('umbrales de vueltas, distancia y tiempo', () => {
    const got = ids(computeAchievements({
      sessions: [s({ laps: 4, distanceKm: 21, durationSec: 3700 })],
      challenges: [],
    }));
    expect(got).toEqual(expect.arrayContaining(['primera_vuelta', 'doble', 'triple', 'cuatro', '10k', '20k', 'media_hora', 'una_hora']));
  });

  it('constancia con 3 salidas en la misma semana', () => {
    const week = [s({ date: '2026-08-10' }), s({ date: '2026-08-12' }), s({ date: '2026-08-14' })];
    expect(ids(computeAchievements({ sessions: week, challenges: [] }))).toContain('constancia');
  });

  it('no da constancia si las salidas cruzan semanas', () => {
    const spread = [s({ date: '2026-08-07' }), s({ date: '2026-08-12' }), s({ date: '2026-08-19' })];
    expect(ids(computeAchievements({ sessions: spread, challenges: [] }))).not.toContain('constancia');
  });

  it('vuelta rápida requiere superar un registro previo', () => {
    const one = computeAchievements({ sessions: [s({ avgSpeedKmh: 20 })], challenges: [] });
    expect(ids(one)).not.toContain('vuelta_rapida');
    const two = computeAchievements({
      sessions: [s({ avgSpeedKmh: 16, distanceKm: 4, durationSec: 900 }), s({ avgSpeedKmh: 19, distanceKm: 4, durationSec: 760 })],
      challenges: [],
    });
    expect(ids(two)).toContain('vuelta_rapida');
  });

  it('racha con 3 desafíos completados en días consecutivos', () => {
    const ch = (date: string): DailyChallenge => ({
      date, number: 1, name: 'X', phrase: '', type: 'VUELTAS', objective: '',
      targetLaps: 1, targetDistanceKm: 4, targetDurationMin: null, level: 1,
      artworkId: 'challenge-01', seed: 1, status: 'completed', startedAt: null,
      completedAt: `${date}T19:00:00.000Z`, sessionId: null, customLaps: null,
    });
    const got = ids(computeAchievements({
      sessions: [s()],
      challenges: [ch('2026-08-10'), ch('2026-08-11'), ch('2026-08-12')],
    }));
    expect(got).toContain('racha');
  });

  it('se recalcula al borrar: los logros no quedan colgados', () => {
    const withBig = computeAchievements({ sessions: [s({ laps: 4, distanceKm: 16 })], challenges: [] });
    expect(ids(withBig)).toContain('cuatro');
    const afterDelete = computeAchievements({ sessions: [], challenges: [] });
    expect(afterDelete).toEqual([]);
    expect(newlyUnlocked(afterDelete, withBig)).toContain('cuatro');
  });
});
