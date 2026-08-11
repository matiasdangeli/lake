/** Export / import de todos los datos, en un JSON legible. */
import type { BackupFile } from '../models/types';
import { SCHEMA_VERSION } from '../repositories/db';
import {
  achievementRepo, challengeRepo, defaultSettings, progressionRepo,
  profileRepo, sessionRepo, settingsRepo, weightRepo,
} from '../repositories';

export async function buildBackup(): Promise<BackupFile> {
  const [profile, settings, sessions, challenges, achievements, weights, progression] = await Promise.all([
    profileRepo.get(),
    settingsRepo.get(),
    sessionRepo.all(),
    challengeRepo.all(),
    achievementRepo.all(),
    weightRepo.all(),
    progressionRepo.get(),
  ]);
  return {
    app: 'LAKE',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    profile,
    settings,
    sessions,
    challenges,
    achievements,
    weights,
    progression,
  };
}

export function backupFilename(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `lake-backup-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}.json`;
}

export async function downloadBackup(): Promise<void> {
  const data = await buildBackup();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFilename();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export class BackupError extends Error {}

/** Valida la forma antes de tocar nada. Un archivo roto no debe pisar datos buenos. */
export function parseBackup(raw: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new BackupError('El archivo no es un JSON válido.');
  }
  if (typeof data !== 'object' || data === null) throw new BackupError('El archivo está vacío.');
  const b = data as Partial<BackupFile>;
  if (b.app !== 'LAKE') throw new BackupError('Ese backup no es de LAKE.');
  if (typeof b.schemaVersion !== 'number') throw new BackupError('Falta la versión del backup.');
  if (b.schemaVersion > SCHEMA_VERSION) {
    throw new BackupError('El backup es de una versión más nueva de LAKE.');
  }
  for (const key of ['sessions', 'challenges', 'achievements', 'weights'] as const) {
    if (b[key] != null && !Array.isArray(b[key])) throw new BackupError(`El campo "${key}" está corrupto.`);
  }
  return {
    app: 'LAKE',
    schemaVersion: b.schemaVersion,
    exportedAt: b.exportedAt ?? new Date().toISOString(),
    profile: b.profile ?? null,
    settings: { ...defaultSettings(), ...(b.settings ?? {}) },
    sessions: b.sessions ?? [],
    challenges: b.challenges ?? [],
    achievements: b.achievements ?? [],
    weights: b.weights ?? [],
    progression: b.progression ?? null,
  };
}

/** Reemplaza todo el contenido por el del backup. */
export async function restoreBackup(backup: BackupFile): Promise<void> {
  await Promise.all([sessionRepo.clear(), challengeRepo.clear(), weightRepo.clear()]);
  await Promise.all([
    backup.profile ? profileRepo.save(backup.profile) : Promise.resolve(),
    settingsRepo.save({ ...backup.settings, schemaVersion: SCHEMA_VERSION }),
    backup.progression ? progressionRepo.save(backup.progression) : Promise.resolve(),
    sessionRepo.saveMany(backup.sessions),
    challengeRepo.saveMany(backup.challenges),
    weightRepo.saveMany(backup.weights),
    achievementRepo.replaceAll(backup.achievements),
  ]);
}
