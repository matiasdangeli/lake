/**
 * AdaptiveCyclingEngine
 *
 * Decide cuánto puede crecer la carga. La regla que manda sobre todas:
 *
 *   EL NIVEL SÓLO SE MUEVE CUANDO SE COMPLETA UN DESAFÍO.
 *
 * Que pase un día, tres o diez no cambia nada. Lo único que hace el tiempo
 * es cambiar la identidad visual del día (eso lo resuelve DailyChallengeEngine).
 */
import type {
  ChallengeProgressionState,
  ChallengeType,
  CyclingSession,
  DailyChallenge,
  ISODate,
} from '../models/types';

/** Un peldaño de la escalera: cuántas vueltas y con qué foco. */
export interface LadderStep {
  laps: number;
  type: ChallengeType;
}

/** Tres peldaños por cantidad de vueltas: instalar · estabilizar · afinar. */
const PHASES: readonly ChallengeType[] = ['VUELTAS', 'RITMO', 'NEGATIVE_SPLIT'];

export const MAX_LEVEL = 60;

/** level 0 = calibración. 1–3 = 1 vuelta, 4–6 = 2 vueltas, … */
export function ladderStep(level: number): LadderStep {
  const l = Math.max(0, Math.min(MAX_LEVEL, Math.round(level)));
  if (l === 0) return { laps: 1, type: 'CALIBRACION' };
  const laps = 1 + Math.floor((l - 1) / PHASES.length);
  const phase = (l - 1) % PHASES.length;
  const type = laps === 1 && PHASES[phase] === 'NEGATIVE_SPLIT' ? 'DURACION' : PHASES[phase];
  return { laps, type };
}

/** Primer nivel cuyo peldaño tiene esa cantidad de vueltas. */
export function levelForLaps(laps: number): number {
  const n = Math.max(1, Math.round(laps));
  return 1 + (n - 1) * PHASES.length;
}

export function initialProgression(baselineLaps: number | null, now = new Date()): ChallengeProgressionState {
  const level = baselineLaps == null ? 0 : levelForLaps(baselineLaps);
  const step = ladderStep(level);
  return {
    level,
    targetLaps: step.laps,
    focus: step.type,
    consecutiveCompleted: 0,
    consecutiveMissed: 0,
    softenNext: false,
    lastEvaluatedSessionId: null,
    lastEvaluatedDate: null,
    updatedAt: now.toISOString(),
    history: [],
  };
}

function withLevel(
  state: ChallengeProgressionState,
  level: number,
  reason: string,
  date: ISODate,
  now: Date
): ChallengeProgressionState {
  const clamped = Math.max(0, Math.min(MAX_LEVEL, level));
  const step = ladderStep(clamped);
  return {
    ...state,
    level: clamped,
    targetLaps: step.laps,
    focus: step.type,
    updatedAt: now.toISOString(),
    history:
      clamped === state.level
        ? state.history
        : [...state.history, { at: now.toISOString(), date, from: state.level, to: clamped, reason }].slice(-80),
  };
}

export interface EvaluationInput {
  state: ChallengeProgressionState;
  challenge: DailyChallenge;
  session: CyclingSession;
  now?: Date;
}

export interface EvaluationResult {
  state: ChallengeProgressionState;
  /** Explicación breve, se muestra como insight. */
  reason: string;
  delta: number;
}

/**
 * Se llama UNA vez, cuando un desafío pasa a completado.
 * Cambia una sola variable por vez y nunca sube si algo salió mal.
 */
