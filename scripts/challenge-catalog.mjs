/**
 * Catálogo de desafíos: nombre + identidad visual.
 *
 * Cada entrada es una "portada": nombre editorial, paleta y motivo.
 * El orden es estable — el índice se usa como id de artwork (challenge-01…36),
 * así que se puede agregar al final, nunca reordenar.
 */

export const PALETTES = {
  alba:      { a: '#0E141D', b: '#263145', c: '#4B5A6E', glow: '#E9A06B', light: '#F5CFA8', ink: '#070A0E' },
  bruma:     { a: '#171D23', b: '#333C45', c: '#59656F', glow: '#B9C6CE', light: '#DCE6EC', ink: '#0C1015' },
  noche:     { a: '#04070B', b: '#0B1420', c: '#16283A', glow: '#7FA8C9', light: '#C3D6E6', ink: '#020406' },
  helada:    { a: '#0C141E', b: '#1D2F3F', c: '#2F4B60', glow: '#9FD3EC', light: '#DFF2FB', ink: '#070C12' },
  ocaso:     { a: '#100D16', b: '#361F31', c: '#57314A', glow: '#D97A63', light: '#F2AE93', ink: '#08060B' },
  tormenta:  { a: '#0E1216', b: '#262D34', c: '#3E474F', glow: '#8FA0AC', light: '#C6D2DA', ink: '#070A0C' },
  junco:     { a: '#0A120F', b: '#1A2A22', c: '#2C4437', glow: '#8FC0A0', light: '#CFE7D9', ink: '#050A08' },
  asfalto:   { a: '#0A0B0C', b: '#1F2327', c: '#343A40', glow: '#A7B2BA', light: '#DDE4E8', ink: '#050607' },
  mediodia:  { a: '#141E28', b: '#334455', c: '#4E6577', glow: '#DCEAF2', light: '#F4FAFD', ink: '#0B121A' },
  ambar:     { a: '#110E11', b: '#2F231C', c: '#4A382B', glow: '#E0A45C', light: '#F5CE96', ink: '#080607' },
};

/**
 * motif  -> función de composición en generate-challenge-art.mjs
 * mood   -> se expone a la app para teñir la UI de ese día
 */
export const CHALLENGE_CATALOG = [
  { slug: 'bruma',    name: 'BRUMA',    palette: 'bruma',    motif: 'fog' },
  { slug: 'faro',     name: 'FARO',     palette: 'noche',    motif: 'beacon' },
  { slug: 'orilla',   name: 'ORILLA',   palette: 'alba',     motif: 'shore' },
  { slug: 'pulso',    name: 'PULSO',    palette: 'ocaso',    motif: 'pulse' },
  { slug: 'deriva',   name: 'DERIVA',   palette: 'helada',   motif: 'drift' },
  { slug: 'norte',    name: 'NORTE',    palette: 'helada',   motif: 'north' },
  { slug: 'linea',    name: 'LÍNEA',    palette: 'asfalto',  motif: 'line' },
  { slug: 'rocio',    name: 'ROCÍO',    palette: 'junco',    motif: 'dew' },
  { slug: 'marea',    name: 'MAREA',    palette: 'helada',   motif: 'tide' },
  { slug: 'eco',      name: 'ECO',      palette: 'noche',    motif: 'echo' },
  { slug: 'niebla',   name: 'NIEBLA',   palette: 'bruma',    motif: 'mist' },
  { slug: 'vertice',  name: 'VÉRTICE',  palette: 'asfalto',  motif: 'vertex' },
  { slug: 'luz',      name: 'LUZ',      palette: 'ambar',    motif: 'lowsun' },
  { slug: 'ruido',    name: 'RUIDO',    palette: 'tormenta', motif: 'static' },
  { slug: 'calma',    name: 'CALMA',    palette: 'alba',     motif: 'calm' },
  { slug: 'viento',   name: 'VIENTO',   palette: 'tormenta', motif: 'wind' },
  { slug: 'sombra',   name: 'SOMBRA',   palette: 'ambar',    motif: 'longshadow' },
  { slug: 'radio',    name: 'RADIO',    palette: 'asfalto',  motif: 'spokes' },
  { slug: 'cero',     name: 'CERO',     palette: 'mediodia', motif: 'zero' },
  { slug: 'trazo',    name: 'TRAZO',    palette: 'noche',    motif: 'stroke' },
  { slug: 'vuelta',   name: 'VUELTA',   palette: 'helada',   motif: 'loop' },
  { slug: 'borde',    name: 'BORDE',    palette: 'junco',    motif: 'edge' },
  { slug: 'lluvia',   name: 'LLUVIA',   palette: 'tormenta', motif: 'rain' },
  { slug: 'alba',     name: 'ALBA',     palette: 'alba',     motif: 'dawn' },
  { slug: 'ocaso',    name: 'OCASO',    palette: 'ocaso',    motif: 'dusk' },
  { slug: 'junco',    name: 'JUNCO',    palette: 'junco',    motif: 'reeds' },
  { slug: 'estela',   name: 'ESTELA',   palette: 'ambar',    motif: 'wake' },
  { slug: 'quieto',   name: 'QUIETO',   palette: 'noche',    motif: 'still' },
  { slug: 'grava',    name: 'GRAVA',    palette: 'asfalto',  motif: 'gravel' },
  { slug: 'helada',   name: 'HELADA',   palette: 'helada',   motif: 'frost' },
  { slug: 'luna',     name: 'LUNA',     palette: 'noche',    motif: 'moon' },
  { slug: 'cauce',    name: 'CAUCE',    palette: 'tormenta', motif: 'channel' },
  { slug: 'reflejo',  name: 'REFLEJO',  palette: 'ocaso',    motif: 'reflection' },
  { slug: 'umbral',   name: 'UMBRAL',   palette: 'ambar',    motif: 'threshold' },
  { slug: 'circuito', name: 'CIRCUITO', palette: 'mediodia', motif: 'circuit' },
  { slug: 'rueda',    name: 'RUEDA',    palette: 'alba',     motif: 'wheel' },
];

export const artworkId = (i) => `challenge-${String(i + 1).padStart(2, '0')}`;
