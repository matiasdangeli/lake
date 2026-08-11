/**
 * DailyChallengeEngine
 *
 * Resuelve el desafío de una fecha. Dos cosas separadas a propósito:
 *
 *   IDENTIDAD DEL DÍA  — nombre, portada, frase. Cambia todos los días a las
 *                        00:00 locales y es determinística por fecha.
 *   CARGA DEL DÍA      — vueltas y tipo. Sale de la progresión, que sólo se
 *                        mueve cuando se completa un desafío.
 */
import type {
  ChallengeProgressionState,
  ChallengeType,
  DailyChallenge,
  ISODate,
  UserProfile,
} from '../models/types';
import { PHRASES, fillPhrase, objectiveFor } from '../data/microcopy';
import { daysBetween, toISODate } from '../utils/date';
import { hashSeed, mulberry32, pick } from '../utils/rng';
import { artworkForDayIndex } from './ChallengeArtworkGenerator';
import { ladderStep } from './AdaptiveCyclingEngine';

/** Índice del día desde que se creó el perfil. Nunca negativo. */
export function dayIndexFor(profile: UserProfile, date: ISODate): number {
  const start = toISODate(new Date(profile.createdAt));
  return Math.max(0, daysBetween(start, date));
}

/** Minutos estimados de un desafío, a un ritmo conservador de 16 km/h. */
function estimateMinutes(distanceKm: number): number {
  return Math.round((distanceKm / 16) * 60);
}

export interface ResolveInput {
  date: ISODate;
  profile: UserProfile;
  progression: ChallengeProgressionState;
  lapDistanceKm: number;
  /** Forzar variante suave sin bajar el nivel. Por defecto, lo que diga la progresión. */
  soften?: boolean;
}

/**
 * Construye el desafío de una fecha. Es una función pura: mismos datos de
 * entrada, mismo resultado. Quien la llama decide si lo persiste.
 */
export function resolveChallenge({ date, profile, progression, lapDistanceKm, soften }: ResolveInput): DailyChallenge {
  const dayIndex = dayIndexFor(profile, date);
  const seed = hashSeed(`${profile.installId}:${date}`);
  const rand = mulberry32(seed);
  const artwork = artworkForDayIndex(profile.installId, dayIndex);

  const step = ladderStep(progression.level);
  const softened = (soften ?? progression.softenNext) && progression.level > 0;
  const type: ChallengeType = softened ? 'RECUPERACION' : step.type;
  const targetLaps = step.laps;
  const targetDistanceKm = Number((targetLaps * lapDistanceKm).toFixed(2));
  const targetDurationMin = type === 'DURACION' ? estimateMinutes(targetDistanceKm) : null;

  const phrase = fillPhrase(pick(rand, PHRASES[type]), {
    laps: targetLaps,
    km: targetDistanceKm,
    minutes: targetDurationMin,
  });

  return {
    date,
    number: dayIndex + 1,
    name: artwork.name,
    phrase,
    type,
    objective: objectiveFor(type, targetLaps, targetDurationMin),
    targetLaps,
    targetDistanceKm,
    targetDurationMin,
    level: progression.level,
    artworkId: artwork.id,
    seed,
    status: 'pending',
    startedAt: null,
    completedAt: null,
    sessionId: null,
    customLaps: null,
  };
}

/** Vueltas efectivas de un desafío (respeta el ajuste manual). */
export const effectiveLaps = (c: DailyChallenge): number => c.customLaps ?? c.targetLaps;

export const effectiveDistanceKm = (c: DailyChallenge, lapDistanceKm: number): number =>
  Number((effectiveLaps(c) * lapDistanceKm).toFixed(2));

/**
 * Un desafío ya persistido se re-lee tal cual, salvo la distancia: si el
 * usuario cambia la longitud de la vuelta, los objetivos futuros y el de hoy
 * se recalculan, pero el nombre, la portada y la frase quedan intactos.
 */
export function refreshDistances(challenge: DailyChallenge, lapDistanceKm: number): DailyChallenge {
  const laps = effectiveLaps(challenge);
  const targetDistanceKm = Number((laps * lapDistanceKm).toFixed(2));
  if (targetDistanceKm === challenge.targetDistanceKm) return challenge;
  return { ...challenge, targetDistanceKm };
}
