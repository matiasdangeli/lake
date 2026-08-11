import { useState } from 'react';
import { useApp } from '../stores/appStore';
import { LAGO_MUNICIPAL } from '../data/location';
import { km } from '../utils/format';
import { LakeMarkGlass, Tagline, Wordmark } from '../components/brand';
import { Button, Stepper } from '../components/ui';

const OPTIONS: { label: string; value: number | null; hint: string }[] = [
  { label: '1 vuelta', value: 1, hint: '≈ 4 km' },
  { label: '2 vueltas', value: 2, hint: '≈ 8 km' },
  { label: '3 vueltas', value: 3, hint: '≈ 12 km' },
  { label: '4 o más', value: 4, hint: '≈ 16 km' },
  { label: 'No sé todavía', value: null, hint: 'Empezamos midiendo' },
];

export function OnboardingScreen() {
  const { actions } = useApp();
  const [step, setStep] = useState(0);
  const [lapDistanceKm, setLapDistanceKm] = useState(LAGO_MUNICIPAL.lapDistanceKm);
  const [choice, setChoice] = useState<number | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    setBusy(true);
    await actions.completeOnboarding({
      name: '',
      baselineLaps: choice === undefined ? null : choice,
      lapDistanceKm,
    });
  };

  return (
    <div className="onb">
      <div className="onb__body">
        {step === 0 && (
          <div className="onb__hero">
            <LakeMarkGlass className="onb__mark" />
            <div className="stack-sm" style={{ alignItems: 'center' }}>
              <Wordmark className="wordmark wordmark--lg" />
              <Tagline style={{ height: 11, width: 'auto', color: 'var(--text-2)' }} />
            </div>
            <p className="body" style={{ maxWidth: '26ch' }}>
              Una app para dar vueltas al lago. Nada más que eso.
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="stack-lg">
            <div className="stack-sm">
              <span className="eyebrow">Tu lugar</span>
              <h1 className="title">Lago Municipal</h1>
              <p className="body">Colón, Buenos Aires</p>
            </div>
            <p className="onb__lead">Vamos a usar la vuelta al lago como unidad.</p>
            <div className="glass pad stack-sm">
              <span className="field__label">Una vuelta mide</span>
              <Stepper value={lapDistanceKm} min={0.5} max={20} step={0.1} decimals={1} unit="km"
                onChange={setLapDistanceKm} />
              <p className="caption">Después lo podés corregir en Perfil. Todo se recalcula solo.</p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="stack-lg">
            <div className="stack-sm">
              <span className="eyebrow">Punto de partida</span>
              <h1 className="title">¿Cuánto te resulta cómodo pedalear hoy?</h1>
            </div>
            <div className="choices">
              {OPTIONS.map((o) => (
                <button
                  key={o.label}
                  type="button"
                  className={`choice${choice === o.value && choice !== undefined ? ' is-on' : ''}`}
                  aria-pressed={choice === o.value}
                  onClick={() => setChoice(o.value)}
                >
                  <span>{o.label}</span>
                  <span className="choice__hint">
                    {o.value ? `≈ ${km(o.value * lapDistanceKm, o.value * lapDistanceKm % 1 ? 1 : 0)}` : o.hint}
                  </span>
                </button>
              ))}
            </div>
            <p className="caption">
              No es un compromiso. Sirve para no arrancar ni muy corto ni de más.
            </p>
          </div>
        )}
      </div>

      <div className="onb__foot">
        <div className="onb__dots" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className={`onb__dot${i === step ? ' is-on' : ''}`} />
          ))}
        </div>
        {step < 2 ? (
          <Button variant="primary" block onClick={() => setStep(step + 1)}>
            {step === 0 ? 'Empezar' : 'Seguir'}
          </Button>
        ) : (
          <Button variant="primary" block disabled={choice === undefined || busy} onClick={finish}>
            {busy ? 'Preparando…' : 'Listo'}
          </Button>
        )}
        {step > 0 && (
          <Button variant="ghost" block onClick={() => setStep(step - 1)}>
            Atrás
          </Button>
        )}
      </div>
    </div>
  );
}
