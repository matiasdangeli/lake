import type { DailyChallenge } from '../models/types';
import { artworkById, artworkUrl } from '../engines/ChallengeArtworkGenerator';
import { effectiveLaps } from '../engines/DailyChallengeEngine';
import { CHALLENGE_TYPE_LABEL, km, laps as lapsLabel } from '../utils/format';
import { IconCheck } from './icons';
import { ArtImage } from './ui';

export function ChallengeCard({ challenge, lapDistanceKm }: { challenge: DailyChallenge; lapDistanceKm: number }) {
  const art = artworkById(challenge.artworkId);
  const n = effectiveLaps(challenge);
  const distance = Number((n * lapDistanceKm).toFixed(2));
  const done = challenge.status === 'completed';
  const skipped = challenge.status === 'skipped';
  const active = !done && !skipped && Boolean(challenge.startedAt);

  return (
    <article
      className={`challenge${done ? ' is-done' : ''}${skipped ? ' is-skipped' : ''}`}
      style={{ ['--tint' as string]: art.glow, ['--tint-soft' as string]: `${art.glow}44` }}
    >
      <ArtImage src={artworkUrl(art)} lqip={art.lqip} alt="" />
      <div className="challenge__scrim" />

      <div className="challenge__top">
        <span className="challenge__num">#{String(challenge.number).padStart(2, '0')}</span>
        <span className="challenge__num">{CHALLENGE_TYPE_LABEL[challenge.type]}</span>
      </div>

      <div className="challenge__body">
        {done && (
          <span className="challenge__badge is-done">
            <IconCheck className="check" /> Completado
          </span>
        )}
        {skipped && <span className="challenge__badge is-skipped">Omitido</span>}
        {active && <span className="challenge__badge is-active">En curso</span>}

        <h2 className="challenge__name">{challenge.name}</h2>
        <p className="challenge__phrase">{challenge.phrase}</p>

        <div className="challenge__target">
          <span className="challenge__laps tabular">{lapsLabel(n)}</span>
          <span className="challenge__dist tabular">≈ {km(distance)}</span>
          {challenge.targetDurationMin && (
            <span className="challenge__dist tabular">· {challenge.targetDurationMin} min</span>
          )}
        </div>

        <p className="caption">{challenge.objective}</p>
      </div>
    </article>
  );
}
