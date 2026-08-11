/** Modelo de datos de LAKE. Todo lo que se persiste vive acá. */

/** Fecha local en formato YYYY-MM-DD. Nunca UTC: el día cambia a las 00:00 locales. */
export type ISODate = string;

/** Instante ISO 8601 completo. */
export type ISOInstant = string;

export type ChallengeType =
  | 'CALIBRACION'
  | 'VUELTAS'
  | 'DISTANCIA'
  | 'RITMO'
  | 'NEGATIVE_SPLIT'
  | 'DURACION'
  | 'CONSTANCIA'
  | 'CONTROL'
  | 'EXPLORACION'
  | 'RECUPERACION';

export type ChallengeStatus = 'pending' | 'completed' | 'skipped';

export type Feeling = 'muy_mal' | 'pesado' | 'normal' | 'bien' | 'excelente';

export interface Location {
  id: string;
  name: string;
  city: string;
  /** Distancia de una vuelta completa al lago. Configurable. */
  lapDistanceKm: number;
  lat: number;
  lng: number;
  mapsUrl: string;
}

export interface UserProfile {
  /** Identificador estable de la instalación: semilla de la identidad diaria. */
  installId: string;
  name: string;
  locationId: string;
  goal: string;
  /** Vueltas que declaró cómodas en el onboarding. null = "no sé todavía". */
  baselineLaps: number | null;
  createdAt: ISOInstant;
  onboardedAt: ISOInstant | null;
}

export interface AppSettings {
  schemaVersion: number;
  lapDistanceKm: number;
  distanceUnit: 'km';
  speedUnit: 'km/h';
  weightEnabled: boolean;
  reduceMotion: boolean;
}

export interface Lap {
  index: number;
  distanceKm: number;
  durationSec: number;
  avgSpeedKmh: number | null;
}

export interface CyclingSession {
  id: string;
  date: ISODate;
  /** HH:MM local. */
  time: string;
  challengeId: ISODate | null;
  laps: number;
  distanceKm: number;
  durationSec: number;
  avgSpeedKmh: number | null;
  maxSpeedKmh: number | null;
  avgHr: number | null;
  maxHr: number | null;
  calories: number | null;
  cadence: number | null;
  /** 1 = muy fácil, 10 = máximo. */
  effort: number;
  feeling: Feeling;
  discomfort: string | null;
  notes: string | null;
  lapDetails: Lap[];
  createdAt: ISOInstant;
  updatedAt: ISOInstant;
}

/** Portada de un desafío. Generada en build por ChallengeArtworkGenerator. */
export interface ChallengeArtwork {
  id: string;
  slug: string;
  name: string;
  palette: string;
  motif: string;
  /** Color dominante — tiñe el resplandor de la tarjeta. */
  tint: string;
  glow: string;
  ink: string;
  /** Miniatura embebida para el fade-in. */
  lqip: string;
  src: string;
}

/**
 * El desafío de un día. Se resuelve una sola vez y se persiste: la identidad
 * de una fecha nunca cambia, aunque después crezca el catálogo.
 */
export interface DailyChallenge {
  /** La fecha es la clave. */
  date: ISODate;
  /** Número correlativo mostrado como #NN. */
  number: number;
  name: string;
  phrase: string;
  type: ChallengeType;
  objective: string;
  targetLaps: number;
  targetDistanceKm: number;
  targetDurationMin: number | null;
  /** Nivel de la escalera de progresión con el que se generó. */
  level: number;
  artworkId: string;
  seed: number;
  status: ChallengeStatus;
  /** Momento en que se tocó COMENZAR. No cambia el estado, sólo lo informa. */
  startedAt: ISOInstant | null;
  completedAt: ISOInstant | null;
  sessionId: string | null;
  /** Vueltas ajustadas a mano por el usuario, si las hubo. */
  customLaps: number | null;
}

export interface ProgressionEvent {
  at: ISOInstant;
  date: ISODate;
  from: number;
  to: number;
  reason: string;
}

export interface ChallengeProgressionState {
  /** Índice en la escalera. 0 = calibración. */
  level: number;
  targetLaps: number;
  focus: ChallengeType;
  consecutiveCompleted: number;
  consecutiveMissed: number;
  /** Fuerza que el próximo desafío sea suave sin bajar el nivel. */
  softenNext: boolean;
  lastEvaluatedSessionId: string | null;
  lastEvaluatedDate: ISODate | null;
  updatedAt: ISOInstant;
  history: ProgressionEvent[];
}

export type AchievementId =
  | 'primera_vuelta'
  | 'doble'
  | 'triple'
  | 'cuatro'
  | '10k'
  | '20k'
  | 'media_hora'
  | 'una_hora'
  | 'constancia'
  | 'vuelta_rapida'
  | 'racha';

export interface AchievementDef {
  id: AchievementId;
  name: string;
  detail: string;
}

export interface Achievement {
  id: AchievementId;
  unlockedAt: ISOInstant;
  date: ISODate;
  sessionId: string | null;
}

export interface WeightEntry {
  id: string;
  date: ISODate;
  kg: number;
  createdAt: ISOInstant;
}

export interface Insight {
  id: string;
  text: string;
  tone: 'neutral' | 'up' | 'hold';
}

/** Formato de export/import. */
export interface BackupFile {
  app: 'LAKE';
  schemaVersion: number;
  exportedAt: ISOInstant;
  profile: UserProfile | null;
  settings: AppSettings;
  sessions: CyclingSession[];
  challenges: DailyChallenge[];
  achievements: Achievement[];
  weights: WeightEntry[];
  progression: ChallengeProgressionState | null;
}
