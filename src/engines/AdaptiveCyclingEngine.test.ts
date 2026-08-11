import { describe, expect, it } from 'vitest';
import {
  deriveMissStreak, evaluateCompletion, initialProgression, ladderStep, levelForLaps,
  revertCompletion, withDerivedStreaks,
} from './AdaptiveCyclingEngine';
import { resolveChallenge } from './DailyChallengeEngine';
import type { CyclingSession, DailyChallenge, UserProfile } from '../models/types';

const profile: UserProfile = {
  installId: 'test-install',
  name: 'Mati',
  locationId: 'lago-municipal-colon',
  goal: '',
  baselineLaps: 2,
  createdAt: '2026-08-01T08:00:00.000Z',
  onboardedAt: '2026-08-01T08:00:00.000Z',
};

const session = (over: Partial<CyclingSession> = {}): CyclingSession => ({
  id: 's1',
  date: '2026-08-11',
  time: '18:00',
  challengeId: '2026-08-11',
  laps: 2,
  distanceKm: 8,
  durationSec: 1800,
  avgSpeedKmh: 16,
  maxSpeedKmh: null,
  avgHr: null,
  maxHr: null,
  calories: null,
  cadence: null,
  effort: 6,
  feeling: 'bien',
  discomfort: null,
  notes: null,
  lapDetails: [],
  createdAt: '2026-08-11T18:30:00.000Z',
  updatedAt: '2026-08-11T18:30:00.000Z',
  ...over,
});

const challengeOn = (date: string, progression = initialProgression(2)): DailyChallenge =>
  resolveChallenge({ date, profile, progression, lapDistanceKm: 4 });

describe('escalera de niveles', () => {
  it('el nivel 0 es una calibración de una vuelta', () => {
    expect(ladderStep(0)).toEqual({ laps: 1, type: 'CALIBRACION' });
  });

  it('sube de vueltas cada tres peldaños', () => {
    expect(ladderStep(1).laps).toBe(1);
    expect(ladderStep(3).laps).toBe(1);
    expect(ladderStep(4).laps).toBe(2);
    expect(ladderStep(7).laps).toBe(3);
    expect(ladderStep(10).laps).toBe(4);
  });

  it('cambia sólo una variable por peldaño', () => {
    for (let l = 1; l < 20; l++) {
      const a = ladderStep(l);
      const b = ladderStep(l + 1);
      const lapsChanged = a.laps !== b.laps;
      const typeChanged = a.type !== b.type;
      expect(lapsChanged && typeChanged && b.laps - a.laps > 1).toBe(false);
      expect(b.laps - a.laps).toBeLessThanOrEqual(1);
    }
  });

  it('levelForLaps encuentra el primer peldaño de esa cantidad', () => {
    expect(ladderStep(levelForLaps(1)).laps).toBe(1);
    expect(ladderStep(levelForLaps(2)).laps).toBe(2);
    expect(ladderStep(levelForLaps(4)).laps).toBe(4);
  });
});

describe('EL TIEMPO NO PROGRESA — regla fundamental', () => {
  it('día 1 con 2 vueltas sin completar deja el día 2 igual en 2 vueltas', () => {
    const progression = initialProgression(2);
    expect(progression.targetLaps).toBe(2);

    const day1 = challengeOn('2026-08-11', progression);
    expect(day1.targetLaps).toBe(2);
    const notCompleted: DailyChallenge = { ...day1, status: 'pending' };

    // Pasa el día. Nada lo completa.
    const afterMidnight = withDerivedStreaks(progression, [notCompleted], '2026-08-12');
    expect(afterMidnight.level).toBe(progression.level);

    const day2 = challengeOn('2026-08-12', afterMidnight);
    expect(day2.targetLaps).toBe(2);
    expect(day2.level).toBe(day1.level);
  });

  it('diez días sin completar tampoco mueven el nivel', () => {
    let progression = initialProgression(2);
    const challenges: DailyChallenge[] = [];
    for (let d = 11; d <= 20; d++) {
      const date = `2026-08-${d}`;
      challenges.push({ ...challengeOn(date, progression), status: 'pending' });
      progression = withDerivedStreaks(progression, challenges, `2026-08-${d + 1}`);
    }
    expect(progression.level).toBe(initialProgression(2).level);
    expect(progression.targetLaps).toBe(2);
  });

  it('la identidad del día sí cambia aunque la carga no', () => {
    const progression = initialProgression(2);
    const a = challengeOn('2026-08-11', progression);
    const b = challengeOn('2026-08-12', progression);
    expect(a.name).not.toBe(b.name);
    expect(a.artworkId).not.toBe(b.artworkId);
    expect(a.targetLaps).toBe(b.targetLaps);
  });

  it('recién al completar puede avanzar', () => {
    const progression = initialProgression(2);
    const challenge = challengeOn('2026-08-13', progression);
    const { state } = evaluateCompletion({ state: progression, challenge, session: session({ laps: 2 }) });
    expect(state.level).toBe(progression.level + 1);
  });
});

