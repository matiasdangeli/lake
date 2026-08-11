import type { ChallengeType } from '../models/types';

/**
 * Frases del día. Cortas, con carácter, sin discurso motivacional.
 * Se eligen con la semilla del día, así que no cambian al refrescar.
 */
export const PHRASES: Record<ChallengeType, readonly string[]> = {
  CALIBRACION: [
    'Primero veamos dónde estamos.',
    'Sin apuro. Esto es para medir, no para probar nada.',
    'Una vuelta tranquila y listo.',
  ],
  VUELTAS: [
    'Una vuelta. Sin negociar demasiado.',
    'Hoy el lago te pide {laps}.',
    '{laps}. Drama opcional.',
    'Salí, hacé {laps} y volvé.',
    'Nada raro: {laps} y a casa.',
  ],
  DISTANCIA: [
    'Hoy la cuenta es en kilómetros.',
    '{km} y después vemos.',
    'La distancia manda. El reloj hoy no opina.',
  ],
  RITMO: [
    'Buscá un ritmo que puedas sostener.',
    'Constante gana. No hace falta ir rápido.',
    'Que la segunda mitad se parezca a la primera.',
  ],
  NEGATIVE_SPLIT: [
    'Que la última vuelta sea la más fluida.',
    'Empezá tranquilo. Terminá mejor.',
    'Guardá algo para el final.',
  ],
  DURACION: [
    'Hoy contamos minutos, no vueltas.',
    '{min} minutos arriba de la bici.',
    'El tiempo es el objetivo. El resto acompaña.',
  ],
  CONSTANCIA: [
    'Esto ya empieza a parecer constancia.',
    'Otra más. Así se construye.',
    'No es la mejor salida, es una más.',
  ],
  CONTROL: [
    'Completá el recorrido sin mirar la velocidad.',
    'Hoy no mires el reloj. En serio.',
    'Terminá sintiendo que podrías haber hecho un poco más.',
  ],
  EXPLORACION: [
    'Cambiá algo: la hora, el sentido, el ánimo.',
    'Mismo lago, otra cabeza.',
    'Probá algo distinto y contá cómo salió.',
  ],
  RECUPERACION: [
    'Suave no significa al pedo.',
    'Hoy no hace falta demostrar nada.',
    'Pedaleá. Después vemos.',
    'Vuelta tranquila. Eso es todo.',
  ],
};

/** Objetivo textual del desafío. */
export function objectiveFor(type: ChallengeType, laps: number, minutes: number | null): string {
  const l = laps === 1 ? '1 vuelta' : `${laps} vueltas`;
  switch (type) {
    case 'CALIBRACION':
      return `${l} tranquila, sin forzar`;
    case 'VUELTAS':
      return `Completá ${l}`;
    case 'DISTANCIA':
      return `Completá ${l} sin cortar`;
    case 'RITMO':
      return `${l} manteniendo un ritmo estable`;
    case 'NEGATIVE_SPLIT':
      return `${l}, la última más fluida que la primera`;
    case 'DURACION':
      return minutes ? `Pedaleá ${minutes} minutos` : `${l} sin apurar el final`;
    case 'CONSTANCIA':
      return `${l} para sostener la semana`;
    case 'CONTROL':
      return `${l} sin mirar la velocidad`;
    case 'EXPLORACION':
      return `${l} cambiando algo del recorrido habitual`;
    case 'RECUPERACION':
      return `${l} muy tranquila`;
  }
}

/** Reemplaza los marcadores de la frase con los datos del desafío. */
export function fillPhrase(
  phrase: string,
  { laps, km, minutes }: { laps: number; km: number; minutes: number | null }
): string {
  return phrase
    .replace('{laps}', laps === 1 ? 'una vuelta' : laps === 2 ? 'dos' : laps === 3 ? 'tres' : `${laps}`)
    .replace('{km}', `${km.toFixed(km % 1 === 0 ? 0 : 1).replace('.', ',')} km`)
    .replace('{min}', String(minutes ?? 30));
}

/** Estados vacíos y textos de sistema. */
export const COPY = {
  emptyCalendar: 'Todavía no hay nada acá. Se llena solo.',
  emptyProgress: 'Cuando registres tu primera salida, esto empieza a tener sentido.',
  emptyAchievements: 'Los logros aparecen solos. No hay que ir a buscarlos.',
  offline: 'Sin conexión. Todo lo importante sigue funcionando.',
  completedToday: 'Listo por hoy.',
  skippedToday: 'Hoy no. Mañana hay otro.',
  loadError: 'No se pudieron leer los datos guardados.',
} as const;
