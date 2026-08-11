import { useMemo, useState } from 'react';
import { useApp } from '../stores/appStore';
import { artworkById, artworkUrl } from '../engines/ChallengeArtworkGenerator';
import { SessionDetailSheet } from '../components/SessionDetailSheet';
import { LogSessionSheet } from '../components/LogSessionSheet';
import { IconChevronLeft, IconChevronRight } from '../components/icons';
import { Card, EmptyState, tap } from '../components/ui';
import { COPY } from '../data/microcopy';
import { daysInMonth, fromISODate, monthLabel, toISODate, todayISO, weekdayIndex } from '../utils/date';
import { km } from '../utils/format';

const DOWS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export function CalendarScreen() {
  const { challenges, sessions, settings, actions } = useApp();
  const today = todayISO();
  const now = fromISODate(today);
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const byDate = useMemo(() => new Map(challenges.map((c) => [c.date, c])), [challenges]);
  const sessionByDate = useMemo(() => {
    const m = new Map<string, (typeof sessions)[number]>();
    for (const s of sessions) if (!m.has(s.date)) m.set(s.date, s);
    return m;
  }, [sessions]);

  const first = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-01`;
  const offset = weekdayIndex(first);
  const total = daysInMonth(cursor.year, cursor.month);
  const cells = Array.from({ length: offset + total }, (_, i) =>
    i < offset ? null : `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(i - offset + 1).padStart(2, '0')}`
  );

  const monthCompleted = cells.filter((d) => d && byDate.get(d)?.status === 'completed').length;
  const monthKm = cells.reduce((sum, d) => {
    if (!d) return sum;
    const s = sessionByDate.get(d);
    return sum + (byDate.get(d)?.status === 'completed' && s ? s.distanceKm : 0);
  }, 0);

  const isFuture = cursor.year > now.getFullYear() || (cursor.year === now.getFullYear() && cursor.month >= now.getMonth());

  const move = (delta: number) => {
    tap();
    const d = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  };

  const selectedChallenge = selected ? byDate.get(selected) ?? null : null;
  const selectedSession = selected
    ? sessions.find((s) => s.id === selectedChallenge?.sessionId) ?? sessionByDate.get(selected) ?? null
    : null;

  const anyCompleted = challenges.some((c) => c.status === 'completed');

  return (
    <div className="screen stack-lg">
      <header className="cal__head">
        <h1 className="cal__month">{monthLabel(cursor.year, cursor.month)}</h1>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="cal__nav" aria-label="Mes anterior" onClick={() => move(-1)}>
            <IconChevronLeft style={{ width: 17, height: 17 }} />
          </button>
          <button type="button" className="cal__nav" aria-label="Mes siguiente" disabled={isFuture}
            onClick={() => move(1)}>
            <IconChevronRight style={{ width: 17, height: 17 }} />
          </button>
        </div>
      </header>

      <div>
        <div className="cal__dows" aria-hidden>
          {DOWS.map((d, i) => <span key={i} className="cal__dow">{d}</span>)}
        </div>
        <div className="cal__grid">
          {cells.map((date, i) => {
            if (!date) return <span key={`x${i}`} className="cal__cell is-outside" />;
            const challenge = byDate.get(date);
            const completed = challenge?.status === 'completed';
            const art = completed && challenge ? artworkById(challenge.artworkId) : null;
            const dayNum = Number(date.slice(8));
            const classes = [
              'cal__cell',
              completed ? 'has-art' : 'is-empty',
              date === today ? 'is-today' : '',
            ].filter(Boolean).join(' ');

            if (!completed) {
              return (
                <span key={date} className={classes} aria-label={`${dayNum}, sin actividad`}>
                  <span className="cal__num tabular">{dayNum}</span>
                </span>
              );
            }
            return (
              <button
                key={date}
                type="button"
                className={classes}
                aria-label={`${dayNum}, ${challenge?.name}`}
                onClick={() => { tap(); setSelected(date); }}
              >
                {art && <img className="cal__art" src={artworkUrl(art)} alt="" loading="lazy" decoding="async" />}
                <span className="cal__num tabular">{dayNum}</span>
              </button>
            );
          })}
        </div>
        <div className="cal__legend">
          <span className="tabular">{monthCompleted} completados</span>
          {monthKm > 0 && <span className="tabular">{km(monthKm)}</span>}
        </div>
      </div>

      {!anyCompleted && (
        <Card>
          <EmptyState text={COPY.emptyCalendar} />
        </Card>
      )}

      {/* Nunca los dos a la vez: el detalle se cierra al entrar a editar. */}
      <SessionDetailSheet
        open={Boolean(selected) && Boolean(selectedSession) && !editing}
        session={selectedSession}
        challenge={selectedChallenge}
        onClose={() => setSelected(null)}
        onEdit={() => setEditing(true)}
      />

      <LogSessionSheet
        open={editing && Boolean(selectedSession)}
        title="Editar salida"
        lapDistanceKm={settings.lapDistanceKm}
        defaultLaps={selectedSession?.laps ?? 1}
        session={selectedSession}
        onClose={() => setEditing(false)}
        onSubmit={async (input) => {
          if (selectedSession) await actions.updateSession(selectedSession.id, input);
          setSelected(null);
        }}
        onDelete={async () => {
          if (selectedSession) await actions.deleteSession(selectedSession.id);
          setSelected(null);
        }}
      />
    </div>
  );
}

export { toISODate };
