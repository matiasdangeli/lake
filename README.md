# LAKE

**Ride the loop.**

PWA instalable para aumentar de a poco la bicicleta dando vueltas al **Lago Municipal de Colón**, Buenos Aires.
La unidad es la vuelta al lago. Hay un solo desafío por día y la carga sube únicamente cuando se completa el anterior.

---

## Correr y compilar

```bash
cd lake
npm install

npm run dev        # desarrollo en http://localhost:5173
npm run build      # compila a dist/ y genera el service worker
npm run preview    # sirve dist/ para probar la PWA de verdad
npm run verify     # typecheck + tests + build
```

Probar en el iPhone: `npm run dev` expone la red local (`--host`); abrí la IP de la máquina desde Safari
y usá *Compartir → Agregar a pantalla de inicio*. En producción hace falta HTTPS para que se instale el
service worker.

### Tests

```bash
npm test                            # 49 tests de motores y utilidades (vitest)
npm run e2e                         # recorrido completo en un viewport de iPhone 16 Pro
BASE_PATH=/lake/ npm run e2e        # el mismo recorrido, publicado en subdirectorio
BASE_PATH=/lake/ npm run smoke:subpath   # chequeo rápido de rutas bajo subdirectorio
```

El e2e levanta un `vite preview`, abre Chromium a 402×874 @3x y recorre todos los flujos reales:
onboarding, desafío del día, comenzar, registrar, completado, deshacer, omitir, calendario,
edición e eliminación del historial, progreso, logros, export/import, cambio de fecha a las 00:00,
persistencia tras recarga y funcionamiento sin conexión. Falla si aparece scroll horizontal o si
la consola tira errores. Las capturas quedan en `.e2e/`.

---

## Arquitectura

```
src/
  app/App.tsx              shell, tabs, toasts de logros
  screens/                 Onboarding · Home · Calendario · Progreso · Perfil
  components/              tarjeta del desafío, sheets, controles, marca, iconos
  engines/                 toda la lógica de dominio, sin React
    AdaptiveCyclingEngine    escalera de niveles y reglas de progresión
    DailyChallengeEngine     identidad y carga de cada fecha
    ChallengeArtworkGenerator  qué portada le toca a cada día
    InsightEngine            una o dos frases con datos reales
    AchievementEngine        logros recalculados desde el historial
  stores/appStore.tsx      único proveedor de estado; orquesta repos + engines
  repositories/            db.ts (IndexedDB versionada) + un repo por colección
  services/backup.ts       export / import / validación de backups
  models/types.ts          todos los modelos persistidos
  data/                    ubicación, microcopy, logros, assets generados
  utils/                   fechas locales, formato es-AR, rng determinístico
  styles/                  tokens.css · base.css · app.css

scripts/                   generadores de assets y el e2e
public/                    manifest, iconos, branding y las 36 portadas
```

Separación estricta: las pantallas no tocan IndexedDB ni los engines. Piden acciones al store.
Los engines son funciones puras y por eso se testean solos.

---

## Las dos reglas que sostienen el producto

**1 · Un solo desafío visible por día.** Al completarlo la tarjeta queda en blanco y negro con un check
y se queda ahí hasta las 00:00. No aparece el siguiente. Se puede *Deshacer*.

**2 · Identidad ≠ progresión.** A medianoche cambia el nombre, la portada y la frase — pero no la carga.
El nivel se mueve sólo cuando `evaluateCompletion()` recibe una salida registrada:

| Situación | Qué hace |
|---|---|
| Completado, esfuerzo 5–7 | sube un peldaño |
| Completado, esfuerzo ≤4, buena sensación y más vueltas de las pedidas | sube dos |
| Esfuerzo ≥8 o mala sensación | mantiene |
| Molestias | mantiene y el próximo sale suave |
| No llegó al objetivo | mantiene |
| Día sin completar | **no toca nada** |

La escalera cambia una variable por vez: tres peldaños por cantidad de vueltas
(instalar → estabilizar → afinar) y recién ahí suma una vuelta. La racha de días sin completar
se **deriva** del historial en vez de acumularse, así abrir la app tres veces no puede alterar el nivel.
Está cubierto por tests, incluido el obligatorio: día 1 con 2 vueltas sin completar → día 2 sigue en 2 vueltas.

---

## Dónde está cada cosa

### Datos
En el navegador, **IndexedDB**, base `lake`, versión de esquema 1 (`src/repositories/db.ts`).
Stores: `kv` (perfil, ajustes, progresión), `sessions`, `challenges`, `achievements`, `weights`.
Si IndexedDB no está disponible cae a `localStorage` y el Perfil lo informa.
Las migraciones van en la función `migrate()`: subís `SCHEMA_VERSION` y agregás un bloque `if (oldVersion < N)`.