export function evaluateCompletion({ state, challenge, session, now = new Date() }: EvaluationInput): EvaluationResult {
  const target = challenge.customLaps ?? challenge.targetLaps;
  const reachedTarget = session.laps >= target;
  const hasDiscomfort = Boolean(session.discomfort && session.discomfort.trim());
  const hardEffort = session.effort >= 8;
  const badFeeling = session.feeling === 'muy_mal' || session.feeling === 'pesado';
  const easyEffort = session.effort <= 4;
  const goodFeeling = session.feeling === 'bien' || session.feeling === 'excelente';

  const base: ChallengeProgressionState = {
    ...state,
    consecutiveCompleted: state.consecutiveCompleted + 1,
    consecutiveMissed: 0,
    softenNext: false,
    lastEvaluatedSessionId: session.id,
    lastEvaluatedDate: challenge.date,
  };

  if (hasDiscomfort) {
    return {
      state: { ...withLevel(base, state.level, 'molestias', challenge.date, now), softenNext: true },
      reason: 'Registraste molestias. El próximo desafío se mantiene y baja la intensidad.',
      delta: 0,
    };
  }

  if (!reachedTarget) {
    return {
      state: withLevel(base, state.level, 'objetivo incompleto', challenge.date, now),
      reason: 'No llegaste al objetivo, así que la carga se mantiene.',
      delta: 0,
    };
  }

  if (hardEffort || badFeeling) {
    return {
      state: withLevel(base, state.level, 'esfuerzo alto', challenge.date, now),
      reason: 'Tu esfuerzo subió bastante. El próximo desafío se mantiene.',
      delta: 0,
    };
  }

  // Salto doble sólo si sobró de verdad: muy fácil, buena sensación y más
  // vueltas de las pedidas. Cualquier otra cosa avanza de a un peldaño.
  const overshoot = session.laps > target;
  const doubleStep = easyEffort && goodFeeling && overshoot && state.consecutiveCompleted >= 1;
  const delta = doubleStep ? 2 : 1;

  return {
    state: withLevel(base, state.level + delta, doubleStep ? 'sobró margen' : 'avance normal', challenge.date, now),
    reason: doubleStep
      ? 'Te sobró margen. El próximo sube un poco más.'
      : 'Completado sin drama. El próximo sube apenas.',
    delta,
  };
}

/**
 * Días consecutivos, hasta ayer, con desafío sin completar.
 *
 * Se DERIVA del historial en vez de acumularse: así, recargar la app o abrirla
 * tres veces el mismo día no puede alterar nada. Y sobre todo: esto no mueve
 * el nivel, sólo decide si el próximo desafío se propone más suave.
 */
export function deriveMissStreak(
  challenges: Pick<DailyChallenge, 'date' | 'status'>[],
  today: ISODate
): number {
  const past = challenges
    .filter((c) => c.date < today)
    .sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  let cursor = addDaysLocal(today, -1);
  for (const c of past) {
    if (c.date !== cursor) break;
    if (c.status === 'completed') break;
    streak++;
    cursor = addDaysLocal(cursor, -1);
  }
  return streak;
}

function addDaysLocal(iso: ISODate, days: number): ISODate {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

/** Refresca los contadores derivados sin tocar el nivel. */
export function withDerivedStreaks(
  state: ChallengeProgressionState,
  challenges: Pick<DailyChallenge, 'date' | 'status'>[],
  today: ISODate
): ChallengeProgressionState {
  const consecutiveMissed = deriveMissStreak(challenges, today);
  const softenNext = consecutiveMissed >= 3;
  if (state.consecutiveMissed === consecutiveMissed && state.softenNext === softenNext) return state;
  return { ...state, consecutiveMissed, softenNext };
}

/** Deshacer un completado: revierte el efecto en la progresión. */
export function revertCompletion(
  state: ChallengeProgressionState,
  challenge: DailyChallenge,
  now = new Date()
): ChallengeProgressionState {
  const last = state.history[state.history.length - 1];
  const shouldRollback = last && last.date === challenge.date;
  const level = shouldRollback ? last.from : state.level;
  const step = ladderStep(level);
  return {
    ...state,
    level,
    targetLaps: step.laps,
    focus: step.type,
    consecutiveCompleted: Math.max(0, state.consecutiveCompleted - 1),
    softenNext: false,
    lastEvaluatedSessionId: null,
    lastEvaluatedDate: null,
    updatedAt: now.toISOString(),
    history: shouldRollback ? state.history.slice(0, -1) : state.history,
  };
}
