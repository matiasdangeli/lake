import { useRef, useState } from 'react';
import { useApp } from '../stores/appStore';
import { LAGO_MUNICIPAL } from '../data/location';
import { downloadBackup } from '../services/backup';
import { Button, Card, ConfirmSheet, Field, ListItem, Sheet, Stepper, Switch, TextInput } from '../components/ui';
import { LakeMark, Tagline, Wordmark } from '../components/brand';
import { IconDownload, IconMap, IconUpload } from '../components/icons';
import { km } from '../utils/format';
import { ladderStep } from '../engines/AdaptiveCyclingEngine';
import { CHALLENGE_TYPE_LABEL } from '../utils/format';
import { todayISO } from '../utils/date';

export function ProfileScreen() {
  const { profile, settings, progression, sessions, weights, actions, storage } = useApp();
  const [nameOpen, setNameOpen] = useState(false);
  const [name, setName] = useState(profile?.name ?? '');
  const [lapOpen, setLapOpen] = useState(false);
  const [lapValue, setLapValue] = useState(settings.lapDistanceKm);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goal, setGoal] = useState(profile?.goal ?? '');
  const [weightOpen, setWeightOpen] = useState(false);
  const [weightValue, setWeightValue] = useState(
    weights.length ? weights[weights.length - 1].kg : 75
  );
  const [confirmReset, setConfirmReset] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const step = ladderStep(progression.level);

  return (
    <div className="screen stack-lg">
      <h1 className="title">Perfil</h1>

      <Card className="pad">
        <div className="brandcard">
          <LakeMark className="brandcard__mark" />
          <div className="brandcard__text">
            <Wordmark className="wordmark" />
            <Tagline className="brandcard__tag" />
          </div>
        </div>
      </Card>

      <section className="stack-sm">
        <span className="section-title">Vos</span>
        <Card className="list">
          <ListItem label="Nombre" value={profile?.name || 'Sin nombre'} onClick={() => {
            setName(profile?.name ?? '');
            setNameOpen(true);
          }} />
          <ListItem label="Objetivo" value={profile?.goal || '—'} onClick={() => {
            setGoal(profile?.goal ?? '');
            setGoalOpen(true);
          }} />
          <ListItem label="Nivel actual" value={`${step.laps} ${step.laps === 1 ? 'vuelta' : 'vueltas'} · ${CHALLENGE_TYPE_LABEL[step.type]}`} />
        </Card>
      </section>

      <section className="stack-sm">
        <span className="section-title">El lago</span>
        <Card className="list">
          <ListItem label="Ubicación" value={`${LAGO_MUNICIPAL.name}, ${LAGO_MUNICIPAL.city.split(',')[0]}`} />
          <ListItem label="Una vuelta" value={km(settings.lapDistanceKm)} onClick={() => {
            setLapValue(settings.lapDistanceKm);
            setLapOpen(true);
          }} />
          <ListItem label="Unidades" value="km · km/h" />
        </Card>
        <a className="btn btn--block" href={LAGO_MUNICIPAL.mapsUrl} target="_blank" rel="noreferrer">
          <IconMap style={{ width: 17, height: 17 }} /> Abrir en Google Maps
        </a>
      </section>

      <section className="stack-sm">
        <span className="section-title">Preferencias</span>
        <Card className="list">
          <ListItem label="Registrar peso">
            <Switch
              label="Registrar peso"
              checked={settings.weightEnabled}
              onChange={(v) => void actions.updateSettings({ weightEnabled: v })}
            />
          </ListItem>
          {settings.weightEnabled && (
            <ListItem
              label="Peso de esta semana"
              value={weights.length ? `${weights[weights.length - 1].kg.toFixed(1).replace('.', ',')} kg` : 'Sin registrar'}
              onClick={() => setWeightOpen(true)}
            />
          )}
          <ListItem label="Reducir movimiento">
            <Switch
              label="Reducir movimiento"
              checked={settings.reduceMotion}
              onChange={(v) => void actions.updateSettings({ reduceMotion: v })}
            />
          </ListItem>
        </Card>
      </section>

      <section className="stack-sm">
        <span className="section-title">Datos</span>
        <Card className="list">
          <ListItem label="Salidas guardadas" value={String(sessions.length)} />
          <ListItem label="Almacenamiento" value={storage === 'indexeddb' ? 'IndexedDB' : 'Local (respaldo)'} />
        </Card>
        <div className="grid-2">
          <Button onClick={async () => {
            await downloadBackup();
            setNotice('Backup descargado.');
          }}>
            <IconDownload style={{ width: 17, height: 17 }} /> Exportar
          </Button>
          <Button onClick={() => fileRef.current?.click()}>
            <IconUpload style={{ width: 17, height: 17 }} /> Importar
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            try {
              await actions.importBackupText(await file.text());
              setNotice('Backup importado.');
            } catch (err) {
              setNotice((err as Error).message);
            }
          }}
        />
        {notice && <div className="banner banner--info">{notice}</div>}
        <Button variant="danger" block onClick={() => setConfirmReset(true)}>Resetear aplicación</Button>
      </section>

      <p className="mini" style={{ textAlign: 'center' }}>
        LAKE · Lago Municipal de Colón
      </p>

      {/* ---------------- sheets ---------------- */}

      <Sheet open={nameOpen} title="Nombre" onClose={() => setNameOpen(false)}
        footer={
          <Button variant="primary" block onClick={async () => {
            await actions.updateProfile({ name: name.trim() });
            setNameOpen(false);
          }}>Guardar</Button>
        }>
        <Field label="Cómo te llamás">
          <TextInput value={name} placeholder="Mati" onChange={(e) => setName(e.target.value)} />
        </Field>
      </Sheet>

      <Sheet open={goalOpen} title="Objetivo" onClose={() => setGoalOpen(false)}
        footer={
          <Button variant="primary" block onClick={async () => {
            await actions.updateProfile({ goal: goal.trim() });
            setGoalOpen(false);
          }}>Guardar</Button>
        }>
        <Field label="Qué buscás" hint="Una línea alcanza.">
          <TextInput value={goal} placeholder="Sostener tres salidas por semana"
            onChange={(e) => setGoal(e.target.value)} />
        </Field>
      </Sheet>

      <Sheet open={lapOpen} title="Distancia de una vuelta" onClose={() => setLapOpen(false)}
        footer={
          <Button variant="primary" block onClick={async () => {
            await actions.updateSettings({ lapDistanceKm: Number(lapValue.toFixed(2)) });
            setLapOpen(false);
          }}>Guardar</Button>
        }>
        <p className="body">
          Todos los objetivos se expresan en vueltas. Si medís el circuito y no son exactamente {km(settings.lapDistanceKm)},
          corregilo acá: las salidas ya guardadas no se tocan.
        </p>
        <Stepper value={lapValue} min={0.5} max={20} step={0.1} decimals={1} unit="km" onChange={setLapValue} />
      </Sheet>

      <Sheet open={weightOpen} title="Peso" onClose={() => setWeightOpen(false)}
        footer={
          <Button variant="primary" block onClick={async () => {
            await actions.saveWeight(Number(weightValue.toFixed(1)), todayISO());
            setWeightOpen(false);
          }}>Guardar</Button>
        }>
        <p className="body">Una vez por semana alcanza. Esto no es lo importante acá.</p>
        <Stepper value={weightValue} min={30} max={200} step={0.1} decimals={1} unit="kg" onChange={setWeightValue} />
      </Sheet>

      <ConfirmSheet
        open={confirmReset}
        title="Resetear aplicación"
        message="Se borra todo: salidas, desafíos, logros y configuración. Si querés conservarlo, exportá un backup antes."
        confirmLabel="Borrar todo"
        onCancel={() => setConfirmReset(false)}
        onConfirm={async () => {
          setConfirmReset(false);
          await actions.resetApp();
        }}
      />
    </div>
  );
}
