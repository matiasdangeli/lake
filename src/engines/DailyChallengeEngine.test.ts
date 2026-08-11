import { describe, expect, it } from 'vitest';
import { resolveChallenge, dayIndexFor, effectiveLaps, refreshDistances } from './DailyChallengeEngine';
import { ARTWORK_COUNT, artworkForDayIndex } from './ChallengeArtworkGenerator';
import { initialProgression } from './AdaptiveCyclingEngine';
import type { UserProfile } from '../models/types';

const profile: UserProfile = {
  installId: 'install-abc',
  name: 'Mati',
  locationId: 'lago-municipal-colon',
  goal: '',
  baselineLaps: 2,
  createdAt: '2026-08-01T09:00:00.000Z',
  onboardedAt: '2026-08-01T09:00:00.000Z',
};

const resolve = (date: string, level = 4) =>
  resolveChallenge({
    date,
    profile,
    progression: { ...initialProgression(2), level },
    lapDistanceKm: 4,
  });

describe('identidad diaria determinística', () => {
  it('la misma fecha da siempre lo mismo', () => {
    const a = resolve('2026-08-11');
    const b = resolve('2026-08-11');
    expect(a).toEqual(b);
  });

  it('fechas distintas dan nombre y portada distintos', () => {
    const a = resolve('2026-08-11');
    const b = resolve('2026-08-12');
    expect(a.name).not.toBe(b.name);
    expect(a.artworkId).not.toBe(b.artworkId);
  });

  it('el número es correlativo desde la instalación', () => {
    expect(resolve('2026-08-01').number).toBe(1);
    expect(resolve('2026-08-12').number).toBe(12);
  });

  it('otra instalación ve otro orden de portadas', () => {
    const other = { ...profile, installId: 'install-xyz' };
    const a = resolveChallenge({ date: '2026-08-11', profile, progression: initialProgression(2), lapDistanceKm: 4 });
    const b = resolveChallenge({ date: '2026-08-11', profile: other, progression: initialProgression(2), lapDistanceKm: 4 });
    expect(a.artworkId).not.toBe(b.artworkId);
  });

  it('no repite portada dentro de un ciclo completo', () => {
    const seen = new Set<string>();
    for (let i = 0; i < ARTWORK_COUNT; i++) seen.add(artworkForDayIndex(profile.installId, i).id);
    expect(seen.size).toBe(ARTWORK_COUNT);
  });

  it('dayIndexFor nunca es negativo', () => {
    expect(dayIndexFor(profile, '2026-07-01')).toBe(0);
  });
});

describe('objetivos', () => {
  it('la distancia sale de las vueltas por la distancia configurada', () => {
    const c = resolve('2026-08-11', 4);
    expect(c.targetLaps).toBe(2);
    expect(c.targetDistanceKm).toBe(8);
  });

  it('respeta una distancia de vuelta distinta', () => {
    const c = resolveChallenge({
      date: '2026-08-11', profile, progression: { ...initialProgression(2), level: 4 }, lapDistanceKm: 3.6,
    });
    expect(c.targetDistanceKm).toBe(7.2);
  });

  it('el ajuste manual manda sobre el objetivo', () => {
    const c = { ...resolve('2026-08-11'), customLaps: 3 };
    expect(effectiveLaps(c)).toBe(3);
    expect(refreshDistances(c, 4).targetDistanceKm).toBe(12);
  });

  it('la frase no deja marcadores sin reemplazar', () => {
    for (let d = 1; d <= 28; d++) {
      for (const level of [0, 1, 2, 3, 4, 7, 10]) {
        const c = resolve(`2026-08-${String(d).padStart(2, '0')}`, level);
        expect(c.phrase).not.toMatch(/\{[a-z]+\}/);
        expect(c.objective.length).toBeGreaterThan(0);
      }
    }
  });
});
