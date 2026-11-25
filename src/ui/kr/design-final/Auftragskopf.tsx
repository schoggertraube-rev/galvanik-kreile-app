'use client';

/** Erweitert die Darstellung um src/ui/kr/Auftragszeile.tsx. Der Detailadapter liefert die Props. */
import type { KeyboardEvent, ReactNode } from 'react';
import styles from './Auftragskopf.module.css';

export interface AuftragskopfProps {
  titelId: string;
  titel: string;
  bild?: { src: string; alt: string; label?: string; onOeffnen?: () => void };
  termin?: string;
  verweise?: ReadonlyArray<{ id: string; label: string; href: string }>;
  hinweis?: { symbol?: ReactNode; text: string; ton: 'frist' | 'sperre' | 'neutral' };
  fortschritt?: { wert: number; maximum: number; text: string };
  schliessen?: ReactNode;
}

export function Auftragskopf({ titelId, titel, bild, termin, verweise, hinweis, fortschritt, schliessen }: AuftragskopfProps) {
  const auftragsbild = bild && <img src={bild.src} alt={bild.alt} />;
  return <header className={styles.kopf}>
    <div className={styles.identitaet}>
      {bild && (bild.onOeffnen ? <button type="button" className={styles.bild} aria-label={bild.label} onClick={bild.onOeffnen}>{auftragsbild}</button>
        : <span className={styles.bild}>{auftragsbild}</span>)}
      <div className={styles.wortblock}>
        <h2 id={titelId} className={styles.titel}>{titel}</h2>
        {termin && <span className={styles.termin}>{termin}</span>}
        {!!verweise?.length && <div className={styles.verweise}>{verweise.map(verweis => <a key={verweis.id} href={verweis.href}>{verweis.label}</a>)}</div>}
      </div>
      {schliessen && <div className={styles.schliessen}>{schliessen}</div>}
    </div>
    {hinweis && <div className={styles.hinweis} data-ton={hinweis.ton}>
      {hinweis.symbol && <span aria-hidden="true">{hinweis.symbol}</span>}
      <span>{hinweis.text}</span>
    </div>}
    {fortschritt && <div className={styles.fortschritt}>
      <progress value={fortschritt.wert} max={fortschritt.maximum} aria-label={fortschritt.text} />
      <span aria-hidden="true">{fortschritt.text}</span>
    </div>}
  </header>;
}

export interface AuftragsreiterEintrag {
  id: string;
  panelId: string;
  label: string;
  icon?: ReactNode;
  gesperrt?: boolean;
}

export function Auftragsreiter({ id, label, reiter, aktiv, onWaehlen }: {
  id: string;
  label: string;
  reiter: readonly AuftragsreiterEintrag[];
  aktiv: string;
  onWaehlen: (reiterId: string) => void;
}) {
  function beiTaste(event: KeyboardEvent<HTMLButtonElement>, reiterId: string) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const erreichbar = reiter.filter(eintrag => !eintrag.gesperrt);
    const position = erreichbar.findIndex(eintrag => eintrag.id === reiterId);
    if (position < 0) return;
    const schritt = event.key === 'ArrowRight' ? 1 : -1;
    const ziel = event.key === 'Home' ? erreichbar[0] : event.key === 'End' ? erreichbar[erreichbar.length - 1]
      : erreichbar[(position + schritt + erreichbar.length) % erreichbar.length];
    if (!ziel) return;
    event.preventDefault();
    onWaehlen(ziel.id);
    event.currentTarget.ownerDocument.getElementById(`${id}-${ziel.id}`)?.focus();
  }
  return <div className={styles.reiter} role="tablist" aria-label={label}>
    {reiter.map(eintrag => <button key={eintrag.id} type="button" role="tab" id={`${id}-${eintrag.id}`}
      aria-controls={eintrag.panelId} aria-selected={eintrag.id === aktiv} tabIndex={eintrag.id === aktiv ? 0 : -1}
      disabled={eintrag.gesperrt} onClick={() => onWaehlen(eintrag.id)} onKeyDown={event => beiTaste(event, eintrag.id)}>
      {eintrag.icon && <span aria-hidden="true">{eintrag.icon}</span>}<span>{eintrag.label}</span>
    </button>)}
  </div>;
}