Backup: **Perfil → Exportar** baja un JSON con todo; **Importar** lo valida antes de tocar nada y reemplaza el contenido.

### Imágenes de los desafíos
`public/challenges/challenge-01.webp` … `challenge-36.webp` — 1080×1350, ~0,55 MB en total.
Son composiciones SVG originales generadas por código (cielo, agua, niebla, juncos, asfalto, ruedas,
la forma del lago…) rasterizadas con grano de película real. Determinísticas por semilla: la misma
fecha muestra siempre la misma portada. El índice y los colores dominantes están en
`src/data/challengeArtwork.generated.ts`.

### Logo
- `public/branding/logo-lake.svg` — isotipo plano (usa `currentColor`)
- `public/branding/logo-lake-glass.svg` — isotipo liquid glass
- `public/branding/logo-lake-wordmark.svg` — logotipo + bajada
- `public/branding/logo-lake-lockup.svg` · `-vertical.svg` · `-glass.svg`
- `public/branding/icon-lake.svg` + `public/icons/icon-*.png` + `apple-touch-icon.png` + `favicon.*`

La silueta es el Lago Municipal reconstruido paramétricamente en `scripts/lake-shape.mjs`: una columna
que sigue el eje NO→SE del lago, con ancho variable y sesgo asimétrico. La península interior es el
espacio negativo. El logotipo son letras dibujadas a mano en `scripts/wordmark.mjs` — no depende de
ninguna fuente instalada.

---

## Cómo tocar cosas

**Cambiar la distancia de una vuelta** → Perfil → *Una vuelta*. Se recalculan los objetivos del día y
los futuros; las salidas ya guardadas no se tocan. El valor por defecto está en
`src/data/location.ts` (`DEFAULT_LAP_DISTANCE_KM`) y nunca está hardcodeado en la UI.

**Agregar desafíos nuevos**
- *Nombres y portadas*: agregá una entrada **al final** de `CHALLENGE_CATALOG` en
  `scripts/challenge-catalog.mjs` (slug, nombre, paleta, motivo) y corré `npm run assets:challenges`.
  El orden es la identidad del artwork: se agrega al final, nunca se reordena.
  Si el motivo es nuevo, sumalo al objeto `MOTIFS` de `scripts/generate-challenge-art.mjs`
  combinando las capas que ya existen (`sky`, `water`, `treeline`, `reeds`, `bike`, `lakeGlyph`…).
- *Frases*: `src/data/microcopy.ts`, por tipo de desafío. Aceptan `{laps}`, `{km}`, `{min}`.
- *Tipos de desafío*: agregá el tipo en `models/types.ts`, su frase, su objetivo y metelo en el array
  `PHASES` de `AdaptiveCyclingEngine` si tiene que formar parte de la escalera.

**Regenerar assets**

```bash
npm run assets:branding      # logo, lockups, iconos, favicon, paths de la app
npm run assets:challenges    # las 36 portadas + su índice
npm run assets               # las dos cosas
node scripts/generate-challenge-art.mjs --svg   # además deja los SVG fuente en assets/
```

Editar la forma del logo = editar `LAKE_SPINE` en `scripts/lake-shape.mjs` y regenerar.

---

## Decisiones que conviene saber

- **Fechas siempre locales.** Nunca `toISOString()` para el día: el desafío cambia a las 00:00 de Colón.
  Hay un timer hasta medianoche y además se revisa la fecha al volver a la app, porque un timeout
  no sobrevive horas en segundo plano.
- **Importar captura** adjunta una imagen de Apple Fitness/Strava/Garmin y la muestra al lado del
  formulario para copiar los números. No hay OCR en el dispositivo, así que la app **no simula** una
  extracción automática: la captura es referencia visual y se descarta al cerrar el sheet, nunca se guarda.
- **Sin datos demo.** La app arranca vacía. No hay fixtures mezclados con datos reales.
- **Offline.** El service worker (`scripts/generate-sw.mjs`, generado en cada build con la lista real de
  archivos) precachea el shell y las 36 portadas. Navegación: red primero, cache si no hay. Assets: cache primero.
- **Accesibilidad.** Áreas táctiles ≥44px, textos siempre sobre velo (nunca directo sobre la imagen),
  safe areas del iPhone, `prefers-reduced-motion` respetado y también un interruptor propio en Perfil.