describe('reglas de progresión', () => {
  const progression = initialProgression(2);
  const challenge = challengeOn('2026-08-11', progression);

  it('esfuerzo moderado avanza un peldaño', () => {
    const { state, delta } = evaluateCompletion({ state: progression, challenge, session: session({ effort: 6 }) });
    expect(delta).toBe(1);
    expect(state.level).toBe(progression.level + 1);
  });

  it('esfuerzo muy alto mantiene la carga', () => {
    const { state, delta } = evaluateCompletion({ state: progression, challenge, session: session({ effort: 9 }) });
    expect(delta).toBe(0);
    expect(state.level).toBe(progression.level);
  });

  it('mala sensación mantiene la carga', () => {
    const { state } = evaluateCompletion({ state: progression, challenge, session: session({ feeling: 'pesado' }) });
    expect(state.level).toBe(progression.level);
  });

  it('molestias no suben nada y ablandan el próximo', () => {
    const { state } = evaluateCompletion({
      state: progression, challenge, session: session({ discomfort: 'rodilla derecha' }),
    });
    expect(state.level).toBe(progression.level);
    expect(state.softenNext).toBe(true);
  });

  it('no llegar al objetivo mantiene la carga', () => {
    const { state } = evaluateCompletion({ state: progression, challenge, session: session({ laps: 1 }) });
    expect(state.level).toBe(progression.level);
  });

  it('sobrar margen puede saltar dos peldaños, nunca más', () => {
    const warm = { ...progression, consecutiveCompleted: 2 };
    const { delta } = evaluateCompletion({
      state: warm, challenge, session: session({ laps: 3, effort: 3, feeling: 'excelente' }),
    });
    expect(delta).toBe(2);
  });

  it('nunca sube más de una vuelta por completado', () => {
    let state = initialProgression(2);
    const before = state.targetLaps;
    const { state: after } = evaluateCompletion({
      state, challenge, session: session({ laps: 4, effort: 2, feeling: 'excelente' }),
    });
    expect(after.targetLaps - before).toBeLessThanOrEqual(1);
    state = after;
  });
});

describe('deshacer', () => {
  it('vuelve al nivel anterior', () => {
    const progression = initialProgression(2);
    const challenge = challengeOn('2026-08-11', progression);
    const { state } = evaluateCompletion({ state: progression, challenge, session: session() });
    expect(state.level).toBe(progression.level + 1);
    const reverted = revertCompletion(state, challenge);
    expect(reverted.level).toBe(progression.level);
    expect(reverted.history).toHaveLength(0);
  });
});

describe('racha de días sin completar', () => {
  const mk = (date: string, status: DailyChallenge['status']) => ({ date, status });

  it('cuenta sólo días consecutivos anteriores a hoy', () => {
    const list = [mk('2026-08-08', 'pending'), mk('2026-08-09', 'skipped'), mk('2026-08-10', 'pending')];
    expect(deriveMissStreak(list, '2026-08-11')).toBe(3);
  });

  it('se corta con un completado', () => {
    const list = [mk('2026-08-09', 'pending'), mk('2026-08-10', 'completed')];
    expect(deriveMissStreak(list, '2026-08-11')).toBe(0);
  });

  it('es idempotente: recalcular no acumula', () => {
    const list = [mk('2026-08-10', 'pending')];
    const a = withDerivedStreaks(initialProgression(2), list, '2026-08-11');
    const b = withDerivedStreaks(a, list, '2026-08-11');
    expect(b.consecutiveMissed).toBe(1);
    expect(b).toBe(a);
  });

  it('a los 3 días el desafío se ablanda pero mantiene las vueltas', () => {
    const list = [mk('2026-08-08', 'pending'), mk('2026-08-09', 'pending'), mk('2026-08-10', 'pending')];
    const state = withDerivedStreaks(initialProgression(2), list, '2026-08-11');
    expect(state.softenNext).toBe(true);
    const c = resolveChallenge({ date: '2026-08-11', profile, progression: state, lapDistanceKm: 4 });
    expect(c.type).toBe('RECUPERACION');
    expect(c.targetLaps).toBe(2);
    expect(state.level).toBe(initialProgression(2).level);
  });
});
