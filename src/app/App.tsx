import { useEffect, useState } from 'react';
import { AppProvider, useApp } from '../stores/appStore';
import { HomeScreen } from '../screens/HomeScreen';
import { CalendarScreen } from '../screens/CalendarScreen';
import { ProgressScreen } from '../screens/ProgressScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { LogSessionSheet } from '../components/LogSessionSheet';
import { LakeMark } from '../components/brand';
import { Button, tap } from '../components/ui';
import { IconCalendar, IconChart, IconHome, IconPerson, IconPlus, IconTrophy } from '../components/icons';
import { ACHIEVEMENT_BY_ID } from '../data/achievements';
import { effectiveLaps } from '../engines/DailyChallengeEngine';
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/app.css';

type Tab = 'home' | 'calendar' | 'progress' | 'profile';

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}

function Shell() {
  const { status, error, profile, settings, todayChallenge, actions, celebrating } = useApp();
  const [tab, setTab] = useState<Tab>('home');
  const [logOpen, setLogOpen] = useState(false);
  const offline = useOffline();

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(settings.reduceMotion);
  }, [settings.reduceMotion]);

  useEffect(() => {
    if (celebrating.length === 0) return;
    tap([10, 40, 14]);
    const t = window.setTimeout(() => actions.dismissCelebration(), 4200);
    return () => window.clearTimeout(t);
  }, [celebrating, actions]);

  if (status === 'loading') {
    return (
      <div className="splash">
        <LakeMark className="splash__mark" title="LAKE" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="screen stack-lg" style={{ justifyContent: 'center', minHeight: '100dvh' }}>
        <h1 className="title">Algo se rompió</h1>
        <p className="body">{error ?? 'No se pudieron leer los datos guardados.'}</p>
        <Button variant="primary" onClick={() => window.location.reload()}>Reintentar</Button>
      </div>
    );
  }

  if (!profile?.onboardedAt) return <OnboardingScreen />;

  return (
    <div className="app">
      {celebrating.length > 0 && (
        <div className="toast-wrap">
          {celebrating.map((id) => {
            const def = ACHIEVEMENT_BY_ID[id];
            return (
              <div key={id} className="toast" role="status">
                <IconTrophy className="toast__mark" />
                <div>
                  <p className="toast__name">{def.name}</p>
                  <p className="toast__detail">{def.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'home' && <HomeScreen offline={offline} />}
      {tab === 'calendar' && <CalendarScreen />}
      {tab === 'progress' && <ProgressScreen />}
      {tab === 'profile' && <ProfileScreen />}

      <nav className="tabbar" aria-label="Navegación principal">
        <TabButton icon={<IconHome />} label="Inicio" active={tab === 'home'} onClick={() => setTab('home')} />
        <TabButton icon={<IconCalendar />} label="Calendario" active={tab === 'calendar'} onClick={() => setTab('calendar')} />
        <button type="button" className="tab tab--add" aria-label="Registrar salida"
          onClick={() => { tap(); setLogOpen(true); }}>
          <span className="tab__plus"><IconPlus /></span>
        </button>
        <TabButton icon={<IconChart />} label="Progreso" active={tab === 'progress'} onClick={() => setTab('progress')} />
        <TabButton icon={<IconPerson />} label="Perfil" active={tab === 'profile'} onClick={() => setTab('profile')} />
      </nav>

      <LogSessionSheet
        open={logOpen}
        title="Registrar salida"
        lapDistanceKm={settings.lapDistanceKm}
        defaultLaps={todayChallenge ? effectiveLaps(todayChallenge) : 1}
        onClose={() => setLogOpen(false)}
        onSubmit={async (input) => {
          // Si el desafío de hoy sigue abierto, esta salida lo cierra.
          const closesToday =
            todayChallenge && todayChallenge.status === 'pending' && input.date === todayChallenge.date;
          if (closesToday) await actions.completeChallenge(input);
          else await actions.logSession(input);
          setTab('home');
        }}
      />
    </div>
  );
}

function TabButton({ icon, label, active, onClick }: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`tab${active ? ' is-active' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={() => { tap(); onClick(); }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function useOffline(): boolean {
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return offline;
}
