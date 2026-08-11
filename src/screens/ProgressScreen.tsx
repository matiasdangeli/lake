import { useMemo } from 'react';
import { useApp } from '../stores/appStore';
import { ACHIEVEMENTS } from '../data/achievements';
import { COPY } from '../data/microcopy';
import { Card, EmptyState } from '../components/ui';
import { IconTrophy } from '../components/icons';
import { duration, km, kmNumber, speed } from '../utils/format';
import { addDays, shortDate, startOfWeek, todayISO } from '../utils/date';

export function ProgressScreen() {
  const { sessions, achievements, weights, settings } = useApp();

  const stats = useMemo(() => {
    const totalKm = sessions.reduce((a, s) => a + s.distanceKm, 0);
    const totalLaps = sessions.reduce((a, s) => a + s.laps, 0);
    const totalSec = sessions.reduce((a, s) => a + s.durationSec, 0);
    const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
    const last = sorted[sorted.length - 1] ?? null;
    const best = sessions.length
      ? sessions.reduce((b, s) => (s.distanceKm > b.distanceKm ? s : b))
      : null;
    const speeds = sessions.map((s) => s.avgSpeedKmh).filter((v): v is number => v != null);
    const bestSpeed = speeds.length ? Math.max(...speeds) : null;
    return { totalKm, totalLaps, totalSec, last, best, bestSpeed, sorted };
  }, [sessions]);

  const totalTime =
    stats.totalSec >= 3600
      ? { value: (stats.totalSec / 3600).toFixed(1).replace('.', ','), unit: 'h' }
      : { value: String(Math.round(stats.totalSec / 60)), unit: 'min' };

  const recent = stats.sorted.slice(-8);
  const maxRecent = Math.max(1, ...recent.map((s) => s.distanceKm));

  const weeks = useMemo(() => {
    const today = todayISO();
    const thisMonday = startOfWeek(today);
    return Array.from({ length: 12 }, (_, i) => {
      const monday = addDays(thisMonday, -(11 - i) * 7);
      const sunday = addDays(monday, 6);
      const count = sessions.filter((s) => s.date >= monday && s.date <= sunday).length;
      return { monday, count };
    });
  }, [sessions]);

  const speedPoints = useMemo(
    () => stats.sorted.map((s) => s.avgSpeedKmh).filter((v): v is number => v != null).slice(-12),
    [stats.sorted]
  );

  const unlocked = useMemo(() => new Map(achievements.map((a) => [a.id, a])), [achievements]);

  const weightSeries = useMemo(
    () => [...weights].sort((a, b) => a.date.localeCompare(b.date)),
    [weights]
  );

  if (sessions.length === 0) {
    return (
      <div className="screen stack-lg">
        <h1 className="title">Progreso</h1>
        <Card><EmptyState text={COPY.emptyProgress} /></Card>
        <Badges unlocked={unlocked} />
      </div>
    );
  }

  return (
    <div className="screen stack-lg">
      <h1 className="title">Progreso</h1>

      <div className="metrics">
        <Card className="metric">
          <span className="metric__value tabular">{kmNumber(stats.totalKm)}<span className="metric__unit">km</span></span>
          <span className="metric__label">Distancia total</span>
        </Card>
        <Card className="metric">
          <span className="metric__value tabular">{stats.totalLaps}</span>
          <span className="metric__label">Vueltas</span>
        </Card>
        <Card className="metric">
          <span className="metric__value tabular">{totalTime.value}<span className="metric__unit">{totalTime.unit}</span></span>
          <span className="metric__label">Tiempo</span>
        </Card>
        <Card className="metric">
          <span className="metric__value tabular">{sessions.length}</span>
          <span className="metric__label">Salidas</span>
        </Card>
      </div>

      <Card className="list">
        {stats.last && (
          <div className="list__item">
            <span className="list__label">Última salida</span>
            <span className="list__value tabular">
              {shortDate(stats.last.date)} · {km(stats.last.distanceKm)} · {duration(stats.last.durationSec)}
            </span>
          </div>
        )}
        {stats.best && (
          <div className="list__item">
            <span className="list__label">Más larga</span>
            <span className="list__value tabular">
              {shortDate(stats.best.date)} · {km(stats.best.distanceKm)}
            </span>
          </div>
        )}
        {stats.bestSpeed != null && (
          <div className="list__item">
            <span className="list__label">Mejor media</span>
            <span className="list__value tabular">{speed(stats.bestSpeed)}</span>
          </div>
        )}
      </Card>

      <section className="stack-sm">
        <span className="section-title">Últimas salidas</span>
        <Card className="pad">
          <div className="chart">
            {recent.map((s, i) => (
              <div
                key={s.id}
                className={`chart__bar${i === recent.length - 1 ? ' is-latest' : ''}`}
                style={{ height: `${Math.max(4, (s.distanceKm / maxRecent) * 100)}%` }}
                title={`${shortDate(s.date)} · ${km(s.distanceKm)}`}
              />
            ))}
          </div>
          <div className="chart__labels">
            {recent.map((s) => <span key={s.id} className="chart__label">{shortDate(s.date)}</span>)}
          </div>
        </Card>
      </section>

      {speedPoints.length >= 2 && (
        <section className="stack-sm">
          <span className="section-title">Ritmo</span>
          <Card className="pad">
            <Sparkline values={speedPoints} />
            <p className="caption tabular">
              {speed(speedPoints[0])} → {speed(speedPoints[speedPoints.length - 1])}
            </p>
          </Card>
        </section>
      )}

      <section className="stack-sm">
        <span className="section-title">Constancia · 12 semanas</span>
        <Card className="pad">
          <div className="weeks">
            {weeks.map((w) => (
              <div key={w.monday} className="weeks__col" title={`Semana del ${shortDate(w.monday)}: ${w.count}`}>
                {Array.from({ length: 4 }, (_, i) => (
                  <span key={i} className={`weeks__dot${i < w.count ? ' is-on' : ''}`} />
                ))}
              </div>
            ))}
          </div>
          <p className="caption" style={{ marginTop: 10 }}>
            Cada columna es una semana. Cada bloque, una salida.
          </p>
        </Card>
      </section>

      <Badges unlocked={unlocked} />

      {settings.weightEnabled && weightSeries.length > 0 && (
        <section className="stack-sm">
          <span className="section-title">Peso</span>
          <Card className="pad stack-sm">
            <div className="row-between">
              <span className="metric__value tabular">
                {weightSeries[weightSeries.length - 1].kg.toFixed(1).replace('.', ',')}
                <span className="metric__unit">kg</span>
              </span>
              {weightSeries.length > 1 && (
                <span className="caption tabular">
                  {(() => {
                    const d = weightSeries[weightSeries.length - 1].kg - weightSeries[0].kg;
                    return `${d > 0 ? '+' : ''}${d.toFixed(1).replace('.', ',')} kg desde el inicio`;
                  })()}
                </span>
              )}
            </div>
            {weightSeries.length >= 2 && <Sparkline values={weightSeries.map((w) => w.kg)} />}
          </Card>
        </section>
      )}
    </div>
  );
}

