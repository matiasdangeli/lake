/**
 * Registrar / editar una salida.
 *
 * Reglas de cálculo: si hay vueltas y tiempo, la distancia y la velocidad
 * media salen solas. Si se escribe la distancia a mano, manda esa.
 * Sólo vueltas, distancia y duración son obligatorias; el resto es opcional.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CyclingSession, Feeling, Lap } from '../models/types';
import type { SessionInput } from '../stores/appStore';
import {
  FEELING_LABEL, avgSpeed, duration as fmtDuration, km, parseDuration, parseNumber, speed,
} from '../utils/format';
import { nowTime, todayISO } from '../utils/date';
import { IconImage, IconPlus, IconTrash } from './icons';
import { Button, ConfirmSheet, Field, Segmented, Sheet, Slider, Stepper, TextArea, TextInput, tap } from './ui';

const FEELINGS: Feeling[] = ['muy_mal', 'pesado', 'normal', 'bien', 'excelente'];

interface Draft {
  date: string;
  time: string;
  laps: number;
  distance: string;
  durationText: string;
  maxSpeed: string;
  avgHr: string;
  maxHr: string;
  calories: string;
  cadence: string;
  effort: number;
  feeling: Feeling;
  discomfort: string;
  notes: string;
  lapRows: { distance: string; duration: string }[];
}

const emptyDraft = (laps: number, distanceKm: number): Draft => ({
  date: todayISO(),
  time: nowTime(),
  laps,
  distance: distanceKm ? distanceKm.toFixed(1).replace('.', ',') : '',
  durationText: '',
  maxSpeed: '', avgHr: '', maxHr: '', calories: '', cadence: '',
  effort: 5,
  feeling: 'normal',
  discomfort: '',
  notes: '',
  lapRows: [],
});

const draftFromSession = (s: CyclingSession): Draft => ({
  date: s.date,
  time: s.time,
  laps: s.laps,
  distance: String(s.distanceKm).replace('.', ','),
  durationText: s.durationSec ? fmtDuration(s.durationSec) : '',
  maxSpeed: s.maxSpeedKmh != null ? String(s.maxSpeedKmh).replace('.', ',') : '',
  avgHr: s.avgHr != null ? String(s.avgHr) : '',
  maxHr: s.maxHr != null ? String(s.maxHr) : '',
  calories: s.calories != null ? String(s.calories) : '',
  cadence: s.cadence != null ? String(s.cadence) : '',
  effort: s.effort,
  feeling: s.feeling,
  discomfort: s.discomfort ?? '',
  notes: s.notes ?? '',
  lapRows: s.lapDetails.map((l) => ({
    distance: String(l.distanceKm).replace('.', ','),
    duration: fmtDuration(l.durationSec),
  })),
});

export interface LogSessionSheetProps {
  open: boolean;
  title: string;
  lapDistanceKm: number;
  defaultLaps: number;
  session?: CyclingSession | null;
  onClose: () => void;
  onSubmit: (input: SessionInput) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function LogSessionSheet({
  open, title, lapDistanceKm, defaultLaps, session, onClose, onSubmit, onDelete,
}: LogSessionSheetProps) {
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(defaultLaps, defaultLaps * lapDistanceKm));
  const [distanceTouched, setDistanceTouched] = useState(false);
  const [showLaps, setShowLaps] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Cada apertura arranca limpia (o con los datos de la sesión que se edita).
  useEffect(() => {
    if (!open) return;
    if (session) {
      setDraft(draftFromSession(session));
      setDistanceTouched(true);
      setShowLaps(session.lapDetails.length > 0);
    } else {
      setDraft(emptyDraft(defaultLaps, Number((defaultLaps * lapDistanceKm).toFixed(2))));
      setDistanceTouched(false);
      setShowLaps(false);
    }
    setShot(null);
    setError(null);
  }, [open, session, defaultLaps, lapDistanceKm]);

  // La captura vive sólo mientras el sheet está abierto. Nunca se guarda.
  useEffect(() => {
    return () => {
      if (shot) URL.revokeObjectURL(shot);
    };
  }, [shot]);

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  const setLaps = (laps: number) => {
    patch({
      laps,
      distance: distanceTouched ? draft.distance : (laps * lapDistanceKm).toFixed(1).replace('.', ','),
    });
  };

  const distanceKm = parseNumber(draft.distance);
  const durationSec = parseDuration(draft.durationText);
  const computedSpeed = avgSpeed(distanceKm, durationSec);

  const lapRows = draft.lapRows;
  const parsedLaps: Lap[] = useMemo(
    () =>
      lapRows
        .map((r, i) => {
          const d = parseNumber(r.distance);
          const t = parseDuration(r.duration);
          if (d == null || t == null) return null;
          return { index: i + 1, distanceKm: d, durationSec: t, avgSpeedKmh: avgSpeed(d, t) };
        })
        .filter((l): l is Lap => l !== null),
    [lapRows]
  );

  const valid = draft.laps > 0 && distanceKm != null && distanceKm > 0 && durationSec != null && durationSec > 0;

  const submit = async () => {
    if (!valid || distanceKm == null || durationSec == null) {
      setError('Faltan vueltas, distancia o duración.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        date: draft.date,
        time: draft.time,
        laps: draft.laps,
        distanceKm,
        durationSec,
        maxSpeedKmh: parseNumber(draft.maxSpeed),
        avgHr: parseNumber(draft.avgHr),
        maxHr: parseNumber(draft.maxHr),
        calories: parseNumber(draft.calories),
        cadence: parseNumber(draft.cadence),
        effort: draft.effort,
        feeling: draft.feeling,
        discomfort: draft.discomfort.trim() || null,
        notes: draft.notes.trim() || null,
        lapDetails: parsedLaps,
      });
      onClose();
    } catch (e) {
      setError((e as Error).message || 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Sheet
        open={open}
        title={title}
        onClose={onClose}
        footer={
          <>
            {onDelete && (
              <Button className="btn--danger" onClick={() => setConfirmDelete(true)} aria-label="Eliminar salida">
                <IconTrash style={{ width: 18, height: 18 }} />
              </Button>
            )}
            <Button variant="primary" block disabled={!valid || saving} onClick={submit}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <div className="grid-2">
          <Field label="Fecha">
            <TextInput type="date" value={draft.date} max={todayISO()} onChange={(e) => patch({ date: e.target.value })} />
          </Field>
          <Field label="Hora">
            <TextInput type="time" value={draft.time} onChange={(e) => patch({ time: e.target.value })} />
          </Field>
        </div>

        <Field label="Vueltas" hint={`1 vuelta = ${km(lapDistanceKm)}`}>
          <Stepper value={draft.laps} min={1} max={20} onChange={setLaps} unit="vueltas" />
        </Field>

        <div className="grid-2">
          <Field label="Distancia">
            <TextInput
              inputMode="decimal"
              placeholder="8,0"
              value={draft.distance}
              onChange={(e) => { setDistanceTouched(true); patch({ distance: e.target.value }); }}
            />
          </Field>
          <Field label="Duración" hint="mm:ss o h:mm:ss">
            <TextInput
              inputMode="numeric"
              placeholder="29:14"
              value={draft.durationText}
              onChange={(e) => patch({ durationText: e.target.value })}
            />
          </Field>
        </div>

        {computedSpeed != null && (
          <div className="banner banner--info">
            Velocidad media: <strong className="tabular">&nbsp;{speed(computedSpeed)}</strong>
          </div>
        )}

        <Field label={`Esfuerzo · ${draft.effort}/10`} hint="1 muy fácil · 10 máximo">
          <Slider value={draft.effort} min={1} max={10} ariaLabel="Esfuerzo percibido"
            onChange={(v) => patch({ effort: v })} />
        </Field>

        <Field label="Sensación">
          <Segmented
            ariaLabel="Sensación"
            value={draft.feeling}
            onChange={(v) => patch({ feeling: v })}
            options={FEELINGS.map((f) => ({ value: f, label: FEELING_LABEL[f] }))}
          />
        </Field>

        {/* ---------- opcionales ---------- */}
        <div className="stack-sm">
          <span className="section-title">Opcional</span>
          <div className="grid-2">
            <Field label="Vel. máx.">
              <TextInput inputMode="decimal" placeholder="—" value={draft.maxSpeed}
                onChange={(e) => patch({ maxSpeed: e.target.value })} />
            </Field>
            <Field label="Cadencia">
              <TextInput inputMode="numeric" placeholder="—" value={draft.cadence}
                onChange={(e) => patch({ cadence: e.target.value })} />
            </Field>
            <Field label="FC media">
              <TextInput inputMode="numeric" placeholder="—" value={draft.avgHr}
                onChange={(e) => patch({ avgHr: e.target.value })} />
            </Field>
            <Field label="FC máx.">
              <TextInput inputMode="numeric" placeholder="—" value={draft.maxHr}
                onChange={(e) => patch({ maxHr: e.target.value })} />
            </Field>
          </div>
          <Field label="Calorías">
            <TextInput inputMode="numeric" placeholder="—" value={draft.calories}
              onChange={(e) => patch({ calories: e.target.value })} />
          </Field>
          <Field label="Molestias">
            <TextInput placeholder="Si algo te molestó, anotalo" value={draft.discomfort}
              onChange={(e) => patch({ discomfort: e.target.value })} />
          </Field>
          <Field label="Notas">
            <TextArea placeholder="Lo que quieras acordarte" value={draft.notes}
              onChange={(e) => patch({ notes: e.target.value })} />
          </Field>
        </div>

        {/* ---------- vueltas individuales ---------- */}
        <div className="stack-sm">
          <div className="row-between">
            <span className="section-title">Por vuelta</span>
            <Button size="sm" variant="ghost" onClick={() => {
              setShowLaps(true);
              patch({
                lapRows: [...lapRows, { distance: String(lapDistanceKm).replace('.', ','), duration: '' }],
              });
            }}>
              <IconPlus style={{ width: 15, height: 15 }} /> Agregar
            </Button>
          </div>
          {showLaps && lapRows.length > 0 && (
            <div className="glass">
              {lapRows.map((r, i) => (
                <div key={i} className="laptable__row">
                  <span className="laptable__idx">#{i + 1}</span>
                  <TextInput inputMode="decimal" placeholder="km" value={r.distance}
                    onChange={(e) => patch({
                      lapRows: lapRows.map((x, j) => (j === i ? { ...x, distance: e.target.value } : x)),
                    })} />
                  <TextInput inputMode="numeric" placeholder="mm:ss" value={r.duration}
                    onChange={(e) => patch({
                      lapRows: lapRows.map((x, j) => (j === i ? { ...x, duration: e.target.value } : x)),
                    })} />
                  <button type="button" className="btn btn--ghost btn--sm" aria-label={`Quitar vuelta ${i + 1}`}
                    onClick={() => { tap(); patch({ lapRows: lapRows.filter((_, j) => j !== i) }); }}>
                    <IconTrash style={{ width: 16, height: 16 }} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {parsedLaps.length > 1 && (
            <p className="caption">
              Última vuelta {speed(parsedLaps[parsedLaps.length - 1].avgSpeedKmh)} · primera{' '}
              {speed(parsedLaps[0].avgSpeedKmh)}
            </p>
          )}
        </div>

        {/* ---------- captura de referencia ---------- */}
        <div className="stack-sm">
          <span className="section-title">Captura de otra app</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (shot) URL.revokeObjectURL(shot);
              setShot(URL.createObjectURL(file));
              e.target.value = '';
            }}
          />
          {shot ? (
            <div className="shot">
              <button type="button" className="shot__preview" onClick={() => setZoom(true)} aria-label="Ampliar captura">
                <img src={shot} alt="Captura de la otra app" />
              </button>
              <div className="stack-sm" style={{ flex: 1 }}>
                <p className="caption">
                  Tocá la imagen para agrandarla y copiá los números a mano. La captura no se guarda: desaparece
                  al cerrar.
                </p>
                <Button size="sm" variant="ghost" onClick={() => { URL.revokeObjectURL(shot); setShot(null); }}>
                  Quitar
                </Button>
              </div>
            </div>
          ) : (
            <Button block onClick={() => fileRef.current?.click()}>
              <IconImage style={{ width: 18, height: 18 }} /> Adjuntar captura
            </Button>
          )}
        </div>

        {error && (
          <div className="banner">
            <span>{error}</span>
          </div>
        )}
      </Sheet>

      {zoom && shot && (
        <div className="shot__zoom" role="dialog" aria-label="Captura ampliada" onClick={() => setZoom(false)}>
          <img src={shot} alt="Captura ampliada" />
        </div>
      )}

      <ConfirmSheet
        open={confirmDelete}
        title="Eliminar salida"
        message="Se borra el registro y se recalculan progreso y logros. No se puede deshacer."
        confirmLabel="Eliminar"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          await onDelete?.();
          onClose();
        }}
      />
    </>
  );
}
