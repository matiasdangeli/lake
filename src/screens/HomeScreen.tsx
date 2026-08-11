import { useMemo, useState } from 'react';
import { useApp } from '../stores/appStore';
import { ChallengeCard } from '../components/ChallengeCard';
import { LapDots, LakeLoop, Wordmark } from '../components/brand';
import { Button, Card, ConfirmSheet, Sheet, Stepper, EmptyState } from '../components/ui';
import { LogSessionSheet } from '../components/LogSessionSheet';
import { IconBike, IconCheck, IconUndo } from '../components/icons';
import { effectiveLaps } from '../engines/DailyChallengeEngine';
import { insightsFor } from '../engines/InsightEngine';
import { LAGO_MUNICIPAL } from '../data/location';
import { COPY } from '../data/microcopy';
import { km, laps as lapsLabel } from '../utils/format';
import { longDate } from '../utils/date';

export function HomeScreen({ offline }: { offline: boolean }) {
  const { todayChallenge, settings, sessions, actions, today } = useApp();
  const [logOpen, setLogOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [adjustValue, setAdjustValue] = useState(1);

  const insights = useMemo(() => insightsFor(sessions), [sessions]);
  const todaySession = useMemo(
    () => sessions.find((s) => s.id === todayChallenge?.sessionId) ?? null,
    [sessions, todayChallenge]
  );

  if (!todayChallenge) {
    return (
      <div className="screen">
        <Header />
        <Card><EmptyState text="Preparando el desafío de hoy." /></Card>
      </div>
    );
  }

  const target = effectiveLaps(todayChallenge);
  const done = todayChallenge.status === 'completed';
  const skipped = todayChallenge.status === 'skipped';
  const lapsDone = done ? (todaySession?.laps ?? target) : 0;

  return (
    <div className="screen stack-lg">
      <Header />

      {offline && <div className="banner banner--info">{COPY.offline}</div>}

      <ChallengeCard challenge={todayChallenge} lapDistanceKm={settings.lapDistanceKm} />

      {done ? (
        <div className="stack">
          <Card className="pad">
            <div className="row-between">
              <div className="done-line">
                <span className="eyebrow">{COPY.completedToday}</span>
                <span className="body tabular" style={{ color: 'var(--text)' }}>
                  {lapsLabel(lapsDone)} · {km(todaySession?.distanceKm ?? todayChallenge.targetDistanceKm)}
                </span>
              </div>
              <LapDots done={lapsDone} total={Math.max(target, lapsDone)} />
            </div>
          </Card>
          <div className="btn-row">
            <Button variant="ghost" onClick={() => setConfirmUndo(true)}>
              <IconUndo style={{ width: 16, height: 16 }} /> Deshacer
            </Button>
          </div>
        </div>
      ) : skipped ? (
        <div className="stack">
          <Card className="pad">
            <p className="body">{COPY.skippedToday}</p>
          </Card>
          <div className="btn-row">
            <Button variant="ghost" onClick={() => void actions.unskipToday()}>Retomar</Button>
          </div>
        </div>
      ) : (
        <div className="stack">
          {todayChallenge.startedAt ? (
            <Button variant="primary" onClick={() => setLogOpen(true)}>
              <IconCheck style={{ width: 17, height: 17 }} /> Registrar salida
            </Button>
          ) : (
            <Button variant="primary" onClick={async () => {
              await actions.startChallenge();
            }}>
              <IconBike style={{ width: 18, height: 18 }} /> Comenzar
            </Button>
          )}
          <div className="btn-row">
            <Button variant="ghost" onClick={() => { setAdjustValue(target); setAdjustOpen(true); }}>
              Modificar
            </Button>
            <Button variant="ghost" onClick={() => void actions.skipToday()}>Omitir hoy</Button>
            {todayChallenge.startedAt && (
              <Button variant="ghost" onClick={() => setLogOpen(true)}>Ya la hice</Button>
            )}
          </div>
        </div>
      )}

      <Card className="pad">
        <div className="row-between">
          <div className="stack-sm" style={{ flex: 1 }}>
            <span className="section-title" style={{ padding: 0 }}>El circuito</span>
            <p className="caption">{LAGO_MUNICIPAL.name} · {LAGO_MUNICIPAL.city}</p>
            <p className="caption tabular">
              {lapsDone}/{target} vueltas · 1 vuelta = {km(settings.lapDistanceKm)}
            </p>
          </div>
          <div style={{ width: 92, flex: 'none' }}>
            <LakeLoop done={lapsDone} total={target} />
          </div>
        </div>
      </Card>

      {insights.length > 0 && (
        <Card>
          {insights.map((i) => (
            <div key={i.id} className={`insight is-${i.tone}`}>
              <span className="insight__mark" />
              <span>{i.text}</span>
            </div>
          ))}
        </Card>
      )}

      <p className="mini" style={{ textAlign: 'center' }}>{longDate(today)}</p>

      <LogSessionSheet
        open={logOpen}
        title="Registrar salida"
        lapDistanceKm={settings.lapDistanceKm}
        defaultLaps={target}
        onClose={() => setLogOpen(false)}
        onSubmit={actions.completeChallenge}
      />

      <Sheet
        open={adjustOpen}
        title="Modificar el desafío"
        onClose={() => setAdjustOpen(false)}
        footer={
          <>
            <Button block onClick={async () => { await actions.adjustLaps(null); setAdjustOpen(false); }}>
              Volver al original
            </Button>
            <Button variant="primary" block onClick={async () => {
              await actions.adjustLaps(adjustValue === todayChallenge.targetLaps ? null : adjustValue);
              setAdjustOpen(false);
            }}>
              Guardar
            </Button>
          </>
        }
      >
        <p className="body">
          Cambiás el objetivo de hoy. La progresión no se altera: sigue midiendo desde lo que completes.
        </p>
        <Stepper value={adjustValue} min={1} max={20} unit="vueltas" onChange={setAdjustValue} />
        <p className="caption tabular">≈ {km(adjustValue * settings.lapDistanceKm)}</p>
      </Sheet>

      <ConfirmSheet
        open={confirmUndo}
        title="Deshacer el completado"
        message="Vuelve a quedar pendiente y se borra la salida que registraste hoy."
        confirmLabel="Deshacer"
        onCancel={() => setConfirmUndo(false)}
        onConfirm={async () => {
          setConfirmUndo(false);
          await actions.undoCompletion();
        }}
      />
    </div>
  );
}

function Header() {
  return (
    <header className="app-header">
      <Wordmark className="wordmark" />
      <div className="app-header__place">
        <p className="caption" style={{ color: 'var(--text-2)' }}>{LAGO_MUNICIPAL.name}</p>
        <p className="mini">{LAGO_MUNICIPAL.city}</p>
      </div>
    </header>
  );
}