function Badges({ unlocked }: { unlocked: Map<string, { date: string }> }) {
  return (
    <section className="stack-sm">
      <span className="section-title">Logros</span>
      <div className="badges">
        {ACHIEVEMENTS.map((a) => {
          const got = unlocked.get(a.id);
          return (
            <div key={a.id} className={`badge${got ? ' is-on' : ''}`} title={a.detail}>
              <IconTrophy className="badge__mark" />
              <span className="badge__name">{a.name}</span>
              <span className="badge__date">{got ? shortDate(got.date) : a.detail}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 300;
  const h = 60;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    (i / Math.max(1, values.length - 1)) * (w - 8) + 4,
    h - 8 - ((v - min) / span) * (h - 18),
  ]);
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const area = `${d}L${pts[pts.length - 1][0].toFixed(1)},${h}L${pts[0][0].toFixed(1)},${h}Z`;
  const lastPoint = pts[pts.length - 1];
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4FB4F0" stopOpacity="0.28" />
          <stop offset="1" stopColor="#4FB4F0" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path className="spark__area" d={area} />
      <path className="spark__line" d={d} vectorEffect="non-scaling-stroke" />
      <circle className="spark__dot" cx={lastPoint[0]} cy={lastPoint[1]} r="3" />
    </svg>
  );
}
