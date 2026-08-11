/** Repositorios: cada colección tiene el suyo. Nada de un objeto gigante. */
import type {
  Achievement,
  AppSettings,
  ChallengeProgressionState,
  CyclingSession,
  DailyChallenge,
  ISODate,
  UserProfile,
  WeightEntry,
} from '../models/types';
import { DEFAULT_LAP_DISTANCE_KM, LAGO_MUNICIPAL } from '../data/location';
import { SCHEMA_VERSION, STORES, clearStore, getAll, kvGet, kvSet, put, putMany, remove } from './db';

const KEYS = {
  profile: 'profile',
  settings: 'settings',
  progression: 'progression',
} as const;

export const defaultSettings = (): AppSettings => ({
  schemaVersion: SCHEMA_VERSION,
  lapDistanceKm: DEFAULT_LAP_DISTANCE_KM,
  distanceUnit: 'km',
  speedUnit: 'km/h',
  weightEnabled: false,
  reduceMotion: false,
});

export const profileRepo = {
  get: () => kvGet<UserProfile>(KEYS.profile),
  save: (p: UserProfile) => kvSet(KEYS.profile, p),
};

export const settingsRepo = {
  async get(): Promise<AppSettings> {
    const stored = await kvGet<AppSettings>(KEYS.settings);
    return { ...defaultSettings(), ...(stored ?? {}) };
  },
  save: (s: AppSettings) => kvSet(KEYS.settings, s),
};

export const progressionRepo = {
  get: () => kvGet<ChallengeProgressionState>(KEYS.progression),
  save: (s: ChallengeProgressionState) => kvSet(KEYS.progression, s),
};

export const sessionRepo = {
  all: () => getAll<CyclingSession>(STORES.sessions),
  save: (s: CyclingSession) => put(STORES.sessions, s),
  saveMany: (s: CyclingSession[]) => putMany(STORES.sessions, s),
  remove: (id: string) => remove(STORES.sessions, id),
  clear: () => clearStore(STORES.sessions),
};

export const challengeRepo = {
  all: () => getAll<DailyChallenge>(STORES.challenges),
  save: (c: DailyChallenge) => put(STORES.challenges, c),
  saveMany: (c: DailyChallenge[]) => putMany(STORES.challenges, c),
  remove: (date: ISODate) => remove(STORES.challenges, date),
  clear: () => clearStore(STORES.challenges),
};

export const achievementRepo = {
  all: () => getAll<Achievement>(STORES.achievements),
  replaceAll: async (list: Achievement[]) => {
    await clearStore(STORES.achievements);
    await putMany(STORES.achievements, list);
  },
};

export const weightRepo = {
  all: () => getAll<WeightEntry>(STORES.weights),
  save: (w: WeightEntry) => put(STORES.weights, w),
  saveMany: (w: WeightEntry[]) => putMany(STORES.weights, w),
  remove: (id: string) => remove(STORES.weights, id),
  clear: () => clearStore(STORES.weights),
};

export const defaultLocation = LAGO_MUNICIPAL;
