'use client';

import { useId, type Ref } from 'react';
import { Delete } from 'lucide-react';
import { PIN_LOGIN_COPY } from '@/ui/allgemeinCopy';
import { Glasknopf } from './design-final/Glasknopf';
import styles from './PinEingabe.module.css';

export interface PinEingabeProps {
  laenge: number;
  meldung?: string | null;
  gesperrt?: boolean;
  schuetteln?: boolean;
  punktRef?: Ref<HTMLDivElement>;
  tastaturTabIndex?: number;
  onZiffer: (ziffer: string) => void;
  onLoeschen: () => void;
  onNeu?: () => void;
  onEmailAnmeldung?: () => void;
}

const ziffern = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function PinEingabe({ laenge, meldung, gesperrt, schuetteln, punktRef, tastaturTabIndex, onZiffer, onLoeschen, onNeu, onEmailAnmeldung }: PinEingabeProps) {
  const meldungsId = useId();
  const ziffer = (wert: string) => (
    <Glasknopf key={wert} knopfform="kreis" bezeichnung={wert} icon={<span>{wert}</span>}
      disabled={gesperrt} tabIndex={tastaturTabIndex} onClick={() => onZiffer(wert)} />
  );

  return <>
    <div className={styles.status}>
      <div ref={punktRef} className={styles.punkte} data-schuetteln={schuetteln || undefined}
        data-error={Boolean(meldung)} data-spec-id="login.pin" role="group" tabIndex={0}
        aria-label={PIN_LOGIN_COPY.pinStellen(laenge)} aria-describedby={meldungsId}>
        {[0, 1, 2, 3].map(n => <span key={n} data-filled={laenge > n} aria-hidden="true" />)}
      </div>
      <p id={meldungsId} className={styles.meldung} role={meldung ? 'alert' : undefined} aria-live="polite">{meldung}</p>
    </div>
    <div className={styles.tasten} data-spec-id="login.anmelden" aria-label={PIN_LOGIN_COPY.ziffernblock}>
      {ziffern.map(ziffer)}
      {onNeu ? <Glasknopf knopfform="kreis" bezeichnung="Neu" icon={<span>Neu</span>}
        disabled={gesperrt} tabIndex={tastaturTabIndex} onClick={onNeu} /> : <span aria-hidden="true" />}
      {ziffer('0')}
      <Glasknopf knopfform="kreis" bezeichnung="Löschen" icon={<Delete aria-hidden="true" />}
        disabled={gesperrt} tabIndex={tastaturTabIndex} onClick={onLoeschen} />
    </div>
    {onEmailAnmeldung ? <Glasknopf text={PIN_LOGIN_COPY.mitEmail} ton="leise" disabled={gesperrt} onClick={onEmailAnmeldung} /> : null}
  </>;
}
