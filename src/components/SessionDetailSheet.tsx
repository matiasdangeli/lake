import type { CyclingSession, DailyChallenge } from '../models/types';
import { artworkById, artworkUrl } from '../engines/ChallengeArtworkGenerator';
import { LAGO_MUNICIPAL } from '../data/location';
import { CHALLENGE_TYPE_LABEL, FEELING_LABEL, duration, km, speed } from '../utils/format';
import { longDate } from '../utils/date';
import { IconMap, IconPencil } from './icons';
import { Button, Sheet } from './ui';
import { LapDots } from './brand';

export function SessionDetailSheet({ open, session, challenge, onClose, onEdit }: {
  open: boolean;
  session: CyclingSession | null;
  challenge: DailyChallenge | null;
  onClose: () => void;
  onEdit: () => void;
}) {
  if (!session) return null;
  const art = challenge ? artworkById(challenge.artworkId) : null;
  const best = session.lapDetails.reduce<number>(
    (b, l) => (l.avgSpeedKmh && l.avgSpeedKmh > b ? l.avgSpeedKmh : b),
    0
  );

  return (
    <Sheet
      open={open}
      title={longDate(session.date)}
      onClose={onClose}
      footer={
        <Button variant="primary" block onClick={onEdit}>
          <IconPencil style={{ width: 17, height: 17 }} /> Editar
        </Button>
      }
    >
      {art && challenge && (
        <div className="detail__hero">
          <img src={artworkUrl(art)} alt="" />
          <div className="detail__hero-body">
            <p className="mini">#{String(challenge.number).padStart(2, '0')} · {CHALLENGE_TYPE_LABEL[challenge.type]}</p>
            <h3 className="detail__name">{challenge.name}</h3>
          </div>
        </div>
      )}

      <div className="glass">
        <div className="stats">
          <div className="stat">
            <span className="stat__value tabular">{session.laps}</span>
            <span className="stat__label">Vueltas</span>
          </div>
          <div className="stat">
            <span className="stat__value tabular">{km(session.distanceKm)}</span>
            <span className="stat__label">Distancia</span>
          </div>
          <div className="stat">
            <span className="stat__value tabular">{duration(session.durationSec)}</span>
            <span className="stat__label">Tiempo</span>
          </div>
          <div className="stat">
            <span className="stat__value tabular">{speed(session.avgSpeedKmh)}</span>
            <span className="stat__label">Media</span>
          </div>
          <div className="stat">
            <span className="stat__value tabular">{session.effort}/10</span>
            <span className="stat__label">Esfuerzo</span>
          </div>
          <div className="stat">
            <span className="stat__value" style={{ fontSize: 14 }}>{FEELING_LABEL[session.feeling]}</span>
            <span className="stat__label">Sensación</span>
          </div>
        </div>
      </div>

      <div className="row-between" style={{ padding: '0 4px' }}>
        <span className="caption">{session.time} hs</span>
        <LapDots done={session.laps} total={Math.max(session.laps, challenge?.targetLaps ?? session.laps)} />
      </div>

      {(session.avgHr || session.maxHr || session.maxSpeedKmh || session.calories || session.cadence) && (
        <div className="glass list">
          {session.maxSpeedKmh != null && <Row label="Velocidad máxima" value={speed(session.maxSpeedKmh)} />}
          {session.avgHr != null && <Row label="FC media" value={`${session.avgHr} ppm`} />}
          {session.maxHr != null && <Row label="FC máxima" value={`${session.maxHr} ppm`} />}
          {session.cadence != null && <Row label="Cadencia" value={`${session.cadence} rpm`} />}
          {session.calories != null && <Row label="Calorías" value={`${session.calories} kcal`} />}
        </div>
      )}

      {session.lapDetails.length > 0 && (
        <div className="stack-sm">
          <span className="section-title">Por vuelta</span>
          <div className="glass laptable">
            <div className="laptable__row is-head">
              <span>#</span><span>Dist.</span><span>Tiempo</span><span>Media</span>
            </div>
            {session.lapDetails.map((l) => (
              <div key={l.index} className={`laptable__row${l.avgSpeedKmh === best && best > 0 ? ' is-best' : ''}`}>
                <span className="laptable__idx">{l.index}</span>
                <span>{km(l.distanceKm)}</span>
                <span>{duration(l.durationSec)}</span>
                <span>{speed(l.avgSpeedKmh)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {session.discomfort && (
        <div className="banner">
          <span>Molestias: {session.discomfort}</span>
        </div>
      )}

      {session.notes && (
        <div className="glass pad">
          <p className="body">{session.notes}</p>
        </div>
      )}

      <a className="btn btn--block" href={LAGO_MUNICIPAL.mapsUrl} target="_blank" rel="noreferrer">
        <IconMap style={{ width: 17, height: 17 }} /> {LAGO_MUNICIPAL.name} de {LAGO_MUNICIPAL.city.split(',')[0]}
      </a>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="list__item">
      <span className="list__label">{label}</span>
      <span className="list__value tabular">{value}</span>
    </div>
  );
}
