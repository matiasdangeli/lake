import type { Location } from '../models/types';

/** Distancia por defecto de una vuelta al lago. Editable en Perfil. */
export const DEFAULT_LAP_DISTANCE_KM = 4.0;

export const LAGO_MUNICIPAL: Location = {
  id: 'lago-municipal-colon',
  name: 'Lago Municipal',
  city: 'Colón, Buenos Aires',
  lapDistanceKm: DEFAULT_LAP_DISTANCE_KM,
  lat: -33.9192291,
  lng: -61.0988167,
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=-33.9192291,-61.0988167',
};

export const LOCATIONS: Location[] = [LAGO_MUNICIPAL];
