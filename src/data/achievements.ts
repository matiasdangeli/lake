import type { AchievementDef, AchievementId } from '../models/types';

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'primera_vuelta', name: 'PRIMERA VUELTA', detail: 'Tu primer circuito completo' },
  { id: 'doble', name: 'DOBLE', detail: '2 vueltas en una salida' },
  { id: 'triple', name: 'TRIPLE', detail: '3 vueltas en una salida' },
  { id: 'cuatro', name: 'CUATRO', detail: '4 vueltas en una salida' },
  { id: '10k', name: '10K', detail: 'Una salida de al menos 10 km' },
  { id: '20k', name: '20K', detail: 'Una salida de al menos 20 km' },
  { id: 'media_hora', name: 'MEDIA HORA', detail: '30 minutos pedaleando' },
  { id: 'una_hora', name: 'UNA HORA', detail: '60 minutos pedaleando' },
  { id: 'constancia', name: 'CONSTANCIA', detail: '3 salidas en una misma semana' },
  { id: 'vuelta_rapida', name: 'VUELTA RÁPIDA', detail: 'Nueva mejor velocidad media' },
  { id: 'racha', name: 'RACHA', detail: '3 desafíos completados seguidos' },
];

export const ACHIEVEMENT_BY_ID: Record<AchievementId, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a])
) as Record<AchievementId, AchievementDef>;
