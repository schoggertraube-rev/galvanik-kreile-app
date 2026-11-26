'use client';

/** Neu in src/ui/kr. Darstellung für Materialauswahl und Entnahme. */
import Image from 'next/image';
import type { ReactNode } from 'react';
import styles from './Lagerkarte.module.css';

export interface LagerkarteProps {
  titel: string;
  masse?: string;
  ort?: string;
  bild?: { src: string; alt: string };
  ausgewaehlt: boolean;
  onWaehlen?: () => void;
  bestand: { menge: string; einheit: string; zustand: string; knapp?: boolean; symbol?: ReactNode };
  entnehmen?: { menge: string; text: string; label?: string; ausstehend?: boolean; gesperrt?: boolean; onEntnehmen: () => void };
  andereMenge?: { label: string; onOeffnen: () => void; gesperrt?: boolean };
  ortDetails?: { label: string; symbol: ReactNode; onOeffnen: () => void };
  menue?: { label: string; symbol: ReactNode; onOeffnen: () => void };
  rueckmeldung?: { text: string; fehler?: boolean };
}

export function Lagerkarte({ titel, masse, ort, bild, ausgewaehlt, onWaehlen, bestand, entnehmen, andereMenge, ortDetails, menue, rueckmeldung }: LagerkarteProps) {
  return <li className={styles.karte} data-aktiv={ausgewaehlt || undefined} data-knapp={bestand.knapp || undefined}
    data-bild={bild ? 'an' : undefined}>
    <div className={styles.bezeichnung}>
      {bild && <Image className={styles.bild} src={bild.src} alt={bild.alt} width={48} height={48} unoptimized />}
      <div className={styles.titelblock}>
        <h3 className={styles.titel}>
          {onWaehlen ? <button type="button" className={styles.wahl} aria-pressed={ausgewaehlt} onClick={onWaehlen}>{titel}</button> : titel}
        </h3>
        {masse && <p className={styles.masse}>{masse}</p>}
        {ort && <p className={styles.ort}>{ort}</p>}
      </div>
    </div>
    <div className={styles.bestand}>
      <span className={styles.vorrat}><strong>{bestand.menge}</strong> <span>{bestand.einheit}</span></span>
      <span className={styles.zustand}>
        {bestand.symbol && <span aria-hidden="true">{bestand.symbol}</span>}{bestand.zustand}
      </span>
    </div>
    {(entnehmen || andereMenge) && <div className={styles.mengen}>
      {entnehmen && <button type="button" className={styles.entnahme} aria-label={entnehmen.label}
        aria-busy={entnehmen.ausstehend || undefined} disabled={entnehmen.gesperrt || entnehmen.ausstehend} onClick={entnehmen.onEntnehmen}>
        <strong>{entnehmen.menge}</strong><span>{entnehmen.text}</span>
      </button>}
      {andereMenge && <button type="button" className={styles.andereMenge} disabled={andereMenge.gesperrt} onClick={andereMenge.onOeffnen}>{andereMenge.label}</button>}
    </div>}
    {(ortDetails || menue) && <div className={styles.werkzeuge}>
      {ortDetails && <button type="button" className={styles.werkzeug} aria-label={ortDetails.label} onClick={ortDetails.onOeffnen}>
        <span aria-hidden="true">{ortDetails.symbol}</span>
      </button>}
      {menue && <button type="button" className={styles.werkzeug} aria-label={menue.label} aria-haspopup="menu" onClick={menue.onOeffnen}>
        <span aria-hidden="true">{menue.symbol}</span>
      </button>}
    </div>}
    {rueckmeldung && <p className={styles.rueckmeldung} role={rueckmeldung.fehler ? 'alert' : 'status'}>{rueckmeldung.text}</p>}
  </li>;
}

export function Lagerkarten({ artikel, label, leer, busy }: {
  artikel: ReadonlyArray<LagerkarteProps & { id: string }>;
  label: string;
  leer?: ReactNode;
  busy?: boolean;
}) {
  return <section className={styles.lager} aria-label={label} aria-busy={busy || undefined}>
    {artikel.length ? <ul className={styles.liste}>{artikel.map(({ id, ...zeile }) => <Lagerkarte key={id} {...zeile} />)}</ul> : leer}
  </section>;
}
