/**
 * ChallengeArtworkGenerator (runtime)
 *
 * Las piezas se generan en build (scripts/generate-challenge-art.mjs).
 * Acá sólo se elige, de forma determinística, cuál le toca a cada día:
 * una permutación distinta por ciclo, así no se repite ninguna portada
 * hasta que pasaron las 36.
 */
import { CHALLENGE_ARTWORKS, ARTWORK_COUNT } from '../data/challengeArtwork.generated';
import type { ChallengeArtwork } from '../models/types';
import { hashSeed, mulberry32, shuffle } from '../utils/rng';

export { CHALLENGE_ARTWORKS, ARTWORK_COUNT };

/** Resuelve la ruta de una portada contra la base con la que se publicó la app. */
export const artworkUrl = (art: ChallengeArtwork): string => `${import.meta.env.BASE_URL}${art.src}`;

const permutationCache = new Map<string, ChallengeArtwork[]>();

function permutationFor(installId: string, cycle: number): ChallengeArtwork[] {
  const key = `${installId}:${cycle}`;
  const cached = permutationCache.get(key);
  if (cached) return cached;
  const rand = mulberry32(hashSeed(`lake-artwork:${key}`));
  const perm = shuffle(rand, CHALLENGE_ARTWORKS);
  permutationCache.set(key, perm);
  return perm;
}

/** Portada del día N (0-indexado desde la instalación). */
export function artworkForDayIndex(installId: string, dayIndex: number): ChallengeArtwork {
  const i = Math.max(0, Math.floor(dayIndex));
  const cycle = Math.floor(i / ARTWORK_COUNT);
  const pos = i % ARTWORK_COUNT;
  return permutationFor(installId, cycle)[pos];
}

export function artworkById(id: string): ChallengeArtwork {
  return CHALLENGE_ARTWORKS.find((a) => a.id === id) ?? CHALLENGE_ARTWORKS[0];
}
