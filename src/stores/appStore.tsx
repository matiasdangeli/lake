/**
 * Estado de la aplicación.
 *
 * Un único proveedor que orquesta repositorios y motores. Las pantallas no
 * hablan con IndexedDB ni con los engines: piden acciones acá.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import type {
  Achievement, AchievementId, AppSettings, ChallengeProgressionState, CyclingSession,
  DailyChallenge, ISODate, UserProfile, WeightEntry,
} from '../models/types';
import {
  achievementRepo, challengeRepo, defaultSettings, progressionRepo, profileRepo,
  sessionRepo, settingsRepo, weightRepo,
} from '../repositories';
import { storageMode, wipe } from '../repositories/db';
import {
  evaluateCompletion, initialProgression, revertCompletion, withDerivedStreaks,
} from '../engines/AdaptiveCyclingEngine';
import { refreshDistances, resolveChallenge } from '../engines/DailyChallengeEngine';
import { computeAchievements, newlyUnlocked } from '../engines/AchievementEngine';
import { LAGO_MUNICIPAL } from '../data/location';
import { createId } from '../utils/id';
import { msUntilMidnight, nowTime, todayISO } from '../utils/date';
import { avgSpeed } from '../utils/format';
import { parseBackup, restoreBackup } from '../services/backup';

export interface SessionInput {
  date: ISODate;
  time: string;
  laps: number;
  distanceKm: number;
  durationSec: number;
  maxSpeedKmh: number | null;
  avgHr: number | null;
  maxHr: number | null;
  calories: number | null;
  cadence: number | null;
  effort: number;
  feeling: CyclingSession['feeling'];
  discomfort: string | null;
  notes: string | null;
  lapDetails: CyclingSession['lapDetails'];
}

interface AppState {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  profile: UserProfile | null;
  settings: AppSettings;
  progression: ChallengeProgressionState;
  sessions: CyclingSession[];
  challenges: DailyChallenge[];
  achievements: Achievement[];
  weights: WeightEntry[];
  today: ISODate;
  celebrating: AchievementId[];
}

interface AppActions {
  completeOnboarding(input: { name: string; baselineLaps: number | null; lapDistanceKm: number }): Promise<void>;
  startChallenge(): Promise<void>;
  completeChallenge(input: SessionInput): Promise<void>;
  undoCompletion(): Promise<void>;
  skipToday(): Promise<void>;
  unskipToday(): Promise<void>;
  adjustLaps(laps: number | null): Promise<void>;
  logSession(input: SessionInput): Promise<void>;
  updateSession(id: string, input: SessionInput): Promise<void>;
  deleteSession(id: string): Promise<void>;
  saveWeight(kg: number, date?: ISODate): Promise<void>;
  deleteWeight(id: string): Promise<void>;
  updateSettings(patch: Partial<AppSettings>): Promise<void>;
  updateProfile(patch: Partial<UserProfile>): Promise<void>;
  importBackupText(raw: string): Promise<void>;
  resetApp(): Promise<void>;
  dismissCelebration(): void;
}

type AppContextValue = AppState & {
  actions: AppActions;
  todayChallenge: DailyChallenge | null;
  storage: ReturnType<typeof storageMode>;
};

const AppContext = createContext<AppContextValue | null>(null);

const toSession = (input: SessionInput, base?: CyclingSession): CyclingSession => {
  const now = new Date().toISOString();
  return {
    id: base?.id ?? createId('s'),
    date: input.date,
    time: input.time,
    challengeId: base?.challengeId ?? null,
    laps: input.laps,
    distanceKm: input.distanceKm,
    durationSec: input.durationSec,
    avgSpeedKmh: avgSpeed(input.distanceKm, input.durationSec),
    maxSpeedKmh: input.maxSpeedKmh,
    avgHr: input.avgHr,
    maxHr: input.maxHr,
    calories: input.calories,
    cadence: input.cadence,
    effort: input.effort,
    feeling: input.feeling,
    discomfort: input.discomfort,
    notes: input.notes,
    lapDetails: input.lapDetails,
    createdAt: base?.createdAt ?? now,
    updatedAt: now,
  };
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    status: 'loading',
    error: null,
    profile: null,
    settings: defaultSettings(),
    progression: initialProgression(null),
    sessions: [],
    challenges: [],
    achievements: [],
    weights: [],
    today: todayISO(),
    celebrating: [],
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  /* ---------------------------------------------------------------- */
  /* Carga inicial                                                     */
  /* ---------------------------------------------------------------- */

  const hydrate = useCallback(async () => {
    try {
      const [profile, settings, sessions, storedChallenges, achievements, weights, storedProgression] =
        await Promise.all([
          profileRepo.get(), settingsRepo.get(), sessionRepo.all(), challengeRepo.all(),
          achievementRepo.all(), weightRepo.all(), progressionRepo.get(),
        ]);

      const today = todayISO();
      const progression = storedProgression ?? initialProgression(profile?.baselineLaps ?? null);
      const { challenges, progression: synced } = await ensureToday({
        today, profile, progression, settings, stored: storedChallenges,
      });

      setState({
        status: 'ready',
        error: null,
        profile,
        settings,
        progression: synced,
        sessions,
        challenges,
        achievements,
        weights,
        today,
        celebrating: [],
      });
    } catch (e) {
      console.error('[LAKE] no se pudo cargar el estado', e);
      setState((s) => ({ ...s, status: 'error', error: (e as Error).message }));
    }
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  /* ---------------------------------------------------------------- */
  /* Cambio de día a las 00:00 locales                                 */
  /* ---------------------------------------------------------------- */

  const rollDay = useCallback(async () => {
    const s = stateRef.current;
    if (s.status !== 'ready' || !s.profile) return;
    const today = todayISO();
    const { challenges, progression } = await ensureToday({
      today, profile: s.profile, progression: s.progression, settings: s.settings, stored: s.challenges,
    });
    setState((prev) => ({ ...prev, today, challenges, progression }));
  }, []);

  useEffect(() => {
    if (state.status !== 'ready') return;
    // Un timer para el cambio de día, y además revisamos al volver a la app:
    // no confiamos en que el timeout sobreviva horas en segundo plano.
    let timer = window.setTimeout(function tick() {
      void rollDay();
      timer = window.setTimeout(tick, msUntilMidnight());
    }, msUntilMidnight());

    const onWake = () => {
      if (document.visibilityState === 'visible' && todayISO() !== stateRef.current.today) void rollDay();
    };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, [state.status, rollDay]);

  /* ---------------------------------------------------------------- */
  /* Acciones                                                          */
  /* ---------------------------------------------------------------- */

  const patchChallenge = useCallback(async (date: ISODate, patch: Partial<DailyChallenge>) => {
    const current = stateRef.current.challenges.find((c) => c.date === date);
    if (!current) return;
    const next = { ...current, ...patch };
    await challengeRepo.save(next);
    setState((s) => ({ ...s, challenges: s.challenges.map((c) => (c.date === date ? next : c)) }));
  }, []);

  const recomputeAchievements = useCallback(
    async (sessions: CyclingSession[], challenges: DailyChallenge[]) => {
      const before = stateRef.current.achievements;
      const after = computeAchievements({ sessions, challenges });
      await achievementRepo.replaceAll(after);
      const fresh = newlyUnlocked(before, after);
      setState((s) => ({ ...s, achievements: after, celebrating: fresh.length ? fresh : s.celebrating }));
    },
    []
  );

  const actions = useMemo<AppActions>(() => ({
    async completeOnboarding({ name, baselineLaps, lapDistanceKm }) {
      const now = new Date();
      const profile: UserProfile = {
        installId: createId('lake'),
        name: name.trim(),
        locationId: LAGO_MUNICIPAL.id,
        goal: 'Aumentar de a poco las vueltas al lago',
        baselineLaps,
        createdAt: now.toISOString(),
        onboardedAt: now.toISOString(),
      };
      const settings: AppSettings = { ...stateRef.current.settings, lapDistanceKm };
      const progression = initialProgression(baselineLaps, now);
      await Promise.all([profileRepo.save(profile), settingsRepo.save(settings), progressionRepo.save(progression)]);

      const today = todayISO();
      const challenge = resolveChallenge({ date: today, profile, progression, lapDistanceKm });
      await challengeRepo.save(challenge);
      setState((s) => ({ ...s, profile, settings, progression, challenges: [challenge], today }));
    },

    async startChallenge() {
      const { today, challenges } = stateRef.current;
      const c = challenges.find((x) => x.date === today);
      if (!c || c.status !== 'pending' || c.startedAt) return;
      await patchChallenge(today, { startedAt: new Date().toISOString() });
    },

    async completeChallenge(input) {
      const s = stateRef.current;
      const challenge = s.challenges.find((c) => c.date === s.today);
      if (!challenge || challenge.status === 'completed') return;

      const session = toSession(input);
      session.challengeId = challenge.date;
      await sessionRepo.save(session);

      const now = new Date();
      const completed: DailyChallenge = {
        ...challenge,
        status: 'completed',
        completedAt: now.toISOString(),
        sessionId: session.id,
      };
      const { state: progression } = evaluateCompletion({ state: s.progression, challenge, session, now });
      await Promise.all([challengeRepo.save(completed), progressionRepo.save(progression)]);

      const sessions = [...s.sessions, session];
      const challenges = s.challenges.map((c) => (c.date === completed.date ? completed : c));
      setState((prev) => ({ ...prev, sessions, challenges, progression }));
      await recomputeAchievements(sessions, challenges);
    },

    async undoCompletion() {
      const s = stateRef.current;
      const challenge = s.challenges.find((c) => c.date === s.today);
      if (!challenge || challenge.status !== 'completed') return;

      const reverted: DailyChallenge = { ...challenge, status: 'pending', completedAt: null, sessionId: null };
      const progression = revertCompletion(s.progression, challenge);
      const sessions = challenge.sessionId ? s.sessions.filter((x) => x.id !== challenge.sessionId) : s.sessions;

      if (challenge.sessionId) await sessionRepo.remove(challenge.sessionId);
      await Promise.all([challengeRepo.save(reverted), progressionRepo.save(progression)]);

      const challenges = s.challenges.map((c) => (c.date === reverted.date ? reverted : c));
      setState((prev) => ({ ...prev, sessions, challenges, progression }));
      await recomputeAchievements(sessions, challenges);
    },

    async skipToday() {
      await patchChallenge(stateRef.current.today, { status: 'skipped' });
    },

    async unskipToday() {
      await patchChallenge(stateRef.current.today, { status: 'pending' });
    },

    async adjustLaps(laps) {
      const s = stateRef.current;
      const c = s.challenges.find((x) => x.date === s.today);
      if (!c) return;
      const effective = laps ?? c.targetLaps;
      await patchChallenge(s.today, {
        customLaps: laps,
        targetDistanceKm: Number((effective * s.settings.lapDistanceKm).toFixed(2)),
      });
    },

    async logSession(input) {
      const s = stateRef.current;
      const session = toSession(input);
      await sessionRepo.save(session);
      const sessions = [...s.sessions, session];
      setState((prev) => ({ ...prev, sessions }));
      await recomputeAchievements(sessions, s.challenges);
    },

    async updateSession(id, input) {
      const s = stateRef.current;
      const base = s.sessions.find((x) => x.id === id);
      if (!base) return;
      const session = toSession(input, base);
      await sessionRepo.save(session);
      const sessions = s.sessions.map((x) => (x.id === id ? session : x));
      setState((prev) => ({ ...prev, sessions }));
      await recomputeAchievements(sessions, s.challenges);
    },

    async deleteSession(id) {
      const s = stateRef.current;
      const session = s.sessions.find((x) => x.id === id);
      await sessionRepo.remove(id);
      const sessions = s.sessions.filter((x) => x.id !== id);

      // Si esa salida cerraba un desafío, el desafío vuelve a estar pendiente.
      let challenges = s.challenges;
      if (session?.challengeId) {
        const c = s.challenges.find((x) => x.date === session.challengeId);
        if (c) {
          const reverted: DailyChallenge = { ...c, status: 'pending', completedAt: null, sessionId: null };
          await challengeRepo.save(reverted);
          challenges = s.challenges.map((x) => (x.date === reverted.date ? reverted : x));
        }
      }
      setState((prev) => ({ ...prev, sessions, challenges }));
      await recomputeAchievements(sessions, challenges);
    },

    async saveWeight(kg, date = todayISO()) {
      const s = stateRef.current;
      const existing = s.weights.find((w) => w.date === date);
      const entry: WeightEntry = existing
        ? { ...existing, kg }
        : { id: createId('w'), date, kg, createdAt: new Date().toISOString() };
      await weightRepo.save(entry);
      setState((prev) => ({
        ...prev,
        weights: existing ? prev.weights.map((w) => (w.id === entry.id ? entry : w)) : [...prev.weights, entry],
      }));
    },

    async deleteWeight(id) {
      await weightRepo.remove(id);
      setState((prev) => ({ ...prev, weights: prev.weights.filter((w) => w.id !== id) }));
    },

    async updateSettings(patch) {
      const s = stateRef.current;
      const settings = { ...s.settings, ...patch };
      await settingsRepo.save(settings);

      // Cambiar la vuelta recalcula distancias objetivo, nunca la identidad.
      let challenges = s.challenges;
      if (patch.lapDistanceKm != null && patch.lapDistanceKm !== s.settings.lapDistanceKm) {
        challenges = s.challenges.map((c) =>
          c.status === 'completed' ? c : refreshDistances(c, settings.lapDistanceKm)
        );
        await challengeRepo.saveMany(challenges.filter((c) => c.status !== 'completed'));
      }
      setState((prev) => ({ ...prev, settings, challenges }));
    },

    async updateProfile(patch) {
      const s = stateRef.current;
      if (!s.profile) return;
      const profile = { ...s.profile, ...patch };
      await profileRepo.save(profile);
      setState((prev) => ({ ...prev, profile }));
    },

    async importBackupText(raw) {
      const backup = parseBackup(raw);
      await restoreBackup(backup);
      await hydrate();
    },

    async resetApp() {
      await wipe();
      setState({
        status: 'ready', error: null, profile: null, settings: defaultSettings(),
        progression: initialProgression(null), sessions: [], challenges: [],
        achievements: [], weights: [], today: todayISO(), celebrating: [],
      });
    },

    dismissCelebration() {
      setState((s) => (s.celebrating.length ? { ...s, celebrating: [] } : s));
    },
  }), [hydrate, patchChallenge, recomputeAchievements]);

  const todayChallenge = useMemo(
    () => state.challenges.find((c) => c.date === state.today) ?? null,
    [state.challenges, state.today]
  );

  const value = useMemo<AppContextValue>(
    () => ({ ...state, actions, todayChallenge, storage: storageMode() }),
    [state, actions, todayChallenge]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/**
 * Garantiza que exista el desafío de hoy. Si falta, lo resuelve y lo guarda.
 * Los contadores de racha se derivan del historial: abrir la app no altera
 * nunca el nivel de progresión.
 */
async function ensureToday({
  today, profile, progression, settings, stored,
}: {
  today: ISODate;
  profile: UserProfile | null;
  progression: ChallengeProgressionState;
  settings: AppSettings;
  stored: DailyChallenge[];
}): Promise<{ challenges: DailyChallenge[]; progression: ChallengeProgressionState }> {
  if (!profile) return { challenges: stored, progression };

  const synced = withDerivedStreaks(progression, stored, today);
  if (synced !== progression) await progressionRepo.save(synced);

  const existing = stored.find((c) => c.date === today);
  if (existing) {
    const refreshed = existing.status === 'completed' ? existing : refreshDistances(existing, settings.lapDistanceKm);
    if (refreshed !== existing) await challengeRepo.save(refreshed);
    return {
      challenges: stored.map((c) => (c.date === today ? refreshed : c)),
      progression: synced,
    };
  }

  const challenge = resolveChallenge({
    date: today,
    profile,
    progression: synced,
    lapDistanceKm: settings.lapDistanceKm,
  });
  await challengeRepo.save(challenge);
  return { challenges: [...stored, challenge], progression: synced };
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp fuera de AppProvider');
  return ctx;
}

/** Valores por defecto para prellenar el sheet de registro. */
export function draftFromChallenge(
  challenge: DailyChallenge | null,
  lapDistanceKm: number
): Pick<SessionInput, 'date' | 'time' | 'laps' | 'distanceKm'> {
  const laps = challenge ? (challenge.customLaps ?? challenge.targetLaps) : 1;
  return {
    date: challenge?.date ?? todayISO(),
    time: nowTime(),
    laps,
    distanceKm: Number((laps * lapDistanceKm).toFixed(2)),
  };
}
